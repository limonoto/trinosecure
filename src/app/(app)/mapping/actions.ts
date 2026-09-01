"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureConfigWrite } from "@/lib/authz";
import { saveArtifactContent } from "@/lib/config-artifact";
import { formatGroupProviderFile } from "@/lib/group-provider/format";
import type { GroupProviderConfig } from "@/lib/group-provider/provider";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ExportResult =
  | { ok: true; content: string; filename: string }
  | { ok: false; error: string };

const ARTIFACT_NAME = "group-provider";

export async function saveGroupProvider(config: GroupProviderConfig): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureConfigWrite("GROUP_PROVIDER", env.id);
  if (denied) return denied;
  const safe: GroupProviderConfig = {
    type: config.type === "LDAP" ? "LDAP" : "FILE",
    ldap: config.ldap && typeof config.ldap === "object" ? config.ldap : {},
  };
  await saveArtifactContent(env.id, "GROUP_PROVIDER", ARTIFACT_NAME, JSON.stringify(safe));
  revalidatePath("/mapping");
  return { ok: true };
}

/** Build the static `group-provider.txt` from the app's groups + members. */
export async function exportGroupFile(): Promise<ExportResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const groups = await prisma.appGroup.findMany({
    where: { environmentId: env.id },
    include: { members: { select: { username: true } } },
  });
  const content = formatGroupProviderFile(
    groups.map((g) => ({ name: g.name, members: g.members.map((m) => m.username) })),
  );
  return { ok: true, content, filename: "group-provider.txt" };
}
