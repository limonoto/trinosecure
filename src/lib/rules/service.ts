import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import type { AuditAction } from "@/generated/prisma/enums";
import { EMPTY_RULES, serializeRulesJson } from "./rules";

const RULES_NAME = "rules.json";

/** The active rules.json content for an environment (empty rules if none yet). */
export async function getRulesContent(environmentId: string): Promise<string> {
  const artifact = await prisma.configArtifact.findUnique({
    where: {
      environmentId_type_name: { environmentId, type: "RULES_JSON", name: RULES_NAME },
    },
    include: { versions: { where: { isActive: true }, take: 1 } },
  });
  return artifact?.versions[0]?.content ?? serializeRulesJson(EMPTY_RULES);
}

/**
 * Save a new active rules.json version for an environment. Previous active
 * version is marked inactive (so history + rollback stay intact). Returns the
 * new version number.
 */
export async function saveRulesContent(
  environmentId: string,
  content: string,
  note?: string,
  auditAction: AuditAction = "UPDATE",
): Promise<number> {
  const artifact = await prisma.configArtifact.upsert({
    where: {
      environmentId_type_name: { environmentId, type: "RULES_JSON", name: RULES_NAME },
    },
    create: { environmentId, type: "RULES_JSON", name: RULES_NAME },
    update: {},
  });

  const previous = await prisma.configVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: { version: true, content: true },
  });
  const version = (previous?.version ?? 0) + 1;

  // Resolve Trino context for the audit log; trinoUsername is the actor identity.
  const env = await prisma.trinoEnvironment.findUnique({
    where: { id: environmentId },
    select: { name: true, trinoBaseUrl: true, trinoUsername: true },
  });
  const sessionActor = await getSessionActor();
  const createdBy = sessionActor.username;

  await prisma.$transaction([
    prisma.configVersion.updateMany({
      where: { artifactId: artifact.id, isActive: true },
      data: { isActive: false },
    }),
    prisma.configVersion.create({
      data: {
        artifactId: artifact.id,
        version,
        content,
        isActive: true,
        note: note ?? null,
        createdBy,
      },
    }),
  ]);

  await recordAudit({
    action: auditAction,
    entityType: "ConfigArtifact",
    entityId: artifact.id,
    actorUsername: createdBy,
    actorEmail: sessionActor.email,
    environmentId,
    trinoEnvName: env?.name ?? null,
    trinoBaseUrl: env?.trinoBaseUrl ?? null,
    before: previous ? { version: previous.version, content: previous.content } : undefined,
    after: { version, content, trinoUsername: env?.trinoUsername },
  });

  return version;
}
