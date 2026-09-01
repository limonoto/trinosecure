"use server";

import { revalidatePath } from "next/cache";
import { ensureRole } from "@/lib/authz";
import { getActiveEnvironment } from "@/lib/environment-context";
import { saveSshConfig, getSshConfigPublic, deleteSshConfig, type SshConfigPublic } from "@/lib/deploy/ssh-config";

export type SshConfigResult = { ok: true } | { ok: false; error: string };

export type SshConfigStatusResult =
  | { ok: true; config: SshConfigPublic | null }
  | { ok: false; error: string };

export async function getSshConfigStatus(): Promise<SshConfigStatusResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const config = await getSshConfigPublic(env.id);
  return { ok: true, config };
}

export async function saveSshConfigAction(formData: FormData): Promise<SshConfigResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("PLATFORM_ADMIN", env.id);
  if (denied) return denied;

  const sshUser = (formData.get("sshUser") as string | null)?.trim() || "ansible";
  const sshPassword = (formData.get("sshPassword") as string | null)?.trim() || undefined;
  const privateKey = (formData.get("privateKey") as string | null)?.trim() || undefined;

  if (!sshPassword && !privateKey) {
    return { ok: false, error: "En az bir kimlik doğrulama yöntemi (şifre veya özel anahtar) gereklidir." };
  }

  try {
    await saveSshConfig(env.id, { sshUser, sshPassword, privateKey });
    revalidatePath("/deploy");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Kaydedilemedi" };
  }
}

export async function deleteSshConfigAction(): Promise<SshConfigResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("PLATFORM_ADMIN", env.id);
  if (denied) return denied;

  try {
    await deleteSshConfig(env.id);
    revalidatePath("/deploy");
    return { ok: true };
  } catch {
    return { ok: false, error: "Silinemedi" };
  }
}
