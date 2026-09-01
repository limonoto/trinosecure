import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { resolveActiveEnvironment, type EnvironmentSummary } from "@/lib/environments-shared";

export const ACTIVE_ENV_COOKIE = "ts-active-env";

/** All managed Trino environments — each is an independent installation. Excludes soft-deleted. */
export async function listEnvironments(): Promise<EnvironmentSummary[]> {
  const rows = await prisma.trinoEnvironment.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    configTarget: e.configTarget,
    deliveryMode: e.deliveryMode,
  }));
}

/** The environment id selected via the topbar (cookie), if any. */
export async function getActiveEnvironmentId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACTIVE_ENV_COOKIE)?.value;
}

/**
 * Active environment for pages/actions that operate on a single installation.
 * Everything scoped to a Trino install (groups, rules, audit) must filter by
 * this environment's id so installations stay fully independent.
 */
export async function getActiveEnvironment(): Promise<EnvironmentSummary | null> {
  const [environments, activeId] = await Promise.all([
    listEnvironments(),
    getActiveEnvironmentId(),
  ]);
  return resolveActiveEnvironment(environments, activeId);
}
