/**
 * Seeds the Nizam database with the Docker Dev Cluster configuration.
 * Reads the actual files from cluster-trino/ so data is always in sync.
 *
 * Run: npx tsx prisma/seed.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const CLUSTER_DIR = join(__dirname, "../../cluster-trino/shared");
const ENV_NAME = "cluster-trino";
const ACTOR = "seed";

function readClusterFile(name: string): string {
  return readFileSync(join(CLUSTER_DIR, name), "utf8");
}

function parseGroups(content: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [group, members] = trimmed.split(":");
    if (group && members) {
      result[group.trim()] = members.split(",").map((m) => m.trim()).filter(Boolean);
    }
  }
  return result;
}

function parsePasswordDb(content: string): Array<{ username: string; hash: string }> {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf(":");
      return { username: l.slice(0, idx), hash: l.slice(idx + 1) };
    })
    .filter(({ username }) => username !== "nizam"); // servis hesabı UI'da gösterilmez
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    // ── 1. Environment ────────────────────────────────────────────────────────
    console.log(`\nEnvironment oluşturuluyor: "${ENV_NAME}"...`);
    await prisma.trinoEnvironment.deleteMany({ where: { name: ENV_NAME } });

    const env = await prisma.trinoEnvironment.create({
      data: {
        name: ENV_NAME,
        deliveryMode: "FILE",
        configTarget: join(CLUSTER_DIR, "rules.json"),
        refreshPeriod: "30s",
        trinoBaseUrl: "https://localhost:8090",
      },
    });
    console.log(`  OK — id: ${env.id}`);

    // ── 2. Gruplar + Üyeler ───────────────────────────────────────────────────
    console.log("\nGruplar oluşturuluyor...");
    const groupContent = readClusterFile("group-provider.txt");
    const groups = parseGroups(groupContent);

    const GROUP_DESCRIPTIONS: Record<string, string> = {
      admins: "Tam yetki — tüm kataloglara erişim, query kill/view",
      engineers: "Veri mühendisleri — memory ve tpch katalogları, ETL işlemleri",
      analysts: "Analiz ekibi — tpch okuma, bazı sütunlar maskelenmiş",
      readonly: "Salt okunur misafir erişimi — tpch tiny subset",
      etl_team: "ETL proje ekibi — airflow/pipeline kaynaklı sorgular",
      osint_team: "OSINT proje ekibi — çapraz katalog analiz",
    };

    for (const [name, members] of Object.entries(groups)) {
      const group = await prisma.appGroup.create({
        data: {
          environmentId: env.id,
          name,
          description: GROUP_DESCRIPTIONS[name] ?? null,
          members: {
            create: members.map((username) => ({ username })),
          },
        },
      });
      console.log(`  ${name}: ${members.join(", ")} → id: ${group.id}`);
    }

    // ── 3. Password kullanıcıları ────────────────────────────────────────────
    console.log("\nPassword kullanıcıları oluşturuluyor...");
    const pwContent = readClusterFile("password.db");
    const users = parsePasswordDb(pwContent);

    for (const { username, hash } of users) {
      await prisma.passwordEntry.create({
        data: { environmentId: env.id, username, passwordHash: hash, encoding: "BCRYPT" },
      });
      console.log(`  ${username}`);
    }

    // ── 4. Config Artifacts ──────────────────────────────────────────────────
    console.log("\nConfig artifact'ları oluşturuluyor...");

    const artifacts: Array<{
      type: "RULES_JSON" | "RESOURCE_GROUPS_JSON" | "GROUP_PROVIDER";
      name: string;
      file: string;
      note: string;
    }> = [
      {
        type: "RULES_JSON",
        name: "rules.json",
        file: "rules.json",
        note: "İlk içe aktarım — cluster-trino/shared/rules.json",
      },
      {
        type: "RESOURCE_GROUPS_JSON",
        name: "resource-groups.json",
        file: "resource-groups.json",
        note: "İlk içe aktarım — cluster-trino/shared/resource-groups.json",
      },
      {
        type: "GROUP_PROVIDER",
        name: "group-provider.txt",
        file: "group-provider.txt",
        note: "İlk içe aktarım — cluster-trino/shared/group-provider.txt",
      },
    ];

    for (const { type, name, file, note } of artifacts) {
      const content = readClusterFile(file);
      const artifact = await prisma.configArtifact.create({
        data: {
          environmentId: env.id,
          type,
          name,
          versions: {
            create: {
              version: 1,
              content,
              note,
              isActive: true,
              createdBy: ACTOR,
            },
          },
        },
      });
      console.log(`  ${type} → ${name} (${content.length} karakter) — id: ${artifact.id}`);
    }

    // ── 5. Kataloglar ────────────────────────────────────────────────────────
    console.log("\nKataloglar oluşturuluyor...");
    const catalogs = [
      { name: "tpch",   connector: "tpch",   properties: { "tpch.splits-per-node": "4" } },
      { name: "memory", connector: "memory", properties: { "memory.max-data-per-node": "512MB" } },
    ];
    for (const { name, connector, properties } of catalogs) {
      await prisma.catalogConfig.create({
        data: { environmentId: env.id, name, connector, properties },
      });
      console.log(`  ${name} (${connector})`);
    }

    // ── 6. Node kaydı ─────────────────────────────────────────────────────────
    console.log("\nNode'lar kaydediliyor...");
    const nodes = [
      { nodeId: "coord-01", host: "trino-coordinator:8443", type: "COORDINATOR" as const },
      { nodeId: "worker-01", host: "trino-worker-1:8080",  type: "WORKER" as const },
      { nodeId: "worker-02", host: "trino-worker-2:8080",  type: "WORKER" as const },
    ];
    for (const node of nodes) {
      await prisma.trinoNode.create({ data: { environmentId: env.id, ...node } });
      console.log(`  ${node.nodeId} (${node.type}) → ${node.host}`);
    }

    console.log("\n✓ Seed tamamlandı.");
    console.log(`  Environment: "${ENV_NAME}" (${env.id})`);
    console.log(`  Gruplar    : ${Object.keys(groups).join(", ")}`);
    console.log(`  Kullanıcılar: ${users.map((u) => u.username).join(", ")}`);
    console.log(`  Artifacts  : rules.json, resource-groups.json, group-provider.txt`);
    console.log(`  Kataloglar : tpch, memory`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
