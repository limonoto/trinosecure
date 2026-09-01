import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import type { AuditAction, ConfigArtifactType } from "@/generated/prisma/enums";

/**
 * Generic versioned config-artifact storage — the same active-version + history +
 * rollback mechanism the rules.json service uses, reusable for any managed file
 * (group-provider, resource-groups, auth properties, …). Keeps every editor's
 * persistence consistent (Priority 2: the DB as a versioned backup of the files).
 */

/** The active content for an artifact, or null if none saved yet. */
export async function getActiveArtifactContent(
  environmentId: string,
  type: ConfigArtifactType,
  name: string,
): Promise<string | null> {
  const artifact = await prisma.configArtifact.findUnique({
    where: { environmentId_type_name: { environmentId, type, name } },
    include: { versions: { where: { isActive: true }, take: 1 } },
  });
  return artifact?.versions[0]?.content ?? null;
}

/** Save a new active version (previous active marked inactive). Returns the version number. */
export async function saveArtifactContent(
  environmentId: string,
  type: ConfigArtifactType,
  name: string,
  content: string,
  note?: string,
  auditAction: AuditAction = "UPDATE",
  audit = true,
): Promise<number> {
  const artifact = await prisma.configArtifact.upsert({
    where: { environmentId_type_name: { environmentId, type, name } },
    create: { environmentId, type, name },
    update: {},
  });

  const previous = await prisma.configVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: { version: true, content: true, isActive: true },
  });
  const version = (previous?.version ?? 0) + 1;
  const sessionActor = await getSessionActor();
  const createdBy = sessionActor.username;

  await prisma.$transaction([
    prisma.configVersion.updateMany({
      where: { artifactId: artifact.id, isActive: true },
      data: { isActive: false },
    }),
    prisma.configVersion.create({
      data: { artifactId: artifact.id, version, content, isActive: true, note: note ?? null, createdBy },
    }),
  ]);

  // Record the actual previous/next content (requirement 3.3 — before/after values),
  // not just the version number, so the audit log shows what really changed.
  // Callers that already write a richer entity-level audit (password.db, catalogs)
  // pass audit=false to avoid a duplicate row while still keeping the version.
  if (audit) {
    const before = previous?.content;
    await recordAudit({
      action: auditAction,
      entityType: "ConfigArtifact",
      entityId: artifact.id,
      actorUsername: createdBy,
      actorEmail: sessionActor.email,
      environmentId,
      before: before === undefined ? undefined : { type, name, version: previous?.version, content: before },
      after: { type, name, version, content },
    });
  }

  return version;
}
