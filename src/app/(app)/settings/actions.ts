"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { ensureRole } from "@/lib/authz";
import { APP_ROLES, type AppRole } from "@/lib/rbac";
import { SCOPABLE_CONFIG_TYPES, type ScopableConfigType } from "@/lib/config-types";
import { formString } from "@/lib/form";

export type ActionResult = { ok: true } | { ok: false; error: string };

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

function isScopableType(value: string): value is ScopableConfigType {
  return (SCOPABLE_CONFIG_TYPES as readonly string[]).includes(value);
}

/** Assign (or update) a role for a username, globally or scoped to one environment. */
export async function assignRole(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await ensureRole("PLATFORM_ADMIN");
  if (denied) return denied;

  const username = formString(formData.get("username")).trim();
  const role = formString(formData.get("role"));
  const scope = formString(formData.get("scope")); // "global" or an environment id
  if (!username) return { ok: false, error: "Kullanıcı adı zorunlu" };
  if (!isAppRole(role)) return { ok: false, error: "Geçersiz rol" };

  const environmentId = scope === "global" || scope === "" ? null : scope;
  if (environmentId) {
    const env = await prisma.trinoEnvironment.findUnique({ where: { id: environmentId } });
    if (!env) return { ok: false, error: "Ortam bulunamadı" };
  }

  // Fine-grained scope (requirement 3.2) only applies to a scoped CONFIG_EDITOR.
  // Empty arrays = unrestricted. Ignored for VIEWER / PLATFORM_ADMIN.
  const scopeConfigTypes =
    role === "CONFIG_EDITOR"
      ? formData.getAll("scopeConfigTypes").map(String).filter(isScopableType)
      : [];
  const scopeResourceGroups =
    role === "CONFIG_EDITOR"
      ? formString(formData.get("scopeResourceGroups"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  // Compound unique (username, environmentId) — null is "distinct" in Postgres, so
  // match-then-update/create rather than upsert.
  const existing = await prisma.appUserRole.findFirst({ where: { username, environmentId } });
  const data = { role, scopeConfigTypes, scopeResourceGroups };
  if (existing) {
    await prisma.appUserRole.update({ where: { id: existing.id }, data });
  } else {
    await prisma.appUserRole.create({ data: { username, environmentId, ...data } });
  }

  const actor = await getSessionActor();
  await recordAudit({
    action: "UPDATE",
    entityType: "AppUserRole",
    entityId: username,
    actorUsername: actor.username, actorEmail: actor.email,
    environmentId,
    after: { username, role, scope: environmentId ?? "global", scopeConfigTypes, scopeResourceGroups },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeRole(id: string): Promise<ActionResult> {
  const denied = await ensureRole("PLATFORM_ADMIN");
  if (denied) return denied;
  const before = await prisma.appUserRole.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Kayıt bulunamadı" };
  await prisma.appUserRole.delete({ where: { id } });
  const actor = await getSessionActor();
  await recordAudit({
    action: "DELETE",
    entityType: "AppUserRole",
    entityId: before.username,
    actorUsername: actor.username, actorEmail: actor.email,
    environmentId: before.environmentId,
    before: { username: before.username, role: before.role },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export type RetentionResult =
  | { ok: true; auditLogsDeleted: number; configVersionsDeleted: number }
  | { ok: false; error: string };

/**
 * Purge old records according to retention policy:
 * - AuditLog: delete records older than AUDIT_RETENTION_DAYS (default 90).
 * - ConfigVersion: per artifact, keep the active version + the last
 *   CONFIG_VERSION_KEEP (default 10) inactive versions; delete the rest.
 */
export async function runRetentionCleanup(): Promise<RetentionResult> {
  const denied = await ensureRole("PLATFORM_ADMIN");
  if (denied) return { ok: false, error: denied.error };

  const auditRetentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS ?? "90", 10);
  const keepVersions = parseInt(process.env.CONFIG_VERSION_KEEP ?? "10", 10);

  try {
    // 1. Audit log retention
    const cutoff = new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000);
    const { count: auditLogsDeleted } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    // 2. ConfigVersion retention: for each artifact, keep active + last keepVersions inactive.
    const artifacts = await prisma.configArtifact.findMany({ select: { id: true } });
    let configVersionsDeleted = 0;
    for (const artifact of artifacts) {
      const inactive = await prisma.configVersion.findMany({
        where: { artifactId: artifact.id, isActive: false },
        orderBy: { version: "desc" },
        select: { id: true },
      });
      const toDelete = inactive.slice(keepVersions);
      if (toDelete.length > 0) {
        const { count } = await prisma.configVersion.deleteMany({
          where: { id: { in: toDelete.map((v) => v.id) } },
        });
        configVersionsDeleted += count;
      }
    }

    const actor = await getSessionActor();
    await recordAudit({
      action: "DELETE",
      entityType: "RetentionCleanup",
      entityId: "system",
      actorUsername: actor.username,
      actorEmail: actor.email,
      after: { auditLogsDeleted, configVersionsDeleted, auditRetentionDays, keepVersions },
    });

    return { ok: true, auditLogsDeleted, configVersionsDeleted };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Temizleme başarısız" };
  }
}
