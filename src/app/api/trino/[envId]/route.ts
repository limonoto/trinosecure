import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRulesContent } from "@/lib/rules/service";

/**
 * Mode A (HTTP-served): the endpoint Trino's `security.config-file` points at.
 * Token-gated (per environment) and exempt from the app session proxy. Trino
 * polls this with `security.refresh-period`.
 *
 *   security.config-file=http://<host>:3110/api/trino/<envId>?token=<token>
 */
export async function GET(request: Request, { params }: { params: Promise<{ envId: string }> }) {
  const { envId } = await params;
  const env = await prisma.trinoEnvironment.findUnique({ where: { id: envId } });
  if (!env?.httpToken) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = url.searchParams.get("token") ?? headerToken ?? "";
  if (token !== env.httpToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const content = await getRulesContent(envId);
  return new NextResponse(content, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
