"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureRole, ensureConfigWrite } from "@/lib/authz";
import { bootCheck } from "@/lib/rules/boot-check";
import { getRulesContent, saveRulesContent } from "@/lib/rules/service";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { fetchInfo } from "@/lib/trino-api/client";
import { decrypt } from "@/lib/crypto";

export type SaveRulesResult = { ok: true; version: number } | { ok: false; error: string };
export type TokenResult = { ok: true; token: string } | { ok: false; error: string };
export type PublishResult = { ok: true } | { ok: false; error: string };

export type ValidationReport = {
  errors: string[];
  warnings: string[];
  trino: { reachable: boolean; version: string | null; error: string | null };
};

/**
 * Requirement 2.2 — "Bu config Trino'da ayağa kalkar mı?" validation.
 * Runs structural boot-check on the active rules content, then probes Trino
 * connectivity so the operator can confirm the cluster is up before publishing.
 */
export async function validateActiveConfig(): Promise<ValidationReport> {
  const env = await getActiveEnvironment();
  const report: ValidationReport = {
    errors: [],
    warnings: [],
    trino: { reachable: false, version: null, error: null },
  };

  if (!env) {
    report.errors.push("Ortam bulunamadı");
    return report;
  }

  // 1. Structural + semantic boot check.
  const content = await getRulesContent(env.id);
  const check = bootCheck(content);
  report.errors = check.errors;
  report.warnings = check.warnings;

  // 2. Live Trino probe — needs the full environment row for credentials.
  const full = await prisma.trinoEnvironment.findUnique({ where: { id: env.id } });
  if (!full?.trinoBaseUrl) {
    report.trino.error = "Trino API adresi yapılandırılmamış";
    return report;
  }
  try {
    const password = full.trinoPassword ? decrypt(full.trinoPassword) : undefined;
    const credentials =
      full.trinoUsername && password
        ? { username: full.trinoUsername, password }
        : undefined;
    const info = await fetchInfo(full.trinoBaseUrl, undefined, credentials);
    report.trino.reachable = true;
    report.trino.version = info.version;
    if (info.starting) {
      report.warnings.push(`Trino henüz başlatılıyor (starting=true). Yayınlamayı bekleyin.`);
    }
  } catch (e) {
    report.trino.error = e instanceof Error ? e.message : "Bağlantı hatası";
  }

  return report;
}

export async function saveRules(content: string): Promise<SaveRulesResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin/oluşturun." };
  const denied = await ensureConfigWrite("RULES_JSON", env.id);
  if (denied) return denied;

  // Re-validate on the server (never trust the client): block configs Trino
  // would reject at load time (invalid JSON/structure, uncompilable regex).
  const check = bootCheck(content);
  if (!check.ready) return { ok: false, error: check.errors[0] ?? "Geçersiz yapılandırma." };

  const version = await saveRulesContent(env.id, content);
  revalidatePath("/rules");
  return { ok: true, version };
}

/** Mode A: (re)generate the bearer token Trino uses to fetch the HTTP-served rules.json. */
export async function regenerateHttpToken(): Promise<TokenResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("PLATFORM_ADMIN", env.id);
  if (denied) return denied;
  const token = randomBytes(24).toString("base64url");
  await prisma.trinoEnvironment.update({ where: { id: env.id }, data: { httpToken: token } });
  const actor = await getSessionActor();
  await recordAudit({
    action: "UPDATE",
    entityType: "TrinoEnvironment",
    entityId: env.id,
    actorUsername: actor.username,
    actorEmail: actor.email,
    environmentId: env.id,
    after: { httpTokenRotated: true },
  });
  revalidatePath("/rules");
  return { ok: true, token };
}

/** Mode B: write the active rules.json to the environment's configTarget path. */
export async function publishToFile(): Promise<PublishResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("PLATFORM_ADMIN", env.id);
  if (denied) return denied;
  if (env.deliveryMode !== "FILE") return { ok: false, error: "Bu ortam dosya modunda değil." };
  const content = await getRulesContent(env.id);
  try {
    await writeFile(env.configTarget, content, "utf8");
  } catch {
    return { ok: false, error: `Dosyaya yazılamadı: ${env.configTarget}` };
  }
  const actor = await getSessionActor();
  await recordAudit({
    action: "PUBLISH",
    entityType: "ConfigArtifact",
    entityId: env.id,
    actorUsername: actor.username,
    actorEmail: actor.email,
    environmentId: env.id,
    after: { path: env.configTarget },
  });
  return { ok: true };
}

