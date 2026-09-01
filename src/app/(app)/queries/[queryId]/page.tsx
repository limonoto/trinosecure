import Link from "next/link";
import { ArrowLeft, Server } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { fetchQueryDetail } from "@/lib/trino-api/client";
import { normalizeQueryDetail, type QueryDetail } from "@/lib/metrics/ingest";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function ms(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`;
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[13px]">{children}</p>
    </div>
  );
}

/** Query drill-down (requirement 6.2.3): full detail + the nodes that ran it. */
export default async function QueryDetailPage({ params }: Readonly<{ params: Promise<{ queryId: string }> }>) {
  const { queryId: raw } = await params;
  const queryId = decodeURIComponent(raw);
  const env = await getActiveEnvironment();

  // Prefer live detail from /v1/query/{queryId}; fall back to the stored sample.
  let detail: QueryDetail | null = null;
  let liveError: string | null = null;
  const full = env ? await prisma.trinoEnvironment.findUnique({ where: { id: env.id } }) : null;
  if (full?.trinoBaseUrl) {
    try {
      detail = normalizeQueryDetail(await fetchQueryDetail(full.trinoBaseUrl, queryId));
    } catch (e) {
      liveError = e instanceof Error ? e.message : "Canlı detay alınamadı";
    }
  }
  const stored = env
    ? await prisma.queryStat.findUnique({ where: { environmentId_queryId: { environmentId: env.id, queryId } } })
    : null;

  const state = detail?.state ?? stored?.state ?? "UNKNOWN";
  const username = detail?.username ?? stored?.username ?? null;
  const resourceGroup = detail?.resourceGroup ?? stored?.resourceGroup ?? null;
  const errorType = detail?.errorType ?? stored?.errorType ?? null;
  const errorCode = detail?.errorCode ?? stored?.errorCode ?? null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <Link href="/errors" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Hatalara dön
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold tracking-tight">{queryId}</h1>
        <Badge variant={errorType ? "destructive" : "neutral"}>{state}</Badge>
      </div>

      {!detail && (
        <p className="mt-2 text-[12px] text-warning">
          {liveError
            ? `Canlı detay alınamadı (${liveError}). Toplanan örnek gösteriliyor.`
            : "Canlı detay yok — toplanan örnek gösteriliyor."}
        </p>
      )}

      <Card className="mt-5">
        <CardHeader><CardTitle className="text-sm">Genel</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Kullanıcı"><span className="font-mono">{username ?? "—"}</span></Field>
          <Field label="Resource group"><span className="font-mono">{resourceGroup ?? "—"}</span></Field>
          <Field label="Hata tipi">{errorType ? <Badge variant="destructive">{errorType}</Badge> : "—"}</Field>
          <Field label="Hata kodu"><span className="font-mono">{errorCode ?? "—"}</span></Field>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Zamanlama</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Field label="Kuyruk">{ms(detail?.queuedMs ?? stored?.queuedMs)}</Field>
          <Field label="Analiz">{ms(detail?.analysisMs ?? stored?.analysisMs)}</Field>
          <Field label="Planlama">{ms(detail?.planningMs ?? stored?.planningMs)}</Field>
          <Field label="Yürütme">{ms(detail?.executionMs ?? stored?.executionMs)}</Field>
          <Field label="Toplam">{ms(detail?.elapsedMs ?? stored?.elapsedMs)}</Field>
        </CardContent>
      </Card>

      {detail?.errorMessage && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-sm">Hata mesajı</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[12px] whitespace-pre-wrap">
              {detail.errorMessage}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 gap-0 py-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Server className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">İlgili node&apos;lar</span>
          {detail && (
            <Badge variant="neutral">
              {detail.totalTasks} task · {detail.failedTasks} failed
            </Badge>
          )}
        </div>
        {!detail || detail.nodes.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Bu sorgu için node bilgisi yok (canlı detay gerekir veya sorgu tamamlanmış olabilir).
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Node</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.nodes.map((n, i) => (
                <TableRow key={n}>
                  <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono text-[12px]">{n}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
