import { prisma } from "@/lib/db";
import { saveArtifactContent } from "@/lib/config-artifact";
import { formatPasswordDb, parsePasswordDb } from "./format";
import { detectEncoding } from "./hash";

/**
 * password.db versioning (requirement 4.1). Every mutation snapshots the rendered
 * file as a new ConfigVersion (type PASSWORD_DB) so the password file gains the
 * same history + rollback the other config files have. The snapshot stores only
 * hashes (never plaintext), so a rollback can fully re-materialize the entries.
 */

export const PASSWORD_DB_TYPE = "PASSWORD_DB" as const;
export const PASSWORD_DB_NAME = "password.db";

/** Render the current entries and store them as a new password.db version. */
export async function snapshotPasswordDb(environmentId: string): Promise<number> {
  const rows = await prisma.passwordEntry.findMany({
    where: { environmentId },
    select: { username: true, passwordHash: true },
  });
  const content = formatPasswordDb(rows);
  // audit=false: the calling action already records a richer entity-level audit.
  return saveArtifactContent(environmentId, PASSWORD_DB_TYPE, PASSWORD_DB_NAME, content, undefined, "UPDATE", false);
}

/** Replace all password entries from a stored password.db snapshot (rollback). */
export async function restorePasswordDb(environmentId: string, content: string): Promise<number> {
  const rows = parsePasswordDb(content);
  await prisma.$transaction([
    prisma.passwordEntry.deleteMany({ where: { environmentId } }),
    ...rows.map((r) =>
      prisma.passwordEntry.create({
        data: {
          environmentId,
          username: r.username,
          passwordHash: r.passwordHash,
          encoding: detectEncoding(r.passwordHash) ?? "BCRYPT",
        },
      }),
    ),
  ]);
  return rows.length;
}
