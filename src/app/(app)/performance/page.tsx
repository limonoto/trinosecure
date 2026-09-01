import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { resolveRange } from "@/lib/metrics/range";
import { average } from "@/lib/metrics/aggregate";
import { bucketLabel, formatMs } from "@/lib/metrics/labels";
import { TimeRangeControl } from "@/components/time-range";
import { CollectButton } from "@/components/collect-button";
import { TimeSeries, Bars } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({ label, value, tone }: Readonly<{ label: string; value: string; tone: string }>) {
  return (
    <Card>
      <CardContent>
        <div className={`text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default async function PerformancePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ range?: string; from?: string; to?: string }> }>) {
  const env = await getActiveEnvironment();
  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Performans</h1>
        <Card className="mt-6 items-center gap-3 p-12 text-center">
          <p className="text-sm text-muted-foreground">Önce bir ortam seçin veya oluşturun.</p>
          <Button size="sm" render={<Link href="/environments" />}>
            <Plus /> Ortam ekle
          </Button>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const range = resolveRange(sp.range, new Date(), { from: sp.from, to: sp.to });

  const finished = await prisma.queryStat.findMany({
    where: { environmentId: env.id, createTime: { gte: range.since, lte: range.until }, state: "FINISHED" },
    orderBy: { createTime: "asc" },
    take: 5000,
  });

  const avgElapsed = average(finished.map((q) => q.elapsedMs));
  const avgQueued = average(finished.map((q) => q.queuedMs));
  const avgExecution = average(finished.map((q) => q.executionMs));
  const avgPlanning = average(finished.map((q) => q.planningMs));

  const first = Math.floor(range.since.getTime() / range.bucketMs) * range.bucketMs;
  const byBucket = new Map<number, number[]>();
  for (const q of finished) {
    if (q.elapsedMs === null) continue;
    const start = Math.floor((q.createTime.getTime() - first) / range.bucketMs) * range.bucketMs + first;
    if (!byBucket.has(start)) byBucket.set(start, []);
    byBucket.get(start)!.push(q.elapsedMs);
  }
  const runtimeSeries = [...byBucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, vals]) => ({ t: bucketLabel(start, range.ms), "Ort. süre (ms)": average(vals) ?? 0 }));

  const byGroup = new Map<string, number[]>();
  for (const q of finished) {
    if (q.elapsedMs === null) continue;
    const key = q.resourceGroup ?? "(bilinmiyor)";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(q.elapsedMs);
  }
  const rgPerf = [...byGroup.entries()]
    .map(([name, vals]) => ({ name, value: average(vals) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{env.name} · {range.label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Performans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{finished.length}</span> tamamlanan sorgu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeControl />
          <CollectButton />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ort. çalışma süresi" value={formatMs(avgElapsed)} tone="text-primary" />
        <StatCard label="Ort. kuyruk bekleme" value={formatMs(avgQueued)} tone="text-warning" />
        <StatCard label="Ort. execution" value={formatMs(avgExecution)} tone="text-info" />
        <StatCard label="Ort. planning" value={formatMs(avgPlanning)} tone="text-success" />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Ortalama çalışma süresi (zaman serisi)</CardTitle></CardHeader>
        <CardContent><TimeSeries data={runtimeSeries} area series={[{ key: "Ort. süre (ms)", label: "Ort. süre (ms)" }]} /></CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Resource group performansı (ort. süre, ms)</CardTitle></CardHeader>
        <CardContent><Bars data={rgPerf} color="#26d0b8" multicolor /></CardContent>
      </Card>
    </div>
  );
}
