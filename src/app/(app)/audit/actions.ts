"use server";

import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import type { AuditEntry } from "./audit-client";

const PAGE_SIZE = 200;

function mapRow(l: {
  id: string;
  actorUsername: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  trinoEnvName: string | null;
  trinoBaseUrl: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}): AuditEntry {
  return {
    id: l.id,
    actorUsername: l.actorUsername,
    actorEmail: l.actorEmail,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    trinoEnvName: l.trinoEnvName,
    trinoBaseUrl: l.trinoBaseUrl,
    before: l.before,
    after: l.after,
    createdAt: l.createdAt.toISOString(),
  };
}

/** Fetch the next page of audit entries (cursor-based, newest first). */
export async function loadMoreAuditEntries(
  cursor: string | null,
  actionFilter: string,
  entityFilter: string,
): Promise<{ entries: AuditEntry[]; nextCursor: string | null }> {
  const env = await getActiveEnvironment();
  if (!env) return { entries: [], nextCursor: null };

  const rows = await prisma.auditLog.findMany({
    where: {
      environmentId: env.id,
      ...(actionFilter ? { action: actionFilter as never } : {}),
      ...(entityFilter ? { entityType: entityFilter } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  const nextCursor =
    rows.length === PAGE_SIZE ? rows[rows.length - 1].createdAt.toISOString() : null;

  return { entries: rows.map(mapRow), nextCursor };
}

/** Export all matching audit log entries as a CSV string. */
export async function exportAuditCsv(
  actionFilter: string,
  entityFilter: string,
  actorSearch: string,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };

  const rows = await prisma.auditLog.findMany({
    where: {
      environmentId: env.id,
      ...(actionFilter ? { action: actionFilter as never } : {}),
      ...(entityFilter ? { entityType: entityFilter } : {}),
      ...(actorSearch
        ? {
            OR: [
              { actorUsername: { contains: actorSearch, mode: "insensitive" } },
              { actorEmail: { contains: actorSearch, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  const header = "Zaman,Aktör,E-posta,Aksiyon,Varlık Türü,Varlık ID,Ortam,Trino URL\n";
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      escape(r.actorUsername),
      escape(r.actorEmail ?? ""),
      r.action,
      r.entityType,
      r.entityId,
      escape(r.trinoEnvName ?? ""),
      escape(r.trinoBaseUrl ?? ""),
    ].join(","),
  );

  return { ok: true, csv: header + lines.join("\n") };
}
