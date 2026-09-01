import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { resolveRange } from "@/lib/metrics/range";
import { resourceGroupPerformance } from "@/lib/metrics/aggregate";
import { formatMs } from "@/lib/metrics/labels";
import { getActiveArtifactContent } from "@/lib/config-artifact";
import { parseResourceGroups } from "@/lib/resource-groups/schema";
import { concurrencyLimits } from "@/lib/resource-groups/tree";
import { TimeRangeControl } from "@/components/time-range";
import { CollectButton } from "@/components/collect-button";
import { Bars } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Resource Group Performance dashboard (requirements 6.4.2 + 6.5.1). */
export default async function ResourcePerformancePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ range?: string; from?: string; to?: string }> }>) {
  const env = await getActiveEnvironment();
  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Resource Group Performansı</h1>
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

  const [queries, rgContent] = await Promise.all([
    prisma.queryStat.findMany({
      where: { environmentId: env.id, createTime: { gte: range.since, lte: range.until } },
      orderBy: { createTime: "desc" },
      take: 5000,
    }),
    getActiveArtifactContent(env.id, "RESOURCE_GROUPS_JSON", "resource-groups.json"),
  ]);

  const parsed = rgContent ? parseResourceGroups(rgContent) : null;
  const limits = parsed?.ok ? concurrencyLimits(parsed.doc.rootGroups) : new Map<string, number>();

  const rows = resourceGroupPerformance(
    queries.map((q) => ({
      resourceGroup: q.resourceGroup,
      state: q.state,
      elapsedMs: q.elapsedMs,
      errorType: q.errorType,
      errorCode: q.errorCode,
    })),
    limits,
  );

  const avgBars = rows.filter((r) => r.avgMs !== null).map((r) => ({ name: r.group, value: r.avgMs ?? 0 }));
  const satBars = rows.filter((r) => r.saturationPct !== null).map((r) => ({ name: r.group, value: r.saturationPct ?? 0 }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{env.name} · {range.label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Resource Group Performansı</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grup başına ortalama süre, concurrency doygunluğu (running / hard limit) ve limit aşımları.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeControl />
          <CollectButton />
        </div>
      </div>

      <Card className="mt-6 gap-0 py-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Grup metrikleri</div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            Bu aralıkta sorgu verisi yok. “Şimdi topla” ile veri çekin.
          </p>
        ) : (
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Resource group</TableHead>
                <TableHead>Ort. süre</TableHead>
                <TableHead>Çalışan</TableHead>
                <TableHead>Kuyrukta</TableHead>
                <TableHead>Hard limit</TableHead>
                <TableHead className="w-48">Doygunluk</TableHead>
                <TableHead>Limit aşımı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.group}>
                  <TableCell className="font-mono text-[13px]">{r.group}</TableCell>
                  <TableCell className="tabular-nums">{formatMs(r.avgMs)}</TableCell>
                  <TableCell className="tabular-nums">{r.running}</TableCell>
                  <TableCell className="tabular-nums">{r.queued}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{r.limit ?? "—"}</TableCell>
                  <TableCell>
                    {r.saturationPct === null ? (
                      <span className="text-[12px] text-muted-foreground">limit tanımsız</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className={r.saturationPct >= 100 ? "h-full bg-destructive" : r.saturationPct >= 80 ? "h-full bg-warning" : "h-full bg-info"}
                            style={{ width: `${Math.min(100, r.saturationPct)}%` }}
                          />
                        </div>
                        <span className="text-[12px] tabular-nums">%{r.saturationPct}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.exceeded > 0 ? <Badge variant="destructive">{r.exceeded}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Ortalama süre (ms)</CardTitle></CardHeader>
          <CardContent><Bars data={avgBars} color="#26d0b8" multicolor height={220} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Concurrency doygunluğu (%)</CardTitle></CardHeader>
          <CardContent><Bars data={satBars} color="#f5a524" height={220} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
