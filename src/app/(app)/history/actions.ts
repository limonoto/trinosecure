"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureRole } from "@/lib/authz";
import { rollbackArtifact } from "@/lib/versioning";
import { redeployArtifact } from "@/lib/deploy/publish";
import { parseRulesJson } from "@/lib/rules/rules";
import { logicalDiff, type LogicalChange } from "@/lib/rules/logical-diff";

export type RollbackResult = { ok: true; message: string } | { ok: false; error: string };

export type VersionDiff = {
  /** Raw line-level diff: [kind, text] — "add"|"del"|"ctx" */
  lines: Array<["add" | "del" | "ctx", string]>;
  /** Logical semantic diff (only for RULES_JSON artifacts). */
  logical: LogicalChange[] | null;
  addedLines: number;
  removedLines: number;
};

/**
 * Requirement 4.2 — compare a version against the currently active version
 * (or against the immediately preceding version when it IS the active one).
 * Returns both a line-level diff and, for rules.json artifacts, a logical
 * (semantic) diff ("privileges: [SELECT] → [SELECT, INSERT]").
 */
export async function getVersionDiff(versionId: string): Promise<VersionDiff | null> {
  const env = await getActiveEnvironment();
  if (!env) return null;

  const target = await prisma.configVersion.findUnique({
    where: { id: versionId },
    include: { artifact: { include: { versions: { orderBy: { version: "desc" } } } } },
  });
  if (!target || target.artifact.environmentId !== env.id) return null;

  const allVersions = target.artifact.versions;
  // Compare target against the active version. If target IS active, compare to previous.
  const compareTo = target.isActive
    ? allVersions.find((v) => v.version < target.version)
    : allVersions.find((v) => v.isActive);

  const beforeContent = compareTo?.content ?? "";
  const afterContent = target.content;

  // Line-level diff (LCS).
  const beforeLines = beforeContent.split("\n");
  const afterLines = afterContent.split("\n");
  const n = beforeLines.length;
  const m = afterLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = beforeLines[i] === afterLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lines: Array<["add" | "del" | "ctx", string]> = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && beforeLines[i] === afterLines[j]) {
      lines.push(["ctx", beforeLines[i]]); i++; j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      lines.push(["add", afterLines[j]]); j++;
    } else {
      lines.push(["del", beforeLines[i]]); i++;
    }
  }

  const addedLines = lines.filter((l) => l[0] === "add").length;
  const removedLines = lines.filter((l) => l[0] === "del").length;

  // Logical diff — only for rules.json.
  let logical: LogicalChange[] | null = null;
  if (target.artifact.type === "RULES_JSON") {
    const beforeParsed = parseRulesJson(beforeContent || "{}");
    const afterParsed = parseRulesJson(afterContent || "{}");
    if (beforeParsed.ok && afterParsed.ok) {
      logical = logicalDiff(beforeParsed.doc, afterParsed.doc);
    }
  }

  return { lines, logical, addedLines, removedLines };
}

/**
 * Roll a config artifact back to an older version AND re-deploy it to the cluster
 * (requirement 4.3 — "tek tıkla önceki sürüme dönülebilmeli ve re-deploy
 * edilebilmelidir"). Rollback needs CONFIG_EDITOR; the automatic re-deploy
 * (writing files) needs PLATFORM_ADMIN — if the user lacks it, the version is
 * still rolled back and we tell them to publish manually.
 */
export async function rollbackToVersion(versionId: string): Promise<RollbackResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;

  const outcome = await rollbackArtifact(env.id, versionId);
  if (!outcome.ok) return outcome;

  revalidatePath("/history");
  revalidatePath("/rules");
  revalidatePath("/resource-groups");
  revalidatePath("/passwords");
  revalidatePath("/catalogs");
  revalidatePath("/mapping");

  // Auto re-deploy (4.3). Requires admin to write files; degrade gracefully.
  const publishDenied = await ensureRole("PLATFORM_ADMIN", env.id);
  if (publishDenied) {
    return { ok: true, message: "Sürüm geri alındı. Yayınlamak için Platform Admin gerekir — Yayınla’dan dağıtın." };
  }
  const full = await prisma.trinoEnvironment.findUnique({ where: { id: env.id } });
  if (!full) return { ok: true, message: "Sürüm geri alındı." };
  const redeploy = await redeployArtifact(
    { deliveryMode: full.deliveryMode, configTarget: full.configTarget },
    outcome.type,
    outcome.name,
    outcome.content,
  );
  return redeploy.ok
    ? { ok: true, message: `Sürüm geri alındı ve dağıtıldı. ${redeploy.message}` }
    : { ok: true, message: `Sürüm geri alındı, ancak dağıtım başarısız: ${redeploy.error}` };
}
