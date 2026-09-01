import "dotenv/config";
import { Cron } from "croner";

/**
 * Standalone observability collector (requirement 6.1). A thin scheduler that
 * POSTs to the app's /api/collect endpoint on an interval; the route reuses the
 * app's Prisma client + Trino API client to pull metrics. Kept dependency-light
 * (no `@/` aliases) so it runs cleanly under `tsx` (`npm run collect`).
 *
 * Env: COLLECTOR_URL (default http://localhost:3110/api/collect),
 *      COLLECTOR_TOKEN (must match the app's), COLLECTOR_CRON (default every 30s).
 */
const url = process.env.COLLECTOR_URL ?? "http://localhost:3110/api/collect";
const token = process.env.COLLECTOR_TOKEN;
const schedule = process.env.COLLECTOR_CRON ?? "*/30 * * * * *";

async function tick(): Promise<void> {
  const stamp = new Date().toISOString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const body = (await res.json()) as unknown;
    console.log(`[collector] ${stamp} → HTTP ${res.status} ${JSON.stringify(body)}`);
  } catch (error) {
    console.error(`[collector] ${stamp} error:`, error instanceof Error ? error.message : error);
  }
}

console.log(`[collector] starting; schedule="${schedule}" url=${url}`);
new Cron(schedule, tick);
void tick();
