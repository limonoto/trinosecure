import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seeds deterministic e2e data. Run via tsx (so the generated Prisma client's
 * ESM/import.meta loads correctly) from global-setup. Only touches `e2e-*` rows.
 */
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await prisma.trinoEnvironment.deleteMany({ where: { name: { startsWith: "e2e-" } } });
    const env = await prisma.trinoEnvironment.create({
      data: { name: "e2e-main", deliveryMode: "HTTP", configTarget: "http://e2e-trino" },
    });
    mkdirSync("e2e/.artifacts", { recursive: true });
    writeFileSync("e2e/.artifacts/seed.json", JSON.stringify({ envId: env.id }));
    console.log("e2e seed OK:", env.id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
