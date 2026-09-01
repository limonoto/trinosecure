"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { ensureRole } from "@/lib/authz";
import { getActiveEnvironment } from "@/lib/environment-context";
import { getRulesContent } from "@/lib/rules/service";
import { diffLines, diffStats, type DiffLine } from "@/lib/rules/diff";
import { fetchNodes, fetchInfo } from "@/lib/trino-api/client";
import {
  generateInventory,
  generatePlaybook,
  generateVerifyPlaybook,
  type AnsibleFile,
  type ExpectedFile,
} from "@/lib/deploy/ansible";
import { destinationFor } from "@/lib/deploy/publish";
import { executePlaybook, isRunnerHealthy } from "@/lib/deploy/runner-client";
import { getSshCredentials, getSshConfigPublic, type SshConfigPublic } from "@/lib/deploy/ssh-config";
import {
  sha256Hex,
  nodeVersionConsistency,
  type NodeInfo,
  type VersionConsistency,
} from "@/lib/deploy/consistency";
import { getActiveArtifactContent } from "@/lib/config-artifact";
import { formatPasswordDb } from "@/lib/passwords/format";
import { formatGroupProviderFile } from "@/lib/group-provider/format";
import { toCatalogProperties } from "@/lib/catalogs/connectors";
import { buildFileMap, fileMapToAnsibleFiles, fileMapToExpectedFiles } from "@/lib/deploy/file-map";
import { decrypt } from "@/lib/crypto";

export type DriftResult =
  | { ok: true; mode: "HTTP" | "FILE"; inSync: boolean; message: string; diff: DiffLine[] }
  | { ok: false; error: string };

export type DiscoverResult = { ok: true; count: number } | { ok: false; error: string };
export type ArtifactResult =
  | { ok: true; inventory: string; playbook: string }
  | { ok: false; error: string };

/** Compare the app's active rules.json against what the cluster actually has. */
export async function checkDrift(): Promise<DriftResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const expected = await getRulesContent(env.id);

  if (env.deliveryMode === "HTTP") {
    return {
      ok: true,
      mode: "HTTP",
      inSync: true,
      message: "HTTP modunda Trino, yayınlanan sürümü endpoint'ten periyodik çeker — otomatik senkron.",
      diff: [],
    };
  }

  // FILE mode: read the file Trino reads and diff against the active version.
  try {
    const actual = await readFile(env.configTarget, "utf8");
    const diff = diffLines(actual, expected);
    const stats = diffStats(diff);
    const inSync = stats.added === 0 && stats.removed === 0;
    return {
      ok: true,
      mode: "FILE",
      inSync,
      message: inSync
        ? "Dosya, yayınlanan sürümle birebir aynı."
        : `Sapma: ${stats.added} eklenecek, ${stats.removed} kaldırılacak satır.`,
      diff: inSync ? [] : diff,
    };
  } catch {
    return {
      ok: true,
      mode: "FILE",
      inSync: false,
      message: `Hedef dosya okunamadı (${env.configTarget}) — dağıtılmamış olabilir.`,
      diff: [],
    };
  }
}

/** Discover cluster nodes via the Trino REST API and update the inventory. */
export async function discoverNodes(): Promise<DiscoverResult> {
  const active = await getActiveEnvironment();
  if (!active) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", active.id);
  if (denied) return denied;
  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env?.trinoBaseUrl) {
    return { ok: false, error: "Bu ortam için Trino API adresi (trinoBaseUrl) tanımlı değil." };
  }

  try {
    const actor = await getSessionActor();
    const trinoAuth =
      env.trinoUsername && env.trinoPassword
        ? { username: env.trinoUsername, password: decrypt(env.trinoPassword) }
        : undefined;

    const [nodes, info] = await Promise.all([
      fetchNodes(env.trinoBaseUrl, undefined, trinoAuth),
      fetchInfo(env.trinoBaseUrl, undefined, trinoAuth).catch(() => null),
    ]);

    const seen = new Set<string>();
    // Coordinator (the base URL we talk to).
    await prisma.trinoNode.upsert({
      where: { environmentId_nodeId: { environmentId: env.id, nodeId: env.trinoBaseUrl } },
      create: { environmentId: env.id, nodeId: env.trinoBaseUrl, host: env.trinoBaseUrl, type: "COORDINATOR", lastSeen: new Date() },
      update: { type: "COORDINATOR", lastSeen: new Date() },
    });
    seen.add(env.trinoBaseUrl);

    for (const node of nodes) {
      if (!node.uri || seen.has(node.uri)) continue;
      seen.add(node.uri);
      await prisma.trinoNode.upsert({
        where: { environmentId_nodeId: { environmentId: env.id, nodeId: node.uri } },
        create: { environmentId: env.id, nodeId: node.uri, host: node.uri, type: "WORKER", lastSeen: new Date() },
        update: { host: node.uri, lastSeen: new Date() },
      });
    }

    await recordAudit({
      action: "UPDATE",
      actorUsername: actor.username, actorEmail: actor.email,
      entityType: "TrinoNode",
      entityId: env.id,
      environmentId: env.id,
      trinoEnvName: env.name,
      trinoBaseUrl: env.trinoBaseUrl,
      after: { discovered: seen.size, version: info?.version },
    });
    revalidatePath("/deploy");
    return { ok: true, count: seen.size };
  } catch (e) {
    return { ok: false, error: `Trino API'ye ulaşılamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}` };
  }
}

export type NodeCheck = {
  host: string;
  type: "COORDINATOR" | "WORKER";
  reachable: boolean;
  version: string | null;
  environment: string | null;
  lastSeen: string | null;
};

export type ExpectedFileReport = { name: string; dest: string; sha256: string };

export type ConsistencyResult =
  | {
      ok: true;
      mode: "HTTP" | "FILE";
      configMessage: string;
      nodes: NodeCheck[];
      version: VersionConsistency;
      expectedFiles: ExpectedFileReport[];
      users: string[];
      groups: { name: string; members: string[] }[];
      verifyPlaybook: string | null;
    }
  | { ok: false; error: string };

/**
 * Verify the cluster is consistent (requirements 2.3 + 5.3): every node reachable
 * on the same version, each managed config file identical across nodes (by SHA-256),
 * and the user/group set uniform. The per-node config equality is enforced by the
 * generated verify playbook (FILE mode) or by the single shared endpoint (HTTP mode).
 */
export async function verifyConsistency(): Promise<ConsistencyResult> {
  const active = await getActiveEnvironment();
  if (!active) return { ok: false, error: "Ortam yok" };
  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env) return { ok: false, error: "Ortam bulunamadı" };

  const inventory = await prisma.trinoNode.findMany({
    where: { environmentId: env.id },
    orderBy: [{ type: "asc" }, { host: "asc" }],
  });

  // Probe each node's /v1/info for reachability + version + environment.
  const nodes: NodeCheck[] = await Promise.all(
    inventory.map(async (n) => {
      const info = await fetchInfo(n.host).catch(() => null);
      return {
        host: n.host,
        type: n.type,
        reachable: info !== null,
        version: info?.version ?? null,
        environment: info?.environment ?? null,
        lastSeen: n.lastSeen?.toISOString() ?? null,
      };
    }),
  );
  const version = nodeVersionConsistency(
    nodes.map<NodeInfo>((n) => ({ host: n.host, reachable: n.reachable, version: n.version, environment: n.environment })),
  );

  // Render every managed config file and hash it — the unit of cross-node equality.
  const [rules, resourceGroups, groups, passwords, catalogs,
    accessControl, authProps, rgProps, gpProps] = await Promise.all([
    getRulesContent(env.id),
    getActiveArtifactContent(env.id, "RESOURCE_GROUPS_JSON", "resource-groups.json"),
    prisma.appGroup.findMany({ where: { environmentId: env.id }, include: { members: { select: { username: true } } } }),
    prisma.passwordEntry.findMany({ where: { environmentId: env.id }, select: { username: true, passwordHash: true } }),
    prisma.catalogConfig.findMany({ where: { environmentId: env.id } }),
    getActiveArtifactContent(env.id, "ACCESS_CONTROL_PROPERTIES", "access-control.properties"),
    getActiveArtifactContent(env.id, "AUTH_PROPERTIES", "password-authenticator.properties"),
    getActiveArtifactContent(env.id, "RESOURCE_GROUPS_PROPERTIES", "resource-groups.properties"),
    getActiveArtifactContent(env.id, "GROUP_PROVIDER_PROPERTIES", "group-provider.properties"),
  ]);

  const expectedFiles: ExpectedFileReport[] = [];
  const add = (name: string, type: Parameters<typeof destinationFor>[1], content: string | null) => {
    if (content && content.trim() !== "") {
      expectedFiles.push({ name, dest: destinationFor(env.configTarget, type, name), sha256: sha256Hex(content) });
    }
  };
  add("rules.json", "RULES_JSON", rules);
  add("resource-groups.json", "RESOURCE_GROUPS_JSON", resourceGroups);
  add(
    "group-provider.txt",
    "GROUP_PROVIDER",
    formatGroupProviderFile(groups.map((g) => ({ name: g.name, members: g.members.map((m) => m.username) }))),
  );
  add("password.db", "PASSWORD_DB", formatPasswordDb(passwords));
  for (const c of catalogs) {
    add(`${c.name}.properties`, "CATALOG_PROPERTIES", toCatalogProperties(c.connector, (c.properties as Record<string, string>) ?? {}));
  }
  add("access-control.properties", "ACCESS_CONTROL_PROPERTIES", accessControl);
  add("password-authenticator.properties", "AUTH_PROPERTIES", authProps);
  add("resource-groups.properties", "RESOURCE_GROUPS_PROPERTIES", rgProps);
  add("group-provider.properties", "GROUP_PROVIDER_PROPERTIES", gpProps);

  const verifyPlaybook =
    env.deliveryMode === "FILE" && expectedFiles.length > 0
      ? generateVerifyPlaybook(expectedFiles.map<ExpectedFile>((f) => ({ dest: f.dest, sha256: f.sha256 })))
      : null;

  const configMessage =
    env.deliveryMode === "HTTP"
      ? "HTTP modu: tüm node'lar aynı endpoint'ten okur — config tanım gereği özdeştir. Doğrulama playbook'u yalnızca FILE modunda gerekir."
      : "FILE modu: aşağıdaki doğrulama playbook'unu çalıştırın; her node'da dosya SHA-256'sını beklenen değerle karşılaştırır.";

  return {
    ok: true,
    mode: env.deliveryMode,
    configMessage,
    nodes,
    version,
    expectedFiles,
    users: passwords.map((p) => p.username).sort((a, b) => a.localeCompare(b)),
    groups: groups.map((g) => ({ name: g.name, members: g.members.map((m) => m.username) })),
    verifyPlaybook,
  };
}

// ─────────────────────── Runner status ───────────────────────────────────────

export type RunnerStatus =
  | { available: true; sshConfig: SshConfigPublic | null }
  | { available: false; error: string };

/** Check whether the ansible-runner sidecar is healthy and return SSH config metadata. */
export async function getRunnerStatus(): Promise<RunnerStatus> {
  const env = await getActiveEnvironment();
  if (!env) return { available: false, error: "Ortam yok" };

  const [healthy, sshConfig] = await Promise.all([
    isRunnerHealthy(),
    getSshConfigPublic(env.id),
  ]);

  if (!healthy) return { available: false, error: "ansible-runner servisi erişilemez" };
  return { available: true, sshConfig };
}

// ─────────────────────── Automated deployment ────────────────────────────────

export type RunResult =
  | { ok: true; runId: string; stdout: string }
  | { ok: false; error: string };

/**
 * Execute the distribution playbook automatically via the ansible-runner sidecar.
 * Resolves SSH credentials from the encrypted DB config, builds the inventory and
 * playbook, dispatches to the runner, and records the result as a DeploymentRun.
 */
export async function runAnsibleDeploy(restart: boolean): Promise<RunResult> {
  const active = await getActiveEnvironment();
  if (!active) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("PLATFORM_ADMIN", active.id);
  if (denied) return denied;

  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env) return { ok: false, error: "Ortam bulunamadı" };

  const sshCreds = await getSshCredentials(env.id);
  if (!sshCreds) return { ok: false, error: "SSH kimlik bilgisi tanımlı değil. Önce SSH yapılandırmasını kaydedin." };

  const nodes = await prisma.trinoNode.findMany({ where: { environmentId: env.id }, select: { host: true } });
  if (nodes.length === 0) return { ok: false, error: "Düğüm envanteri boş. Önce 'Düğümleri keşfet' ile düğümleri bulun." };

  const hosts = nodes.map((n) => n.host.replace(/^https?:\/\//, "").replace(/:\d+.*$/, ""));
  const fileMap = await buildFileMap(env.id);

  const actor = await getSessionActor();
  const inventory = generateInventory(hosts);
  const playbook = generatePlaybook(fileMapToAnsibleFiles(fileMap, env.configTarget), { restart });

  const run = await prisma.deploymentRun.create({
    data: { environmentId: env.id, type: "DISTRIBUTE", status: "RUNNING", triggeredBy: actor.username },
  });

  const result = await executePlaybook({
    inventory,
    playbook,
    files: fileMap,
    ssh_user: sshCreds.sshUser,
    ssh_password: sshCreds.sshPassword,
    ssh_private_key: sshCreds.sshPrivateKey,
  });

  const status = result.ok ? "SUCCESS" : "FAILED";
  const stdout = result.ok ? result.stdout : result.error;

  await prisma.deploymentRun.update({
    where: { id: run.id },
    data: { status, stdout, returnCode: result.ok ? result.returnCode : -1, completedAt: new Date() },
  });

  await recordAudit({
    action: "DEPLOY",
    actorUsername: actor.username, actorEmail: actor.email,
    entityType: "DeploymentRun",
    entityId: run.id,
    environmentId: env.id,
    trinoEnvName: env.name,
    trinoBaseUrl: env.trinoBaseUrl,
    after: { type: "DISTRIBUTE", status, restart },
  });

  revalidatePath("/deploy");

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, runId: run.id, stdout: result.stdout };
}

/**
 * Execute the verify playbook automatically — checks SHA-256 of every managed
 * config file on every node. Records the result as a DeploymentRun.
 */
export async function runAnsibleVerify(): Promise<RunResult> {
  const active = await getActiveEnvironment();
  if (!active) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("CONFIG_EDITOR", active.id);
  if (denied) return denied;

  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env) return { ok: false, error: "Ortam bulunamadı" };
  if (env.deliveryMode !== "FILE") {
    return { ok: false, error: "Doğrulama playbook'u yalnızca FILE modunda gereklidir." };
  }

  const sshCreds = await getSshCredentials(env.id);
  if (!sshCreds) return { ok: false, error: "SSH kimlik bilgisi tanımlı değil." };

  const nodes = await prisma.trinoNode.findMany({ where: { environmentId: env.id }, select: { host: true } });
  if (nodes.length === 0) return { ok: false, error: "Düğüm envanteri boş." };

  const hosts = nodes.map((n) => n.host.replace(/^https?:\/\//, "").replace(/:\d+.*$/, ""));
  const fileMap = await buildFileMap(env.id);

  const actor = await getSessionActor();
  const inventory = generateInventory(hosts);
  const playbook = generateVerifyPlaybook(fileMapToExpectedFiles(fileMap, env.configTarget));

  const run = await prisma.deploymentRun.create({
    data: { environmentId: env.id, type: "VERIFY", status: "RUNNING", triggeredBy: actor.username },
  });

  const result = await executePlaybook({
    inventory,
    playbook,
    files: {},
    ssh_user: sshCreds.sshUser,
    ssh_password: sshCreds.sshPassword,
    ssh_private_key: sshCreds.sshPrivateKey,
  });

  const status = result.ok ? "SUCCESS" : "FAILED";
  const stdout = result.ok ? result.stdout : result.error;

  await prisma.deploymentRun.update({
    where: { id: run.id },
    data: { status, stdout, returnCode: result.ok ? result.returnCode : -1, completedAt: new Date() },
  });

  await recordAudit({
    action: "DEPLOY",
    entityType: "DeploymentRun",
    entityId: run.id,
    actorUsername: actor.username, actorEmail: actor.email,
    environmentId: env.id,
    trinoEnvName: env.name,
    trinoBaseUrl: env.trinoBaseUrl,
    after: { type: "VERIFY", status },
  });

  revalidatePath("/deploy");

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, runId: run.id, stdout: result.stdout };
}

// ─────────────────────── Deployment history ──────────────────────────────────

export type DeploymentRunRow = {
  id: string;
  type: "DISTRIBUTE" | "VERIFY";
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  stdout: string | null;
  returnCode: number | null;
  triggeredBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type DeploymentRunsResult =
  | { ok: true; runs: DeploymentRunRow[] }
  | { ok: false; error: string };

export async function getDeploymentRuns(): Promise<DeploymentRunsResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };

  const rows = await prisma.deploymentRun.findMany({
    where: { environmentId: env.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    ok: true,
    runs: rows.map((r) => ({
      id: r.id,
      type: r.type as "DISTRIBUTE" | "VERIFY",
      status: r.status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED",
      stdout: r.stdout,
      returnCode: r.returnCode,
      triggeredBy: r.triggeredBy,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  };
}

// ─────────────────────── Config import via SSH ───────────────────────────────

export type ImportFromTrinoResult =
  | { ok: true; imported: string[]; skipped: string[]; errors: string[] }
  | { ok: false; error: string };

const RUNNER_URL_IMPORT = (process.env.ANSIBLE_RUNNER_URL ?? "http://ansible-runner:8000").replace(/\/$/, "");

function parseGroupProvider(content: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf(":");
    if (idx > 0) {
      result[t.slice(0, idx).trim()] = t.slice(idx + 1).split(",").map((m) => m.trim()).filter(Boolean);
    }
  }
  return result;
}

const SSH_SERVICE_USERS = new Set(["nizam"]);

function parsePasswordDbImport(content: string): Array<{ username: string; hash: string }> {
  return content.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => { const idx = l.indexOf(":"); return { username: l.slice(0, idx), hash: l.slice(idx + 1) }; })
    .filter(({ username }) => !SSH_SERVICE_USERS.has(username));
}

function parsePropertiesImport(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx > 0) result[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return result;
}

async function upsertArtifact(
  environmentId: string,
  type: "RULES_JSON" | "RESOURCE_GROUPS_JSON" | "GROUP_PROVIDER" | "ACCESS_CONTROL_PROPERTIES" | "AUTH_PROPERTIES" | "RESOURCE_GROUPS_PROPERTIES" | "GROUP_PROVIDER_PROPERTIES",
  name: string,
  content: string,
  createdBy: string,
) {
  const existing = await prisma.configArtifact.findUnique({
    where: { environmentId_type_name: { environmentId, type, name } },
  });

  if (!existing) {
    await prisma.configArtifact.create({
      data: {
        environmentId,
        type,
        name,
        versions: {
          create: { version: 1, content, isActive: true, createdBy, note: "SSH ile içe aktarıldı" },
        },
      },
    });
    return;
  }

  const maxVer = await prisma.configVersion.aggregate({
    where: { artifactId: existing.id },
    _max: { version: true },
  });
  const nextVersion = (maxVer._max.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.configVersion.updateMany({ where: { artifactId: existing.id, isActive: true }, data: { isActive: false } }),
    prisma.configVersion.create({
      data: { artifactId: existing.id, version: nextVersion, content, isActive: true, createdBy, note: "SSH ile içe aktarıldı" },
    }),
  ]);
}

/**
 * Connect to the Trino coordinator via SSH (using stored credentials) and import
 * all managed config files — rules.json, resource-groups.json, group-provider.txt,
 * password.db, catalog/*.properties — into the database.
 *
 * Existing versions are bumped (not overwritten); group/password/catalog records
 * are upserted so no data is silently deleted.
 */
export async function importConfigFromTrino(): Promise<ImportFromTrinoResult> {
  const active = await getActiveEnvironment();
  if (!active) return { ok: false, error: "Ortam yok" };
  const denied = await ensureRole("PLATFORM_ADMIN", active.id);
  if (denied) return denied;

  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env) return { ok: false, error: "Ortam bulunamadı" };

  // Resolve coordinator SSH hostname from node inventory or trinoBaseUrl.
  let coordHost: string | null = null;
  const coordNode = await prisma.trinoNode.findFirst({ where: { environmentId: env.id, type: "COORDINATOR" } });
  for (const src of [coordNode?.host, env.trinoBaseUrl]) {
    if (!src) continue;
    try {
      coordHost = new URL(src).hostname;
      break;
    } catch {
      const stripped = src.replace(/^https?:\/\//, "").replace(/:\d+.*$/, "").split("/")[0];
      if (stripped) { coordHost = stripped; break; }
    }
  }
  if (!coordHost) {
    return {
      ok: false,
      error: "Koordinatör sunucu bulunamadı. Önce 'Düğümleri keşfet' ile düğümleri bulun veya Trino API adresini tanımlayın.",
    };
  }

  const sshCreds = await getSshCredentials(env.id);
  if (!sshCreds) {
    return { ok: false, error: "SSH kimlik bilgisi tanımlı değil. Dağıtım sayfasından SSH yapılandırmasını ekleyin." };
  }

  let res: Response;
  try {
    res = await fetch(`${RUNNER_URL_IMPORT}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: coordHost,
        config_target: env.configTarget,
        ssh_user: sshCreds.sshUser,
        ssh_password: sshCreds.sshPassword,
        ssh_private_key: sshCreds.sshPrivateKey,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { ok: false, error: `ansible-runner'a ulaşılamadı: ${e instanceof Error ? e.message : "hata"}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Runner HTTP ${res.status}: ${text}` };
  }

  const data = (await res.json()) as { files: Record<string, string>; errors: Record<string, string> };
  const actor = await getSessionActor();
  const createdBy = actor.username;
  const imported: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // rules.json
  if (data.files["rules.json"]) {
    await upsertArtifact(env.id, "RULES_JSON", "rules.json", data.files["rules.json"], createdBy);
    imported.push("rules.json");
  } else if (data.errors["rules.json"]) {
    errors.push(`rules.json: ${data.errors["rules.json"]}`);
  } else skipped.push("rules.json");

  // resource-groups.json
  if (data.files["resource-groups.json"]) {
    await upsertArtifact(env.id, "RESOURCE_GROUPS_JSON", "resource-groups.json", data.files["resource-groups.json"], createdBy);
    imported.push("resource-groups.json");
  } else if (data.errors["resource-groups.json"]) {
    errors.push(`resource-groups.json: ${data.errors["resource-groups.json"]}`);
  } else skipped.push("resource-groups.json");

  // group-provider.txt → ConfigArtifact + AppGroup upsert
  if (data.files["group-provider.txt"]) {
    await upsertArtifact(env.id, "GROUP_PROVIDER", "group-provider.txt", data.files["group-provider.txt"], createdBy);
    const groups = parseGroupProvider(data.files["group-provider.txt"]);
    for (const [name, members] of Object.entries(groups)) {
      const group = await prisma.appGroup.upsert({
        where: { environmentId_name: { environmentId: env.id, name } },
        create: { environmentId: env.id, name },
        update: {},
      });
      for (const username of members) {
        await prisma.appGroupMember.upsert({
          where: { groupId_username: { groupId: group.id, username } },
          create: { groupId: group.id, username },
          update: {},
        });
      }
    }
    imported.push(`group-provider.txt (${Object.keys(groups).length} grup)`);
  } else if (data.errors["group-provider.txt"]) {
    errors.push(`group-provider.txt: ${data.errors["group-provider.txt"]}`);
  } else skipped.push("group-provider.txt");

  // password.db → PasswordEntry upsert
  if (data.files["password.db"]) {
    const users = parsePasswordDbImport(data.files["password.db"]);
    for (const { username, hash } of users) {
      await prisma.passwordEntry.upsert({
        where: { environmentId_username: { environmentId: env.id, username } },
        create: { environmentId: env.id, username, passwordHash: hash },
        update: { passwordHash: hash },
      });
    }
    imported.push(`password.db (${users.length} kullanıcı)`);
  } else if (data.errors["password.db"]) {
    errors.push(`password.db: ${data.errors["password.db"]}`);
  } else skipped.push("password.db");

  // .properties config files (access-control, password-authenticator, resource-groups, group-provider)
  const PROPS_FILES: Array<{ fname: string; type: "ACCESS_CONTROL_PROPERTIES" | "AUTH_PROPERTIES" | "RESOURCE_GROUPS_PROPERTIES" | "GROUP_PROVIDER_PROPERTIES" }> = [
    { fname: "access-control.properties", type: "ACCESS_CONTROL_PROPERTIES" },
    { fname: "password-authenticator.properties", type: "AUTH_PROPERTIES" },
    { fname: "resource-groups.properties", type: "RESOURCE_GROUPS_PROPERTIES" },
    { fname: "group-provider.properties", type: "GROUP_PROVIDER_PROPERTIES" },
  ];
  for (const { fname, type } of PROPS_FILES) {
    if (data.files[fname]) {
      await upsertArtifact(env.id, type, fname, data.files[fname], createdBy);
      imported.push(fname);
    } else if (data.errors[fname]) {
      errors.push(`${fname}: ${data.errors[fname]}`);
    } else skipped.push(fname);
  }

  // catalog/*.properties → CatalogConfig upsert
  const catalogFiles = Object.keys(data.files).filter(
    (n) => n.endsWith(".properties") && !PROPS_FILES.some((p) => p.fname === n),
  );
  for (const fname of catalogFiles) {
    const props = parsePropertiesImport(data.files[fname]);
    const connector = props["connector.name"];
    if (!connector) continue;
    const name = fname.replace(".properties", "");
    const { "connector.name": _c, ...rest } = props;
    await prisma.catalogConfig.upsert({
      where: { environmentId_name: { environmentId: env.id, name } },
      create: { environmentId: env.id, name, connector, properties: rest },
      update: { connector, properties: rest },
    });
  }
  if (catalogFiles.length > 0) imported.push(`catalog (${catalogFiles.length} katalog)`);

  await recordAudit({
    action: "IMPORT",
    entityType: "TrinoEnvironment",
    entityId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    environmentId: env.id,
    trinoEnvName: env.name,
    trinoBaseUrl: env.trinoBaseUrl,
    after: { source: "ssh", coordHost, trinoUsername: env.trinoUsername, imported, errorCount: errors.length },
  });

  revalidatePath("/");
  return { ok: true, imported, skipped, errors };
}

/** Generate an Ansible inventory + playbook for file-based distribution. */
export async function generateAnsibleArtifacts(restart: boolean): Promise<ArtifactResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };

  const nodes = await prisma.trinoNode.findMany({
    where: { environmentId: env.id },
    select: { host: true },
  });
  const hosts = nodes.map((n) => n.host.replace(/^https?:\/\//, "").replace(/:\d+.*$/, ""));

  // Which managed files exist for this environment → which to ship.
  const [hasRules, hasResourceGroups, hasGroupProvider, hasPasswords, catalogs,
    hasAccessControl, hasAuth, hasRgProps, hasGpProps] = await Promise.all([
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "RULES_JSON" } }),
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "RESOURCE_GROUPS_JSON" } }),
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "GROUP_PROVIDER" } }),
    prisma.passwordEntry.count({ where: { environmentId: env.id } }),
    prisma.catalogConfig.findMany({ where: { environmentId: env.id }, select: { name: true } }),
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "ACCESS_CONTROL_PROPERTIES" } }),
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "AUTH_PROPERTIES" } }),
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "RESOURCE_GROUPS_PROPERTIES" } }),
    prisma.configArtifact.count({ where: { environmentId: env.id, type: "GROUP_PROVIDER_PROPERTIES" } }),
  ]);

  const files: AnsibleFile[] = [];
  if (hasRules) files.push({ filename: "rules.json", dest: "/etc/trino/rules.json" });
  if (hasResourceGroups) files.push({ filename: "resource-groups.json", dest: "/etc/trino/resource-groups.json" });
  if (hasGroupProvider) files.push({ filename: "group-provider.txt", dest: "/etc/trino/group-provider.txt" });
  if (hasPasswords) files.push({ filename: "password.db", dest: "/etc/trino/password.db" });
  for (const c of catalogs) files.push({ filename: `${c.name}.properties`, dest: `/etc/trino/catalog/${c.name}.properties` });
  if (hasAccessControl) files.push({ filename: "access-control.properties", dest: "/etc/trino/access-control.properties" });
  if (hasAuth) files.push({ filename: "password-authenticator.properties", dest: "/etc/trino/password-authenticator.properties" });
  if (hasRgProps) files.push({ filename: "resource-groups.properties", dest: "/etc/trino/resource-groups.properties" });
  if (hasGpProps) files.push({ filename: "group-provider.properties", dest: "/etc/trino/group-provider.properties" });

  return {
    ok: true,
    inventory: generateInventory(hosts),
    playbook: generatePlaybook(files, { restart }),
  };
}
