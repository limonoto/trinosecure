import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { resolveRange } from "@/lib/metrics/range";
import { bucketLabel, formatBytes } from "@/lib/metrics/labels";
import { TimeRangeControl } from "@/components/time-range";
import { CollectButton } from "@/components/collect-button";
import { TimeSeries } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchNodeDetail, type TrinoNodeDetail } from "@/lib/trino-api/client";

function pct(used: number, max: number) {
  return max > 0 ? Math.round((used / max) * 100) : 0;
}

function Bar({ value, max, color = "bg-primary" }: Readonly<{ value: number; max: number; color?: string }>) {
  const p = pct(value, max);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  );
}

function NodeCard({ detail, role }: Readonly<{ detail: TrinoNodeDetail; role: "COORDINATOR" | "WORKER" }>) {
  const heapPct = pct(detail.heapUsedBytes, detail.heapMaxBytes);
  const poolPct = pct(detail.memPoolReservedBytes, detail.memPoolMaxBytes);
  const cpuColor = detail.cpuPercent > 80 ? "bg-destructive" : detail.cpuPercent > 50 ? "bg-warning" : "bg-primary";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-mono text-[13px] font-semibold">{detail.nodeId}</div>
            {detail.uptime && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">Uptime: {detail.uptime}</div>
            )}
          </div>
          <Badge variant={role === "COORDINATOR" ? "primarySoft" : "neutral"} className="shrink-0">
            {role === "COORDINATOR" ? "Koordinatör" : "Worker"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* CPU */}
        <div>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="text-muted-foreground">Process CPU</span>
            <span className="font-mono font-medium">{detail.cpuPercent}%</span>
          </div>
          <Bar value={detail.cpuPercent} max={100} color={cpuColor} />
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Sistem: {detail.systemCpuPercent}% · {detail.processors} çekirdek
          </div>
        </div>

        {/* Heap */}
        <div>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="text-muted-foreground">Heap</span>
            <span className="font-mono font-medium">
              {formatBytes(detail.heapUsedBytes)} / {formatBytes(detail.heapMaxBytes)} ({heapPct}%)
            </span>
          </div>
          <Bar value={detail.heapUsedBytes} max={detail.heapMaxBytes} color="bg-info" />
        </div>

        {/* Non-heap */}
        <div className="flex justify-between text-[12px]">
          <span className="text-muted-foreground">Non-heap</span>
          <span className="font-mono">{formatBytes(detail.nonHeapBytes)}</span>
        </div>

        {/* Memory pool */}
        <div>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="text-muted-foreground">Bellek havuzu</span>
            <span className="font-mono font-medium">
              {formatBytes(detail.memPoolReservedBytes)} / {formatBytes(detail.memPoolMaxBytes)} ({poolPct}%)
            </span>
          </div>
          <Bar value={detail.memPoolReservedBytes} max={detail.memPoolMaxBytes} color="bg-warning" />
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Serbest: {formatBytes(detail.memPoolFreeBytes)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function NodesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ range?: string; from?: string; to?: string }> }>) {
  const env = await getActiveEnvironment();
  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Düğümler</h1>
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
  const coordinatorUrl = full?.trinoBaseUrl ?? null;

  const [nodes, samples] = await Promise.all([
    prisma.trinoNode.findMany({ where: { environmentId: env.id }, orderBy: [{ type: "asc" }, { host: "asc" }] }),
    prisma.nodeMetric.findMany({
      where: { environmentId: env.id, ts: { gte: range.since, lte: range.until } },
      orderBy: { ts: "asc" },
    }),
  ]);

  // Latest sample per node for the comparative table.
  const perNode = new Map<string, (typeof samples)[number]>();
  for (const s of samples) perNode.set(s.nodeId, s);
  const nodeRows = [...perNode.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  // Coordinator vs worker split from nodeMetric.
  const coordSample = coordinatorUrl ? perNode.get(coordinatorUrl) : undefined;
  const workerSamples = [...perNode.values()].filter((s) => s.nodeId !== coordinatorUrl);

  const cpuSeries = samples.map((s) => ({ t: bucketLabel(s.ts.getTime(), range.ms), "CPU %": s.cpuPercent ?? 0 }));
  const heapSeries = samples.map((s) => ({
    t: bucketLabel(s.ts.getTime(), range.ms),
    "Heap (MB)": s.heapUsedBytes ? Math.round(Number(s.heapUsedBytes) / 1024 / 1024) : 0,
  }));

  // Network throughput from ClusterMetric (shuffledDataSize + physicalInputBytes).
  const clusterSamples = await prisma.clusterMetric.findMany({
    where: { environmentId: env.id, ts: { gte: range.since, lte: range.until } },
    orderBy: { ts: "asc" },
    select: { ts: true, totalShuffledBytes: true as true, totalInputBytes: true as true },
  });
  const shuffleSeries = clusterSamples.map((s) => ({
    t: bucketLabel(s.ts.getTime(), range.ms),
    "Shuffle (MB)": s.totalShuffledBytes ? Math.round(Number(s.totalShuffledBytes) / 1024 / 1024) : 0,
    "Giriş (MB)": s.totalInputBytes ? Math.round(Number(s.totalInputBytes) / 1024 / 1024) : 0,
  }));
  const lastShuffle = clusterSamples.at(-1);
  const totalShuffleBytes = lastShuffle?.totalShuffledBytes ? Number(lastShuffle.totalShuffledBytes) : null;
  const totalInputBytesVal = lastShuffle?.totalInputBytes ? Number(lastShuffle.totalInputBytes) : null;

  // Live node details — coordinator via HTTPS, workers via internal HTTP.
  const workerNodes = nodes.filter((n) => n.type === "WORKER");
  const [coordDetail, ...workerDetails] = await Promise.all([
    coordinatorUrl ? fetchNodeDetail(coordinatorUrl) : Promise.resolve(null),
    ...workerNodes.map((n) => fetchNodeDetail(n.host)),
  ]);

  const liveNodes: { detail: TrinoNodeDetail; role: "COORDINATOR" | "WORKER" }[] = [];
  if (coordDetail) liveNodes.push({ detail: coordDetail, role: "COORDINATOR" });
  workerDetails.forEach((d, i) => {
    if (d) liveNodes.push({ detail: d, role: "WORKER" });
    else if (workerNodes[i]) {
      // Unreachable worker — show placeholder
    }
  });

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{env.name} · {range.label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Düğüm Sağlığı</h1>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeControl />
          <CollectButton />
        </div>
      </div>

      {/* Özet stat kartları */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card><CardContent>
          <div className="text-3xl font-semibold tabular-nums text-primary">{coordSample?.cpuPercent ?? "—"}{coordSample?.cpuPercent != null ? "%" : ""}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Koordinatör CPU</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xl font-semibold tabular-nums text-info">{formatBytes(coordSample?.heapUsedBytes ? Number(coordSample.heapUsedBytes) : null)}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Koordinatör heap</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xl font-semibold tabular-nums text-muted-foreground">{formatBytes(coordSample?.nonHeapBytes ? Number(coordSample.nonHeapBytes) : null)}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Non-heap</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-3xl font-semibold tabular-nums text-info">{coordSample ? 1 : 0}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Koordinatör</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-3xl font-semibold tabular-nums text-warning">{workerSamples.length}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Aktif worker</div>
        </CardContent></Card>
      </div>

      {/* Ağ throughput kartları */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card><CardContent>
          <div className="text-xl font-semibold tabular-nums text-primary">{formatBytes(totalShuffleBytes)}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            Worker-arası ağ (shuffle) <span className="text-[11px]">· son örnek</span>
          </div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xl font-semibold tabular-nums text-info">{formatBytes(totalInputBytesVal)}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            Depodan okunan (I/O) <span className="text-[11px]">· son örnek</span>
          </div>
        </CardContent></Card>
      </div>

      {/* Canlı düğüm kartları */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Canlı Düğüm Durumu</h2>
        {liveNodes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              Düğüm verisi alınamadı. Trino API adresini ve ağ erişimini kontrol edin.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveNodes.map(({ detail, role }) => (
              <NodeCard key={detail.nodeId} detail={detail} role={role} />
            ))}
          </div>
        )}
      </div>

      {/* Zaman serisi grafikleri */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">CPU (%) — zaman serisi</CardTitle></CardHeader>
          <CardContent><TimeSeries data={cpuSeries} series={[{ key: "CPU %", label: "CPU %" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Heap kullanımı (MB) — zaman serisi</CardTitle></CardHeader>
          <CardContent><TimeSeries data={heapSeries} area series={[{ key: "Heap (MB)", label: "Heap (MB)", color: "#38bdf8" }]} /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">
              Ağ throughput (MB) — worker-arası shuffle + depo I/O
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeries
              data={shuffleSeries}
              area
              series={[
                { key: "Shuffle (MB)", label: "Shuffle (worker↔worker)", color: "#f59e0b" },
                { key: "Giriş (MB)", label: "Depo okuma", color: "#6366f1" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Düğüm karşılaştırma tablosu */}
      <Card className="mt-4 gap-0 py-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Düğüm karşılaştırması (son örnek)</div>
        {nodeRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Bu aralıkta düğüm metriği toplanmadı. "Şimdi topla" ile veri çekin.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Düğüm</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>CPU %</TableHead>
                <TableHead>Heap</TableHead>
                <TableHead>Non-heap</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodeRows.map((s) => {
                const isCoord = s.nodeId === coordinatorUrl;
                return (
                  <TableRow key={s.nodeId}>
                    <TableCell className="font-mono text-[12px]">{s.nodeId}</TableCell>
                    <TableCell>
                      <Badge variant={isCoord ? "primarySoft" : "neutral"}>
                        {isCoord ? "Koordinatör" : "Worker"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{s.cpuPercent ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatBytes(s.heapUsedBytes ? Number(s.heapUsedBytes) : null)}</TableCell>
                    <TableCell className="tabular-nums">{formatBytes(s.nonHeapBytes ? Number(s.nonHeapBytes) : null)}</TableCell>
                    <TableCell className="tabular-nums">{s.activeTasks ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{s.failedTasks ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Düğüm envanteri */}
      <Card className="mt-4 gap-0 py-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Düğüm envanteri</div>
        {nodes.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Düğüm yok — <Link href="/deploy" className="text-primary hover:underline">Dağıtım</Link> ekranından veya ilk veri toplama ile otomatik keşfedilir.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Düğüm ID</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Son görülme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-[12px]">{n.nodeId}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{n.host}</TableCell>
                  <TableCell>
                    <Badge variant={n.type === "COORDINATOR" ? "primarySoft" : "neutral"}>
                      {n.type === "COORDINATOR" ? "Koordinatör" : "Worker"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {n.lastSeen ? n.lastSeen.toLocaleString("tr-TR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
