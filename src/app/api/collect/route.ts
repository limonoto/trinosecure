import { NextResponse } from "next/server";
import { collectAll } from "@/lib/metrics/collector";

/**
 * Collector trigger endpoint (requirement 6.1). The standalone scheduler
 * (`npm run collect`) — or any cron/systemd timer — POSTs here on an interval to
 * pull metrics from every configured Trino environment.
 *
 * Auth: COLLECTOR_TOKEN env var is required in production (NODE_ENV=production).
 * In development it is optional; the endpoint is open when unset.
 * Token may be passed as ?token= query param or Authorization: Bearer header.
 * Proxy-exempt (see proxy.ts).
 */
function authorized(request: Request): boolean {
  const expected = process.env.COLLECTOR_TOKEN;
  if (!expected) {
    // Block open access in production even if the token was forgotten.
    return process.env.NODE_ENV !== "production";
  }
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("token") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return provided === expected;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await collectAll();
  return NextResponse.json(
    {
      environments: results.length,
      results: results.map((r) => ({ environmentId: r.environmentId, ...r.result })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
