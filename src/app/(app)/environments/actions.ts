"use server";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { ensureRole } from "@/lib/authz";
import { environmentSchema } from "@/lib/validation";
import { formString } from "@/lib/form";
import { fetchInfo } from "@/lib/trino-api/client";
import { encrypt } from "@/lib/crypto";
import { probeHost } from "@/lib/deploy/runner-client";
import { saveSshConfig } from "@/lib/deploy/ssh-config";

export type ConnectionTestResult =
  | { ok: true; version: string; uptime: string | null }
  | { ok: false; error: string };

export type SshTestResult = { ok: true } | { ok: false; error: string };

/** Test SSH connectivity to a host via the ansible-runner probe endpoint. */
export async function testSshConnection(
  host: string,
  sshUser: string,
  sshPassword?: string,
  sshPrivateKey?: string,
): Promise<SshTestResult> {
  const result = await probeHost({
    host,
    ssh_user: sshUser || "ansible",
    ssh_password: sshPassword || undefined,
    ssh_private_key: sshPrivateKey || undefined,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function testConnection(
  trinoBaseUrl: string,
  trinoUsername?: string,
  trinoPassword?: string,
): Promise<ConnectionTestResult> {
  try {
    const credentials =
      trinoUsername && trinoPassword ? { username: trinoUsername, password: trinoPassword } : undefined;
    const info = await fetchInfo(trinoBaseUrl, undefined, credentials);
    return { ok: true, version: info.version, uptime: info.uptime };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bağlantı kurulamadı" };
  }
}

export type BootstrapResult = {
  connected: boolean;
  imported: string[];
  skipped: string[];
  warning: string | null;
  sshOk: boolean | null;
  sshMessage: string | null;
};

export type ActionResult =
  | { ok: true; bootstrap?: BootstrapResult }
  | { ok: false; error: string };

function parseForm(formData: FormData) {
  const refresh = formString(formData.get("refreshPeriod")).trim();
  return environmentSchema.safeParse({
    name: formData.get("name"),
    deliveryMode: formData.get("deliveryMode"),
    configTarget: formData.get("configTarget"),
    refreshPeriod: refresh === "" ? undefined : refresh,
    trinoBaseUrl: formString(formData.get("trinoBaseUrl")).trim(),
    trinoUsername: formString(formData.get("trinoUsername")).trim(),
  });
}

// ── Bootstrap helpers ────────────────────────────────────────────────────────

function tryRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function parsePropertiesFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx > 0) result[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return result;
}

function parseGroups(content: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf(":");
    if (idx > 0) {
      result[t.slice(0, idx).trim()] = t
        .slice(idx + 1)
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    }
  }
  return result;
}

function parsePasswordDb(content: string): Array<{ username: string; hash: string }> {
  const SERVICE_USERS = new Set(["nizam"]);
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf(":");
      return { username: l.slice(0, idx), hash: l.slice(idx + 1) };
    })
    .filter(({ username }) => !SERVICE_USERS.has(username));
}

type SshInput = { sshUser: string; sshPassword?: string; sshPrivateKey?: string } | null;

async function bootstrapEnvironment(
  env: { id: string; trinoBaseUrl: string | null; deliveryMode: string; configTarget: string },
  ssh: SshInput = null,
): Promise<BootstrapResult> {
  const result: BootstrapResult = {
    connected: false,
    imported: [],
    skipped: [],
    warning: null,
    sshOk: null,
    sshMessage: null,
  };

  // 1. Bağlantı testi
  if (!env.trinoBaseUrl) {
    result.warning = "Trino API adresi girilmedi — otomatik içe aktarım atlandı.";
    return result;
  }
  try {
    await fetchInfo(env.trinoBaseUrl);
    result.connected = true;
  } catch (e) {
    result.warning = `Bağlantı kurulamadı: ${e instanceof Error ? e.message : "hata"}`;
    return result;
  }

  // 2. HTTP modunda boş şablon artifact'ları oluştur
  if (env.deliveryMode !== "FILE") {
    const defaultRules = JSON.stringify(
      { catalogs: [], schemas: [], tables: [], queries: [], impersonation: [], system_information: [] },
      null,
      2,
    );
    await prisma.configArtifact.create({
      data: {
        environmentId: env.id,
        type: "RULES_JSON",
        name: "rules.json",
        versions: {
          create: {
            version: 1,
            content: defaultRules,
            isActive: true,
            createdBy: "auto-bootstrap",
            note: "HTTP modu — boş başlangıç şablonu",
          },
        },
      },
    });
    result.imported.push("rules.json (boş şablon)");
    result.warning =
      "HTTP modunda config dosyaları Trino'dan okunamaz. Kuralları ve grupları UI üzerinden tanımlayın.";
    return result;
  }

  const dir = dirname(env.configTarget);

  // rules.json
  const rulesContent = tryRead(env.configTarget);
  if (rulesContent) {
    await prisma.configArtifact.create({
      data: {
        environmentId: env.id,
        type: "RULES_JSON",
        name: "rules.json",
        versions: {
          create: {
            version: 1,
            content: rulesContent,
            isActive: true,
            createdBy: "auto-bootstrap",
            note: "Ortam oluşturulurken dosyadan içe aktarıldı",
          },
        },
      },
    });
    result.imported.push("rules.json");
  } else {
    result.skipped.push("rules.json");
  }

  // resource-groups.json
  const rgContent = tryRead(join(dir, "resource-groups.json"));
  if (rgContent) {
    await prisma.configArtifact.create({
      data: {
        environmentId: env.id,
        type: "RESOURCE_GROUPS_JSON",
        name: "resource-groups.json",
        versions: {
          create: {
            version: 1,
            content: rgContent,
            isActive: true,
            createdBy: "auto-bootstrap",
            note: "Ortam oluşturulurken dosyadan içe aktarıldı",
          },
        },
      },
    });
    result.imported.push("resource-groups.json");
  } else {
    result.skipped.push("resource-groups.json");
  }

  // group-provider.txt → ConfigArtifact + AppGroup kayıtları
  const gpContent = tryRead(join(dir, "group-provider.txt"));
  if (gpContent) {
    await prisma.configArtifact.create({
      data: {
        environmentId: env.id,
        type: "GROUP_PROVIDER",
        name: "group-provider.txt",
        versions: {
          create: {
            version: 1,
            content: gpContent,
            isActive: true,
            createdBy: "auto-bootstrap",
            note: "Ortam oluşturulurken dosyadan içe aktarıldı",
          },
        },
      },
    });
    const groups = parseGroups(gpContent);
    for (const [name, members] of Object.entries(groups)) {
      await prisma.appGroup.create({
        data: {
          environmentId: env.id,
          name,
          members: { create: members.map((username) => ({ username })) },
        },
      });
    }
    result.imported.push(`group-provider.txt (${Object.keys(groups).length} grup)`);
  } else {
    result.skipped.push("group-provider.txt");
  }

  // password.db → PasswordEntry kayıtları
  const pwContent = tryRead(join(dir, "password.db"));
  if (pwContent) {
    const users = parsePasswordDb(pwContent);
    for (const { username, hash } of users) {
      await prisma.passwordEntry.create({
        data: { environmentId: env.id, username, passwordHash: hash, encoding: "BCRYPT" },
      });
    }
    result.imported.push(`password.db (${users.length} kullanıcı)`);
  } else {
    result.skipped.push("password.db");
  }

  // catalog/*.properties → CatalogConfig kayıtları
  const catalogDir = join(dir, "catalog");
  if (existsSync(catalogDir)) {
    const files = readdirSync(catalogDir).filter((f) => f.endsWith(".properties"));
    let catalogCount = 0;
    for (const file of files) {
      const content = tryRead(join(catalogDir, file));
      if (!content) continue;
      const props = parsePropertiesFile(content);
      const connector = props["connector.name"];
      if (!connector) continue;
      const name = file.replace(".properties", "");
      const { "connector.name": _c, ...rest } = props;
      await prisma.catalogConfig.create({
        data: { environmentId: env.id, name, connector, properties: rest },
      });
      catalogCount++;
    }
    if (catalogCount > 0) result.imported.push(`catalog (${catalogCount} katalog)`);
  }

  // SSH bağlantı testi + otomatik kayıt
  if (ssh) {
    try {
      const host = new URL(env.trinoBaseUrl!).hostname;
      const probe = await probeHost({
        host,
        ssh_user: ssh.sshUser || "ansible",
        ssh_password: ssh.sshPassword,
        ssh_private_key: ssh.sshPrivateKey,
      });
      if (probe.ok) {
        await saveSshConfig(env.id, {
          sshUser: ssh.sshUser || "ansible",
          sshPassword: ssh.sshPassword,
          privateKey: ssh.sshPrivateKey,
        });
        result.sshOk = true;
        result.sshMessage = "SSH bağlantısı başarılı — kimlik bilgileri kaydedildi.";
      } else {
        result.sshOk = false;
        result.sshMessage = probe.error;
      }
    } catch (e) {
      result.sshOk = false;
      result.sshMessage = `SSH testi başarısız: ${e instanceof Error ? e.message : "hata"}`;
    }
  }

  return result;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function createEnvironment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await ensureRole("CONFIG_EDITOR");
  if (denied) return denied;
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  }
  const rawPassword = formString(formData.get("trinoPassword")).trim();
  if (!rawPassword) return { ok: false, error: "Trino şifresi zorunlu" };

  const sshUser = formString(formData.get("sshUser")).trim();
  const sshPassword = formString(formData.get("sshPassword")).trim();
  const sshPrivateKey = formString(formData.get("sshPrivateKey")).trim();
  const ssh: SshInput =
    sshUser && (sshPassword || sshPrivateKey)
      ? { sshUser, sshPassword: sshPassword || undefined, sshPrivateKey: sshPrivateKey || undefined }
      : null;

  try {
    const actor = await getSessionActor();
    const env = await prisma.trinoEnvironment.create({
      data: {
        name: parsed.data.name,
        deliveryMode: parsed.data.deliveryMode,
        configTarget: parsed.data.configTarget,
        refreshPeriod: parsed.data.refreshPeriod ?? null,
        trinoBaseUrl: parsed.data.trinoBaseUrl,
        trinoUsername: parsed.data.trinoUsername,
        trinoPassword: encrypt(rawPassword),
      },
    });
    await recordAudit({
      action: "CREATE",
      entityType: "TrinoEnvironment",
      entityId: env.id,
      environmentId: env.id,
      actorUsername: actor.username,
      actorEmail: actor.email,
      after: { name: env.name, deliveryMode: env.deliveryMode, configTarget: env.configTarget, trinoBaseUrl: env.trinoBaseUrl, trinoUsername: env.trinoUsername },
    });
    const bootstrap = await bootstrapEnvironment(env, ssh);
    revalidatePath("/environments");
    return { ok: true, bootstrap };
  } catch {
    return { ok: false, error: "Kaydedilemedi — bu ad zaten kullanılıyor olabilir." };
  }
}

export async function updateEnvironment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await ensureRole("CONFIG_EDITOR");
  if (denied) return denied;
  const id = formString(formData.get("id"));
  if (!id) return { ok: false, error: "Kayıt bulunamadı" };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  }
  try {
    const before = await prisma.trinoEnvironment.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Ortam bulunamadı" };
    const rawPassword = formString(formData.get("trinoPassword")).trim();
    const actor = await getSessionActor();
    const env = await prisma.trinoEnvironment.update({
      where: { id },
      data: {
        name: parsed.data.name,
        deliveryMode: parsed.data.deliveryMode,
        configTarget: parsed.data.configTarget,
        refreshPeriod: parsed.data.refreshPeriod ?? null,
        trinoBaseUrl: parsed.data.trinoBaseUrl,
        trinoUsername: parsed.data.trinoUsername,
        // Only update password if a new value was submitted.
        ...(rawPassword ? { trinoPassword: encrypt(rawPassword) } : {}),
      },
    });
    await recordAudit({
      action: "UPDATE",
      entityType: "TrinoEnvironment",
      entityId: id,
      environmentId: id,
      actorUsername: actor.username,
      actorEmail: actor.email,
      before: { name: before.name, trinoBaseUrl: before.trinoBaseUrl, trinoUsername: before.trinoUsername },
      after: { name: env.name, trinoBaseUrl: env.trinoBaseUrl, trinoUsername: env.trinoUsername, passwordChanged: !!rawPassword },
    });
    revalidatePath("/environments");
    return { ok: true };
  } catch {
    return { ok: false, error: "Güncellenemedi — bu ad zaten kullanılıyor olabilir." };
  }
}

export async function deleteEnvironment(id: string): Promise<ActionResult> {
  const denied = await ensureRole("PLATFORM_ADMIN");
  if (denied) return denied;
  try {
    const before = await prisma.trinoEnvironment.findUnique({ where: { id } });
    if (!before || before.deletedAt) return { ok: false, error: "Ortam bulunamadı" };
    const actor = await getSessionActor();
    // Soft-delete: suffix the name so the unique constraint allows reuse.
    const deletedName = `${before.name}__deleted__${id.slice(-8)}`;
    await prisma.trinoEnvironment.update({
      where: { id },
      data: { deletedAt: new Date(), name: deletedName },
    });
    await recordAudit({
      action: "DELETE",
      entityType: "TrinoEnvironment",
      entityId: id,
      actorUsername: actor.username,
      actorEmail: actor.email,
      before: { name: before.name, trinoBaseUrl: before.trinoBaseUrl },
      after: { archived: true, archivedName: deletedName },
    });
    revalidatePath("/environments");
    return { ok: true };
  } catch {
    return { ok: false, error: "Silinemedi" };
  }
}
