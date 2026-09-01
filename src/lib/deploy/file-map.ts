/**
 * Shared utility: render all managed Trino config files to a filename → content map.
 * Extracted from deploy/actions.ts so both server actions and the SSE API route can
 * import it without touching "use server" module boundaries.
 */

import { prisma } from "@/lib/db";
import { getRulesContent } from "@/lib/rules/service";
import { getActiveArtifactContent } from "@/lib/config-artifact";
import { formatPasswordDb } from "@/lib/passwords/format";
import { formatGroupProviderFile } from "@/lib/group-provider/format";
import { toCatalogProperties } from "@/lib/catalogs/connectors";
import { destinationFor } from "@/lib/deploy/publish";
import { sha256Hex } from "@/lib/deploy/consistency";
import type { AnsibleFile, ExpectedFile } from "@/lib/deploy/ansible";

export async function buildFileMap(envId: string): Promise<Record<string, string>> {
  const [rules, resourceGroups, groups, passwords, catalogs,
    accessControl, authProps, rgProps, gpProps] = await Promise.all([
    getRulesContent(envId),
    getActiveArtifactContent(envId, "RESOURCE_GROUPS_JSON", "resource-groups.json"),
    prisma.appGroup.findMany({ where: { environmentId: envId }, include: { members: { select: { username: true } } } }),
    prisma.passwordEntry.findMany({ where: { environmentId: envId }, select: { username: true, passwordHash: true } }),
    prisma.catalogConfig.findMany({ where: { environmentId: envId } }),
    getActiveArtifactContent(envId, "ACCESS_CONTROL_PROPERTIES", "access-control.properties"),
    getActiveArtifactContent(envId, "AUTH_PROPERTIES", "password-authenticator.properties"),
    getActiveArtifactContent(envId, "RESOURCE_GROUPS_PROPERTIES", "resource-groups.properties"),
    getActiveArtifactContent(envId, "GROUP_PROVIDER_PROPERTIES", "group-provider.properties"),
  ]);

  const files: Record<string, string> = {};
  if (rules) files["rules.json"] = rules;
  if (resourceGroups) files["resource-groups.json"] = resourceGroups;

  const gpContent = formatGroupProviderFile(
    groups.map((g) => ({ name: g.name, members: g.members.map((m) => m.username) })),
  );
  if (gpContent.trim()) files["group-provider.txt"] = gpContent;

  const pwContent = formatPasswordDb(passwords);
  if (pwContent.trim()) files["password.db"] = pwContent;

  for (const c of catalogs) {
    const props = toCatalogProperties(c.connector, (c.properties as Record<string, string>) ?? {});
    files[`${c.name}.properties`] = props;
  }

  // .properties config files (cluster-level, require Trino restart to take effect)
  if (accessControl) files["access-control.properties"] = accessControl;
  if (authProps) files["password-authenticator.properties"] = authProps;
  if (rgProps) files["resource-groups.properties"] = rgProps;
  if (gpProps) files["group-provider.properties"] = gpProps;

  return files;
}

function fileTypeName(name: string): Parameters<typeof destinationFor>[1] {
  if (name === "rules.json") return "RULES_JSON";
  if (name === "resource-groups.json") return "RESOURCE_GROUPS_JSON";
  if (name === "group-provider.txt") return "GROUP_PROVIDER";
  if (name === "password.db") return "PASSWORD_DB";
  return "CATALOG_PROPERTIES";
}

export function fileMapToAnsibleFiles(fileMap: Record<string, string>, configTarget: string): AnsibleFile[] {
  return Object.keys(fileMap).map((name) => ({
    filename: name,
    dest: destinationFor(configTarget, fileTypeName(name), name),
  }));
}

export function fileMapToExpectedFiles(fileMap: Record<string, string>, configTarget: string): ExpectedFile[] {
  return Object.entries(fileMap).map(([name, content]) => ({
    dest: destinationFor(configTarget, fileTypeName(name), name),
    sha256: sha256Hex(content),
  }));
}
