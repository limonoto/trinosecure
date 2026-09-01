"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { ensureRole } from "@/lib/authz";
import { getActiveEnvironment } from "@/lib/environment-context";
import { alertRuleSchema } from "@/lib/validation";
import { formString } from "@/lib/form";

export type ActionResult = { ok: true } | { ok: false; error: string };

function parse(formData: FormData) {
  return alertRuleSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    metric: formData.get("metric"),
    comparator: formData.get("comparator"),
    threshold: formData.get("threshold"),
    window: formString(formData.get("window")) || "5m",
  });
}

export async function createAlertRule(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin/oluşturun." };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };

  const rule = await prisma.alertRule.create({
    data: { environmentId: env.id, ...parsed.data },
  });
  const actor = await getSessionActor();
  await recordAudit({
    action: "CREATE",
    entityType: "AlertRule",
    entityId: rule.id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    after: { name: rule.name, metric: rule.metric, kind: rule.kind },
  });
  revalidatePath("/alerts");
  return { ok: true };
}

export async function toggleAlertRule(id: string, enabled: boolean): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule || rule.environmentId !== env.id) return { ok: false, error: "Kural bulunamadı" };
  await prisma.alertRule.update({ where: { id }, data: { enabled } });
  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteAlertRule(id: string): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule || rule.environmentId !== env.id) return { ok: false, error: "Kural bulunamadı" };
  await prisma.alertRule.delete({ where: { id } });
  const actor = await getSessionActor();
  await recordAudit({
    action: "DELETE",
    entityType: "AlertRule",
    entityId: id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    before: { name: rule.name },
  });
  revalidatePath("/alerts");
  return { ok: true };
}
