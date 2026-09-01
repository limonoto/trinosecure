import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { AuditClient, type AuditEntry } from "./audit-client";

const INITIAL_SIZE = 200;

export default async function AuditPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Denetim Günlüğü</h1>
        <div className="card mt-6 flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-sm text-muted-foreground">Önce bir ortam seçin veya oluşturun.</p>
          <Link href="/environments" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            Ortam ekle
          </Link>
        </div>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { environmentId: env.id },
    orderBy: { createdAt: "desc" },
    take: INITIAL_SIZE + 1,
  });

  const hasMore = logs.length > INITIAL_SIZE;
  const page = hasMore ? logs.slice(0, INITIAL_SIZE) : logs;

  const entries: AuditEntry[] = page.map((l) => ({
    id: l.id,
    actorUsername: l.actorUsername,
    actorEmail: l.actorEmail ?? null,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    trinoEnvName: l.trinoEnvName ?? null,
    trinoBaseUrl: l.trinoBaseUrl ?? null,
    before: l.before ?? null,
    after: l.after ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  const initialCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Denetim Günlüğü</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kim, neyi, ne zaman değiştirdi — hangi Trino bağlantısıyla, önceki/sonraki diff ile.
        </p>
      </div>
      <AuditClient entries={entries} initialCursor={initialCursor} />
    </div>
  );
}
