"use server";

import { revalidatePath } from "next/cache";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureConfigWrite, getAccess } from "@/lib/authz";
import { getActiveArtifactContent, saveArtifactContent } from "@/lib/config-artifact";
import {
  parseResourceGroups,
  serializeResourceGroups,
  EMPTY_RESOURCE_GROUPS,
} from "@/lib/resource-groups/schema";
import { changedGroupPaths, isPathInScope } from "@/lib/resource-groups/tree";
import { bootCheckResourceGroups } from "@/lib/resource-groups/boot-check";

export type SaveResult = { ok: true; version: number } | { ok: false; error: string };

const TYPE = "RESOURCE_GROUPS_JSON" as const;
const NAME = "resource-groups.json";

export async function getResourceGroupsContent(environmentId: string): Promise<string> {
  return (
    (await getActiveArtifactContent(environmentId, TYPE, NAME)) ??
    serializeResourceGroups(EMPTY_RESOURCE_GROUPS)
  );
}

export async function saveResourceGroups(content: string): Promise<SaveResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin/oluşturun." };
  const denied = await ensureConfigWrite(TYPE, env.id);
  if (denied) return denied;
  const parsed = parseResourceGroups(content);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Boot-readiness guard (requirement 2.2): block configs Trino would reject.
  const boot = bootCheckResourceGroups(content);
  if (!boot.ready) return { ok: false, error: boot.errors[0] ?? "Geçersiz resource-groups.json" };

  // Per-resource-group scope (requirement 3.2): a scoped editor may only change
  // groups inside their allowed set.
  const access = await getAccess(env.id);
  if (access.scopeResourceGroups !== null) {
    const before = parseResourceGroups(await getResourceGroupsContent(env.id));
    const beforeRoots = before.ok ? before.doc.rootGroups : [];
    const changed = changedGroupPaths(beforeRoots, parsed.doc.rootGroups);
    const outside = changed.filter((p) => !isPathInScope(p, access.scopeResourceGroups as string[]));
    if (outside.length > 0) {
      return { ok: false, error: `Kapsamınız dışındaki resource-group'lar değiştirilemez: ${outside.join(", ")}` };
    }
  }

  const version = await saveArtifactContent(env.id, TYPE, NAME, content);
  revalidatePath("/resource-groups");
  return { ok: true, version };
}
