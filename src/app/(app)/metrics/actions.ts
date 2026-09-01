"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ensureRole } from "@/lib/authz";
import { getActiveEnvironment } from "@/lib/environment-context";
import { collectOnce } from "@/lib/metrics/collector";
import { evaluateRulesForEnv } from "@/lib/alerts/service";

export type CollectNowResult =
  | { ok: true; queries: number; errors: string[] }
  | { ok: false; error: string };

/** Manually trigger one metrics collection for the active environment. */
export async function collectNow(): Promise<CollectNowResult> {
  const active = await getActiveEnvironment();
  if (!active) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", active.id);
  if (denied) return denied;
  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env?.trinoBaseUrl) return { ok: false, error: "Bu ortam için Trino API adresi tanımlı değil." };

  const result = await collectOnce({ id: env.id, trinoBaseUrl: env.trinoBaseUrl });
  try {
    await evaluateRulesForEnv(env.id, new Date());
  } catch {
    result.errors.push("alerts: değerlendirme hatası");
  }
  revalidatePath("/metrics");
  revalidatePath("/alerts");
  revalidatePath("/errors");
  revalidatePath("/nodes");
  revalidatePath("/performance");
  return { ok: true, queries: result.queries, errors: result.errors };
}
