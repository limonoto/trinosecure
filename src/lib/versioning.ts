import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import type { ConfigArtifactType } from "@/generated/prisma/enums";
import { restorePasswordDb, PASSWORD_DB_TYPE } from "@/lib/passwords/service";
import { restoreCatalog, CATALOG_TYPE } from "@/lib/catalogs/service";

/**
 * Cross-artifact version history + rollback (requirement 4.1 — "her değişiklik
 * rollback yapılabilir"). Every managed config file is stored as ConfigArtifact +
 * immutable ConfigVersions; this module lists them and rolls any of them back,
 * re-materializing the row-backed editors (password.db, catalogs) on rollback.
 */

/** Turkish labels for the file types surfaced in the history view. */
export const ARTIFACT_TYPE_LABEL: Partial<Record<ConfigArtifactType, string>> = {
  RULES_JSON: "rules.json",
  RESOURCE_GROUPS_JSON: "resource-groups.json",
  GROUP_PROVIDER: "group-provider",
  CATALOG_PROPERTIES: "Katalog",
  PASSWORD_DB: "password.db",
};

export type VersionSummary = {
  id: string;
  version: number;
  isActive: boolean;
  note: string | null;
  createdBy: string;
  createdAt: string;
};

export type ArtifactHistory = {
  artifactId: string;
  type: ConfigArtifactType;
  name: string;
  label: string;
  versions: VersionSummary[];
};

/** Every versioned artifact for an environment, newest version first. */
export async function listVersionedArtifacts(environmentId: string): Promise<ArtifactHistory[]> {
  const artifacts = await prisma.configArtifact.findMany({
    where: { environmentId },
    include: { versions: { orderBy: { version: "desc" } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return artifacts
    .filter((a) => a.versions.length > 0)
    .map((a) => ({
      artifactId: a.id,
      type: a.type,
      name: a.name,
      label: ARTIFACT_TYPE_LABEL[a.type] ?? a.name,
      versions: a.versions.map((v) => ({
        id: v.id,
        version: v.version,
        isActive: v.isActive,
        note: v.note,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
      })),
    }));
}

export type RollbackOutcome =
  | { ok: true; type: ConfigArtifactType; name: string; content: string }
  | { ok: false; error: string };

/**
 * Roll any artifact back to an older version: mark it active, re-materialize the
 * row-backed editors, and audit before/after. Re-deploy is the caller's job.
 */
export async function rollbackArtifact(environmentId: string, versionId: string): Promise<RollbackOutcome> {
  const version = await prisma.configVersion.findUnique({
    where: { id: versionId },
    include: { artifact: { include: { versions: { where: { isActive: true }, take: 1 } } } },
  });
  if (!version || version.artifact.environmentId !== environmentId) {
    return { ok: false, error: "Sürüm bulunamadı" };
  }
  const current = version.artifact.versions[0];
  const { type, name } = version.artifact;

  await prisma.$transaction([
    prisma.configVersion.updateMany({
      where: { artifactId: version.artifactId, isActive: true },
      data: { isActive: false },
    }),
    prisma.configVersion.update({ where: { id: versionId }, data: { isActive: true } }),
  ]);

  // Re-materialize the row-backed editors so their tables match the restored file.
  if (type === PASSWORD_DB_TYPE) await restorePasswordDb(environmentId, version.content);
  else if (type === CATALOG_TYPE) await restoreCatalog(environmentId, name.replace(/\.properties$/, ""), version.content);

  const actor = await getSessionActor();

  await recordAudit({
    action: "ROLLBACK",
    entityType: "ConfigArtifact",
    entityId: version.artifactId,
    actorUsername: actor.username,
    actorEmail: actor.email,
    environmentId,
    before: current ? { type, name, version: current.version, content: current.content } : undefined,
    after: { type, name, rolledBackTo: version.version, content: version.content },
  });

  return { ok: true, type, name, content: version.content };
}
