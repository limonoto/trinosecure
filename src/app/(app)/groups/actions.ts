"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureRole } from "@/lib/authz";
import { groupSchema, memberSchema } from "@/lib/validation";
import { formString } from "@/lib/form";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type AddMemberResult =
  | { ok: true; member: { id: string; username: string } }
  | { ok: false; error: string };

function parseGroup(formData: FormData) {
  const description = formString(formData.get("description")).trim();
  return groupSchema.safeParse({
    name: formData.get("name"),
    description: description === "" ? undefined : description,
  });
}

export async function createGroup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam oluşturun/seçin." };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const parsed = parseGroup(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  const actor = await getSessionActor();
  try {
    const group = await prisma.appGroup.create({
      data: {
        environmentId: env.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    await recordAudit({
      action: "CREATE",
      entityType: "AppGroup",
      entityId: group.id,
      environmentId: env.id,
      actorUsername: actor.username, actorEmail: actor.email,
      after: group,
    });
    revalidatePath("/groups");
    return { ok: true };
  } catch {
    return { ok: false, error: "Kaydedilemedi — bu ortamda aynı adlı grup olabilir." };
  }
}

export async function updateGroup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const id = formString(formData.get("id"));
  if (!id) return { ok: false, error: "Kayıt bulunamadı" };
  const parsed = parseGroup(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  const before = await prisma.appGroup.findUnique({ where: { id } });
  if (!before || before.environmentId !== env.id) return { ok: false, error: "Grup bulunamadı" };
  const actor = await getSessionActor();
  try {
    const group = await prisma.appGroup.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description ?? null },
    });
    await recordAudit({
      action: "UPDATE",
      entityType: "AppGroup",
      entityId: id,
      environmentId: env.id,
      actorUsername: actor.username, actorEmail: actor.email,
      before,
      after: group,
    });
    revalidatePath("/groups");
    return { ok: true };
  } catch {
    return { ok: false, error: "Güncellenemedi — bu ortamda aynı adlı grup olabilir." };
  }
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const before = await prisma.appGroup.findUnique({ where: { id } });
  if (!before || before.environmentId !== env.id) return { ok: false, error: "Grup bulunamadı" };
  const actor = await getSessionActor();
  await prisma.appGroup.delete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entityType: "AppGroup",
    entityId: id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    before,
  });
  revalidatePath("/groups");
  return { ok: true };
}

export async function addMember(groupId: string, username: string): Promise<AddMemberResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const group = await prisma.appGroup.findUnique({ where: { id: groupId } });
  if (!group || group.environmentId !== env.id) return { ok: false, error: "Grup bulunamadı" };
  const parsed = memberSchema.safeParse({ username });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  const actor = await getSessionActor();
  try {
    const member = await prisma.appGroupMember.create({
      data: { groupId, username: parsed.data.username },
    });
    await recordAudit({
      action: "UPDATE",
      entityType: "AppGroup",
      entityId: groupId,
      environmentId: env.id,
      actorUsername: actor.username, actorEmail: actor.email,
      after: { addedMember: parsed.data.username },
    });
    revalidatePath("/groups");
    return { ok: true, member: { id: member.id, username: member.username } };
  } catch {
    return { ok: false, error: "Eklenemedi — bu kullanıcı zaten üye olabilir." };
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;
  const member = await prisma.appGroupMember.findUnique({
    where: { id: memberId },
    include: { group: true },
  });
  if (!member || member.group.environmentId !== env.id) return { ok: false, error: "Üye bulunamadı" };
  const actor = await getSessionActor();
  await prisma.appGroupMember.delete({ where: { id: memberId } });
  await recordAudit({
    action: "UPDATE",
    entityType: "AppGroup",
    entityId: member.groupId,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    after: { removedMember: member.username },
  });
  revalidatePath("/groups");
  return { ok: true };
}
