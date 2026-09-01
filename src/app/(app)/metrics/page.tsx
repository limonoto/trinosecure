import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { resolveRange } from "@/lib/metrics/range";
import { bucketLabel, formatBytes } from "@/lib/metrics/labels";
import { RUNNING_STATES, QUEUED_STATES } from "@/lib/metrics/ingest";
import { fetchClusterLiveStats } from "@/lib/trino-api/client";
import { TimeRangeControl } from "@/components/time-range";
import { CollectButton } from "@/components/collect-button";
import { TimeSeries } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function StatCard({ label, value, tone }: Readonly<{ label: string; value: number | string; tone: string }>) {
  return (
    <Card>
      <CardContent>
        <div className={`text-3xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default async function MetricsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ range?: string; from?: string; to?: string }> }>) {
  const env = await getActiveEnvironment();
  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Cluster Sağlığı</h1>
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
  const full = await prisma.trinoEnvironment.findUnique({ where: { id: env.id } });
  const coordinatorId = full?.trinoBaseUrl ?? null;

  const liveStats = full?.trinoBaseUrl
    ? await fetchClusterLiveStats(full.trinoBaseUrl).catch(() => null)
    : null;

  const [metrics, nodeSamples, activeQueries] = await Promise.all([
    prisma.clusterMetric.findMany({
      where: { environmentId: env.id, ts: { gte: range.since, lte: range.until } },
      orderBy: { ts: "asc" },
    }),
    prisma.nodeMetric.findMany({
      where: { environmentId: env.id, ts: { gte: range.since, lte: range.until } },
      orderBy: { ts: "asc" },
    }),
    prisma.queryStat.findMany({
      where: { environmentId: env.id, state: { in: [...RUNNING_STATES, ...QUEUED_STATES] } },
      select: { resourceGroup: true, state: true },
      take: 5000,
    }),
  ]);
  const latest = metrics.at(-1);

  const series = metrics.map((m) => ({
    t: bucketLabel(m.ts.getTime(), range.ms),
    "Çalışan": m.runningQueries ?? 0,
    "Kuyrukta": m.queuedQueries ?? 0,
    "Bloke": m.blockedQueries ?? 0,
  }));

  const networkSeries = metrics.map((m) => ({
    t: bucketLabel(m.ts.getTime(), range.ms),
    "Shuffle (MB)": m.totalShuffledBytes ? Math.round(Number(m.totalShuffledBytes) / 1024 / 1024) : 0,
    "Giriş (MB)": m.totalInputBytes ? Math.round(Number(m.totalInputBytes) / 1024 / 1024) : 0,
  }));
  const lastNetSample = metrics.at(-1);

  // Coordinator vs worker load (6.3.1): latest sample per node, split by role.
  const latestPerNode = new Map<string, (typeof nodeSamples)[number]>();
  for (const s of nodeSamples) latestPerNode.set(s.nodeId, s);
  const coord = coordinatorId ? latestPerNode.get(coordinatorId) : undefined;
  const workers = [...latestPerNode.values()].filter((s) => s.nodeId !== coordinatorId);
  const avg = (nums: (number | null)[]) => {
    const d = nums.filter((n): n is number => n !== null);
    return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
  };
  const workerCpu = avg(workers.map((w) => w.cpuPercent));
  const workerTasks = workers.reduce((sum, w) => sum + (w.activeTasks ?? 0), 0);

  // Resource-group concurrency (6.3.1): running/queued queries per RG right now.
  const rgConc = new Map<string, { running: number; queued: number }>();
  for (const q of activeQueries) {
    const key = q.resourceGroup && q.resourceGroup.trim() !== "" ? q.resourceGroup : "(bilinmiyor)";
    const e = rgConc.get(key) ?? { running: 0, queued: 0 };
    if (RUNNING_STATES.has(q.state)) e.running += 1;
    else if (QUEUED_STATES.has(q.state)) e.queued += 1;
    rgConc.set(key, e);
  }
  const rgConcRows = [...rgConc.entries()]
    .map(([group, v]) => ({ group, ...v }))
    .sort((a, b) => b.running + b.queued - (a.running + a.queued))
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{env.name} · {range.label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Cluster Sağlığı</h1>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeControl />
          <CollectButton />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Çalışan sorgu" value={latest?.runningQueries ?? 0} tone="text-primary" />
        <StatCard label="Kuyruktaki sorgu" value={latest?.queuedQueries ?? 0} tone="text-warning" />
        <StatCard label="Bloke sorgu" value={latest?.blockedQueries ?? 0} tone="text-destructive" />
        <StatCard label="Koordinatör" value={1} tone="text-info" />
        <StatCard label="Aktif worker" value={latest?.activeWorkers ?? 0} tone="text-info" />
      </div>

      {/* Network throughput summary (6.3.2) */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {formatBytes(lastNetSample?.totalShuffledBytes ? Number(lastNetSample.totalShuffledBytes) : null)}
            </div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              Worker-arası shuffle <span className="text-[11px]">· son örnek</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatBytes(lastNetSample?.totalInputBytes ? Number(lastNetSample.totalInputBytes) : null)}
            </div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              Depo okuma (I/O) <span className="text-[11px]">· son örnek</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Sorgu yükü (zaman serisi)</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeSeries
            data={series}
            area
            series={[
              { key: "Çalışan", label: "Çalışan" },
              { key: "Kuyrukta", label: "Kuyrukta" },
              { key: "Bloke", label: "Bloke" },
            ]}
          />
          {metrics.length === 0 && (
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              Bu aralıkta veri yok. “Şimdi topla” ile veri çekin veya <span className="font-mono">npm run collect</span> çalıştırın.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Network throughput time-series (6.3.2) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Ağ throughput (MB) — worker shuffle + depo I/O</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeSeries
            data={networkSeries}
            area
            series={[
              { key: "Shuffle (MB)", label: "Shuffle (worker↔worker)", color: "#f59e0b" },
              { key: "Giriş (MB)", label: "Depo okuma", color: "#6366f1" },
            ]}
          />
          {metrics.length === 0 && (
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              Henüz veri yok — "Şimdi topla" ile çekin.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Coordinator vs worker load (6.3.1) */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Koordinatör vs Worker yükü (son örnek)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-primary">{coord?.cpuPercent ?? "—"}{coord?.cpuPercent != null ? "%" : ""}</div>
              <div className="text-[13px] text-muted-foreground">Koordinatör CPU</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-info">{workerCpu ?? "—"}{workerCpu != null ? "%" : ""}</div>
              <div className="text-[13px] text-muted-foreground">Worker ort. CPU ({workers.length})</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-muted-foreground">{coord?.activeTasks ?? "—"}</div>
              <div className="text-[13px] text-muted-foreground">Koordinatör task</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-warning">{workerTasks}</div>
              <div className="text-[13px] text-muted-foreground">Worker toplam task</div>
            </div>
          </div>
          {latestPerNode.size === 0 && (
            <p className="mt-2 text-[12px] text-muted-foreground">Düğüm metriği yok — “Şimdi topla” ile çekin.</p>
          )}
        </CardContent>
      </Card>

      {/* Live cluster stats from /v1/query */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Canlı Cluster İstatistikleri (şu an)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-primary">{liveStats?.runningQueries ?? "—"}</div>
              <div className="text-[13px] text-muted-foreground">Çalışan sorgu</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-warning">{liveStats?.queuedQueries ?? "—"}</div>
              <div className="text-[13px] text-muted-foreground">Kuyrukta</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-info">{liveStats?.runningDrivers ?? "—"}</div>
              <div className="text-[13px] text-muted-foreground">Çalışan driver</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-destructive">{liveStats?.blockedDrivers ?? "—"}</div>
              <div className="text-[13px] text-muted-foreground">Bloke driver</div>
            </div>
            <div>
              <div className="text-xl font-semibold tabular-nums text-muted-foreground">
                {liveStats ? liveStats.processedInputRows.toLocaleString("tr-TR") : "—"}
              </div>
              <div className="text-[13px] text-muted-foreground">İşlenen satır (aktif)</div>
            </div>
            <div>
              <div className="text-xl font-semibold tabular-nums text-muted-foreground">
                {liveStats ? formatBytes(liveStats.physicalInputBytes) : "—"}
              </div>
              <div className="text-[13px] text-muted-foreground">Fiziksel input (aktif)</div>
            </div>
            <div>
              <div className="text-xl font-semibold tabular-nums text-muted-foreground">
                {liveStats ? formatBytes(liveStats.reservedMemoryBytes) : "—"}
              </div>
              <div className="text-[13px] text-muted-foreground">Rezerve bellek</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-muted-foreground">{liveStats?.blockedQueries ?? "—"}</div>
              <div className="text-[13px] text-muted-foreground">Bloke sorgu</div>
            </div>
          </div>
          {!liveStats && (
            <p className="mt-2 text-[12px] text-muted-foreground">Trino API adresi tanımlı değil veya erişilemiyor.</p>
          )}
        </CardContent>
      </Card>

      {/* Resource-group concurrency (6.3.1) */}
      <Card className="mt-4 gap-0 py-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Resource group concurrency (şu an)</div>
        {rgConcRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Şu an çalışan/kuyrukta sorgu yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource group</TableHead>
                <TableHead>Çalışan</TableHead>
                <TableHead>Kuyrukta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rgConcRows.map((r) => (
                <TableRow key={r.group}>
                  <TableCell className="font-mono text-[13px]">{r.group}</TableCell>
                  <TableCell><Badge variant="info">{r.running}</Badge></TableCell>
                  <TableCell>{r.queued > 0 ? <Badge variant="warning">{r.queued}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
