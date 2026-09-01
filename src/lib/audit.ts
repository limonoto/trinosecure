import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type RecordAuditInput = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorUsername: string;
  actorEmail?: string | null;
  environmentId?: string | null;
  trinoEnvName?: string | null;
  trinoBaseUrl?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUsername: input.actorUsername,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      environmentId: input.environmentId ?? null,
      trinoEnvName: input.trinoEnvName ?? null,
      trinoBaseUrl: input.trinoBaseUrl ?? null,
      before: toJson(input.before),
      after: toJson(input.after),
    },
  });
}

/**
 * Returns the authenticated web session user as the audit actor.
 * Falls back to "system" in contexts with no active session (e.g. collector).
 */
export async function getSessionActor(): Promise<{ username: string; email: string | null }> {
  try {
    const session = await auth();
    if (session?.user) {
      return {
        username: session.user.username ?? session.user.email ?? "system",
        email: session.user.email ?? null,
      };
    }
  } catch {
    // auth() may throw when called outside a request context (e.g. CLI collector)
  }
  return { username: "system", email: null };
}

/**
 * @deprecated Use getSessionActor() — this returns the Trino API username, not the web user.
 * Left for reference; all callers have been migrated.
 */
export async function getTrinoActor(environmentId: string): Promise<string> {
  const env = await prisma.trinoEnvironment.findUnique({
    where: { id: environmentId },
    select: { trinoUsername: true },
  });
  return env?.trinoUsername ?? "system";
}
