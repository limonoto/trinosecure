"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureConfigWrite } from "@/lib/authz";
import { passwordUserSchema, passwordChangeSchema } from "@/lib/validation";
import { formatPasswordDb } from "@/lib/passwords/format";
import { hashPassword } from "@/lib/passwords/hash";
import { snapshotPasswordDb } from "@/lib/passwords/service";
import { formString } from "@/lib/form";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ExportResult = { ok: true; content: string } | { ok: false; error: string };

export async function createPasswordUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam oluşturun/seçin." };
  const denied = await ensureConfigWrite("PASSWORD_DB", env.id);
  if (denied) return denied;

  const parsed = passwordUserSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    encoding: formString(formData.get("encoding")) || "BCRYPT",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };

  const passwordHash = await hashPassword(parsed.data.password, parsed.data.encoding);

  // Optional: also add the user to a group (requirement 2.3 — provision + assign).
  const groupId = formString(formData.get("groupId"));

  try {
    const entry = await prisma.passwordEntry.create({
      data: {
        environmentId: env.id,
        username: parsed.data.username,
        passwordHash,
        encoding: parsed.data.encoding,
      },
    });

    let assignedGroup: string | undefined;
    if (groupId) {
      const group = await prisma.appGroup.findUnique({ where: { id: groupId } });
      if (group && group.environmentId === env.id) {
        await prisma.appGroupMember.upsert({
          where: { groupId_username: { groupId, username: parsed.data.username } },
          create: { groupId, username: parsed.data.username },
          update: {},
        });
        assignedGroup = group.name;
      }
    }

    const actor = await getSessionActor();
    await recordAudit({
      action: "CREATE",
      entityType: "PasswordEntry",
      entityId: entry.id,
      environmentId: env.id,
      actorUsername: actor.username, actorEmail: actor.email,
      after: { username: entry.username, encoding: entry.encoding, group: assignedGroup }, // never the hash/plaintext
    });
    await snapshotPasswordDb(env.id); // version the password.db file (4.1)
    revalidatePath("/passwords");
    return { ok: true };
  } catch {
    return { ok: false, error: "Kaydedilemedi — bu kullanıcı zaten olabilir." };
  }
}

export async function changePassword(id: string, password: string): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureConfigWrite("PASSWORD_DB", env.id);
  if (denied) return denied;
  const before = await prisma.passwordEntry.findUnique({ where: { id } });
  if (!before || before.environmentId !== env.id) return { ok: false, error: "Kullanıcı bulunamadı" };

  const parsed = passwordChangeSchema.safeParse({ password });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };

  const passwordHash = await hashPassword(parsed.data.password, before.encoding);

  await prisma.passwordEntry.update({ where: { id }, data: { passwordHash } });
  const actor = await getSessionActor();
  await recordAudit({
    action: "UPDATE",
    entityType: "PasswordEntry",
    entityId: id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    after: { username: before.username, passwordChanged: true },
  });
  await snapshotPasswordDb(env.id); // version the password.db file (4.1)
  revalidatePath("/passwords");
  return { ok: true };
}

export async function deletePasswordUser(id: string): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureConfigWrite("PASSWORD_DB", env.id);
  if (denied) return denied;
  const before = await prisma.passwordEntry.findUnique({ where: { id } });
  if (!before || before.environmentId !== env.id) return { ok: false, error: "Kullanıcı bulunamadı" };

  await prisma.passwordEntry.delete({ where: { id } });
  const actor = await getSessionActor();
  await recordAudit({
    action: "DELETE",
    entityType: "PasswordEntry",
    entityId: id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    before: { username: before.username },
  });
  await snapshotPasswordDb(env.id); // version the password.db file (4.1)
  revalidatePath("/passwords");
  return { ok: true };
}

/** Build the Trino `password.db` file content (hashes stay server-side). */
export async function exportPasswordDb(): Promise<ExportResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const rows = await prisma.passwordEntry.findMany({
    where: { environmentId: env.id },
    select: { username: true, passwordHash: true },
  });
  const actor = await getSessionActor();
  await recordAudit({
    action: "EXPORT",
    entityType: "PasswordEntry",
    entityId: env.id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    after: { count: rows.length },
  });
  return { ok: true, content: formatPasswordDb(rows) };
}
