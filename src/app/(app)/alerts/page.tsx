import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { AlertsClient, type RuleRow, type EventRow } from "./alerts-client";

export default async function AlertsPage() {
  const env = await getActiveEnvironment();
  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Alarmlar</h1>
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

  const [rules, events] = await Promise.all([
    prisma.alertRule.findMany({ where: { environmentId: env.id }, orderBy: { createdAt: "asc" } }),
    prisma.alertEvent.findMany({
      where: { rule: { environmentId: env.id } },
      orderBy: { ts: "desc" },
      take: 50,
      include: { rule: { select: { name: true } } },
    }),
  ]);

  // Latest status per rule (first occurrence in desc-ordered events).
  const latestStatus = new Map<string, string>();
  for (const e of events) if (!latestStatus.has(e.ruleId)) latestStatus.set(e.ruleId, e.status);

  const ruleRows: RuleRow[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    metric: r.metric,
    comparator: r.comparator,
    threshold: r.threshold,
    window: r.window,
    enabled: r.enabled,
    status: latestStatus.get(r.id) ?? null,
  }));

  const eventRows: EventRow[] = events.map((e) => ({
    id: e.id,
    rule: e.rule.name,
    status: e.status,
    value: e.value,
    ts: e.ts.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Alarmlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statik eşik ve dinamik anomali kuralları; her toplamada değerlendirilir.
        </p>
      </div>
      <AlertsClient rules={ruleRows} events={eventRows} />
    </div>
  );
}
