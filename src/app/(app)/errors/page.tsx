import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { resolveRange } from "@/lib/metrics/range";
import { bucketCounts, topCounts } from "@/lib/metrics/aggregate";
import { bucketLabel } from "@/lib/metrics/labels";
import { TimeRangeControl } from "@/components/time-range";
import { CollectButton } from "@/components/collect-button";
import { TimeSeries, Bars } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ErrorsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ range?: string; from?: string; to?: string; type?: string; user?: string; group?: string }>;
}>) {
  const env = await getActiveEnvironment();
  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Hatalar</h1>
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
  const typeFilter = sp.type ?? "";
  const userFilter = sp.user ?? "";
  const groupFilter = sp.group ?? "";

  // Compose an /errors href preserving the time range, toggling one filter (6.5.3).
  const hrefWith = (over: { type?: string; user?: string; group?: string }) => {
    const p = new URLSearchParams();
    if (range.key === "custom") {
      p.set("from", range.since.toISOString());
      p.set("to", range.until.toISOString());
    } else {
      p.set("range", range.key);
    }
    const type = over.type ?? typeFilter;
    const user = over.user ?? userFilter;
    const group = over.group ?? groupFilter;
    if (type) p.set("type", type);
    if (user) p.set("user", user);
    if (group) p.set("group", group);
    return `/errors?${p.toString()}`;
  };

  const [failed, allInRange] = await Promise.all([
    prisma.queryStat.findMany({
      where: {
        environmentId: env.id,
        errorType: typeFilter ? typeFilter : { not: null },
        ...(userFilter ? { username: userFilter } : {}),
        ...(groupFilter ? { resourceGroup: groupFilter } : {}),
        createTime: { gte: range.since, lte: range.until },
      },
      orderBy: { createTime: "desc" },
      take: 3000,
    }),
    // All queries in range (density/rate denominator, requirement 6.2.2).
    prisma.queryStat.findMany({
      where: { environmentId: env.id, createTime: { gte: range.since, lte: range.until } },
      select: { createTime: true },
      take: 20000,
    }),
  ]);

  const byType = topCounts(failed.map((q) => q.errorType));
  const byUser = topCounts(failed.map((q) => q.username));
  const byGroup = topCounts(failed.map((q) => q.resourceGroup));
  const allTypes = topCounts(failed.map((q) => q.errorType), 20).map((t) => t.name);
  const topUsers = byUser.filter((u) => u.name !== "(bilinmiyor)").slice(0, 10).map((u) => u.name);
  const topGroups = byGroup.filter((g) => g.name !== "(bilinmiyor)").slice(0, 10).map((g) => g.name);

  const failedBuckets = bucketCounts(failed.map((q) => q.createTime.getTime()), range.since.getTime(), range.until.getTime(), range.bucketMs);
  const totalBuckets = bucketCounts(allInRange.map((q) => q.createTime.getTime()), range.since.getTime(), range.until.getTime(), range.bucketMs);
  const series = failedBuckets.map((b) => ({ t: bucketLabel(b.start, range.ms), "Hata": b.value }));
  // Error density = errors / total queries per bucket (%), the cluster-wide error rate (6.2.2).
  const rateSeries = failedBuckets.map((b, i) => {
    const total = totalBuckets[i]?.value ?? 0;
    return { t: bucketLabel(b.start, range.ms), "Hata oranı %": total > 0 ? Math.round((b.value / total) * 100) : 0 };
  });
  const overallRate = allInRange.length > 0 ? Math.round((failed.length / allInRange.length) * 100) : 0;

  const recent = failed.slice(0, 30);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{env.name} · {range.label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hatalar & Failure</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam <span className="font-semibold tabular-nums text-foreground">{failed.length}</span> hatalı sorgu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeControl />
          <CollectButton />
        </div>
      </div>

      {/* Filters: error type · user · resource group (requirement 6.5.3) */}
      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tip</span>
          <Badge variant={typeFilter === "" ? "primarySoft" : "neutral"} render={<Link href={hrefWith({ type: "" })} />}>
            tümü
          </Badge>
          {allTypes.map((t) => (
            <Badge key={t} variant={typeFilter === t ? "primarySoft" : "neutral"} render={<Link href={hrefWith({ type: t })} />}>
              {t}
            </Badge>
          ))}
        </div>
        {(topUsers.length > 0 || userFilter) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kullanıcı</span>
            <Badge variant={userFilter === "" ? "info" : "neutral"} render={<Link href={hrefWith({ user: "" })} />}>tümü</Badge>
            {topUsers.map((u) => (
              <Badge key={u} variant={userFilter === u ? "info" : "neutral"} render={<Link href={hrefWith({ user: u })} />}>
                {u}
              </Badge>
            ))}
          </div>
        )}
        {(topGroups.length > 0 || groupFilter) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Grup</span>
            <Badge variant={groupFilter === "" ? "primarySoft" : "neutral"} render={<Link href={hrefWith({ group: "" })} />}>tümü</Badge>
            {topGroups.map((g) => (
              <Badge key={g} variant={groupFilter === g ? "primarySoft" : "neutral"} render={<Link href={hrefWith({ group: g })} />}>
                {g}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Hata sayısı (zaman serisi)</CardTitle></CardHeader>
          <CardContent>
            <TimeSeries data={series} area series={[{ key: "Hata", label: "Hata", color: "#f06262" }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="grid-cols-[1fr_auto] items-center">
            <CardTitle className="text-sm">Hata yoğunluğu (oran %)</CardTitle>
            <Badge variant={overallRate >= 20 ? "destructive" : overallRate >= 5 ? "warning" : "neutral"}>
              genel %{overallRate}
            </Badge>
          </CardHeader>
          <CardContent>
            <TimeSeries data={rateSeries} area series={[{ key: "Hata oranı %", label: "Hata oranı %", color: "#f5a524" }]} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tipe göre</CardTitle></CardHeader>
          <CardContent><Bars data={byType} multicolor height={220} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Kullanıcıya göre</CardTitle></CardHeader>
          <CardContent><Bars data={byUser} color="#38bdf8" height={220} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Resource group bazında</CardTitle></CardHeader>
          <CardContent><Bars data={byGroup} color="#f5a524" height={220} /></CardContent>
        </Card>
      </div>

      {/* Drill-down: recent failed queries */}
      <Card className="mt-4 gap-0 py-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Son hatalı sorgular</div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Bu aralıkta hata yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zaman</TableHead>
                <TableHead>Query ID</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Resource group</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="whitespace-nowrap text-[12px] text-muted-foreground">
                    {q.createTime.toLocaleString("tr-TR")}
                  </TableCell>
                  <TableCell className="font-mono text-[12px]">
                    <Link href={`/queries/${encodeURIComponent(q.queryId)}`} className="text-primary hover:underline">
                      {q.queryId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-[13px]">{q.username ?? "—"}</TableCell>
                  <TableCell><Badge variant="destructive">{q.errorType}</Badge></TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{q.errorCode ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{q.resourceGroup ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
