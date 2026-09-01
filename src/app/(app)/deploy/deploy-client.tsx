"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock,
  Download, HardDriveDownload, KeyRound, Play, RefreshCw, Server, ShieldCheck, Workflow, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  checkDrift,
  discoverNodes,
  generateAnsibleArtifacts,
  verifyConsistency,
  getDeploymentRuns,
  importConfigFromTrino,
  type DriftResult,
  type ConsistencyResult,
  type DeploymentRunRow,
  type RunnerStatus,
  type ImportFromTrinoResult,
} from "./actions";
import { saveSshConfigAction, deleteSshConfigAction, type SshConfigResult } from "./ssh-config-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DIFF_PREFIX: Record<string, string> = { add: "+ ", del: "- ", ctx: "  " };
const DIFF_CLASS: Record<string, string> = {
  add: "border-l-2 border-success bg-success/12",
  del: "border-l-2 border-destructive bg-destructive/12",
  ctx: "border-l-2 border-transparent",
};

const RUN_STATUS_BADGE: Record<string, { variant: "success" | "destructive" | "warning" | "neutral"; label: string }> = {
  SUCCESS: { variant: "success", label: "Başarılı" },
  FAILED:  { variant: "destructive", label: "Başarısız" },
  RUNNING: { variant: "warning", label: "Çalışıyor" },
  PENDING: { variant: "neutral", label: "Bekliyor" },
};

export type NodeRow = { id: string; host: string; type: string; lastSeen: string | null };

type EnvInfo = {
  name: string;
  deliveryMode: "HTTP" | "FILE";
  configTarget: string;
  refreshPeriod: string | null;
  hasTrinoApi: boolean;
};

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── SSH config panel ──────────────────────────────────────────────────────────

type SshState = {
  hasPassword: boolean;
  hasPrivateKey: boolean;
  sshUser: string;
} | null;

function SshConfigPanel({ initial }: Readonly<{ initial: SshState }>) {
  const [sshState, setSshState] = useState<SshState>(initial);
  const [expanded, setExpanded] = useState(!initial);
  const [msg, setMsg] = useState<SshConfigResult | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveSshConfigAction(fd);
      setMsg(r);
      if (r.ok) {
        setSshState({ sshUser: (fd.get("sshUser") as string) || "ansible", hasPassword: !!(fd.get("sshPassword") as string), hasPrivateKey: !!(fd.get("privateKey") as string) });
        formRef.current?.reset();
        setExpanded(false);
      }
    });
  }

  function handleDelete() {
    start(async () => {
      const r = await deleteSshConfigAction();
      setMsg(r);
      if (r.ok) setSshState(null);
    });
  }

  return (
    <Card>
      <CardHeader className="grid-cols-[1fr_auto] items-center">
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-muted-foreground" /> SSH Yapılandırması
          {sshState && (
            <Badge variant="success" className="text-[11px]">
              {sshState.sshUser} · {sshState.hasPrivateKey ? "Özel anahtar" : "Şifre"}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((p) => !p)}>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Ansible&apos;ın cluster node&apos;larına bağlanmak için kullanacağı kimlik bilgileri. Şifre ve özel
            anahtar AES-256-GCM ile şifreli saklanır.
          </p>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[13px]">SSH Kullanıcı Adı</Label>
              <Input name="sshUser" placeholder="ansible" defaultValue={sshState?.sshUser ?? "ansible"} className="h-8 text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[13px]">SSH Şifresi <span className="text-muted-foreground">(boş bırakırsanız mevcut korunur)</span></Label>
              <Input name="sshPassword" type="password" placeholder={sshState?.hasPassword ? "••••••••" : "Opsiyonel"} className="h-8 text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[13px]">PEM Özel Anahtar <span className="text-muted-foreground">(boş bırakırsanız mevcut korunur)</span></Label>
              <Textarea name="privateKey" rows={4} placeholder={sshState?.hasPrivateKey ? "-----BEGIN RSA PRIVATE KEY-----\n(mevcut korunur)" : "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"} className="font-mono text-[12px]" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={pending}>
                {pending ? <RefreshCw className="animate-spin" /> : null} Kaydet
              </Button>
              {sshState && (
                <Button size="sm" variant="destructive" type="button" onClick={handleDelete} disabled={pending}>
                  Sil
                </Button>
              )}
            </div>
          </form>
          {msg && (
            <p className={cn("flex items-center gap-1.5 text-[12px]", msg.ok ? "text-success" : "text-destructive")}>
              {msg.ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              {msg.ok ? "SSH yapılandırması kaydedildi." : msg.error}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Streaming terminal ────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;
function stripAnsi(s: string) { return s.replace(ANSI_RE, ""); }

type StreamEvent =
  | { line: string }
  | { done: true; returnCode: number }
  | { meta: true; runId: string; status: "SUCCESS" | "FAILED" }
  | { error: string; done: true; returnCode: number };

function StreamingTerminal({
  runType,
  restart,
  onComplete,
  onClose,
}: Readonly<{
  runType: "DISTRIBUTE" | "VERIFY";
  restart: boolean;
  onComplete: (runId: string, status: "SUCCESS" | "FAILED") => void;
  onClose: () => void;
}>) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<"running" | "SUCCESS" | "FAILED">("running");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/deploy/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: runType, restart }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
          setLines([`Hata: ${err.error ?? "Bilinmeyen hata"}`]);
          setStatus("FAILED");
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part.replace(/^data:\s*/, "").trim();
            if (!dataLine) continue;
            try {
              const evt = JSON.parse(dataLine) as StreamEvent;
              if ("line" in evt) {
                setLines((prev) => [...prev, stripAnsi(evt.line)]);
              }
              if ("error" in evt) {
                setLines((prev) => [...prev, `Hata: ${evt.error}`]);
              }
              if ("done" in evt && evt.done) {
                setStatus(evt.returnCode === 0 ? "SUCCESS" : "FAILED");
              }
              if ("meta" in evt && evt.meta) {
                onComplete(evt.runId, evt.status);
              }
            } catch {
              // Malformed SSE event; skip.
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLines((prev) => [...prev, `Bağlantı hatası: ${e instanceof Error ? e.message : "hata"}`]);
          setStatus("FAILED");
        }
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  return (
    <div className="mt-4 space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          {status === "running" && <RefreshCw className="size-4 animate-spin text-primary" />}
          {status === "SUCCESS" && <CheckCircle2 className="size-4 text-success" />}
          {status === "FAILED" && <XCircle className="size-4 text-destructive" />}
          <span>
            {status === "running"
              ? runType === "DISTRIBUTE" ? "Dağıtım playbook'u çalışıyor…" : "Doğrulama playbook'u çalışıyor…"
              : status === "SUCCESS" ? "Tamamlandı" : "Başarısız"}
          </span>
        </div>
        {status !== "running" && (
          <Button size="sm" variant="outline" onClick={onClose}>Kapat</Button>
        )}
      </div>
      <div
        ref={logRef}
        className="h-72 overflow-y-auto rounded-md bg-gray-950 p-3 font-mono text-[11px] leading-relaxed text-gray-100"
      >
        {lines.length === 0 && status === "running" && (
          <span className="text-gray-500">Bağlanılıyor…</span>
        )}
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">{line || " "}</div>
        ))}
        {status === "running" && lines.length > 0 && (
          <div className="mt-0.5 animate-pulse text-primary">▌</div>
        )}
      </div>
    </div>
  );
}

// ── Deployment history ────────────────────────────────────────────────────────

function RunHistory({ runs }: Readonly<{ runs: DeploymentRunRow[] }>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        Henüz dağıtım çalıştırılmadı.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tip</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Çalıştıran</TableHead>
          <TableHead>Tarih</TableHead>
          <TableHead>Süre</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r) => {
          const info = RUN_STATUS_BADGE[r.status] ?? RUN_STATUS_BADGE.PENDING;
          const durationMs = r.completedAt
            ? new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()
            : null;
          return (
            <>
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant="neutral">{r.type === "DISTRIBUTE" ? "Dağıtım" : "Doğrulama"}</Badge>
                </TableCell>
                <TableCell><Badge variant={info.variant}>{info.label}</Badge></TableCell>
                <TableCell className="font-mono text-[12px]">{r.triggeredBy}</TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("tr-TR")}
                </TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
                </TableCell>
                <TableCell>
                  {r.stdout && (
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      {expandedId === r.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      Log
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              {expandedId === r.id && r.stdout && (
                <TableRow key={`${r.id}-log`}>
                  <TableCell colSpan={6} className="p-0">
                    <div className="max-h-72 overflow-auto bg-muted/30 px-4 py-3">
                      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{r.stdout}</pre>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

type StreamingRun = { type: "DISTRIBUTE" | "VERIFY"; restart: boolean } | null;

type InitialData = {
  env: EnvInfo;
  nodes: NodeRow[];
  sshState: SshState;
  runnerStatus: RunnerStatus;
  recentRuns: DeploymentRunRow[];
};

export function DeployClient({ env, nodes, sshState, runnerStatus, recentRuns }: Readonly<InitialData>) {
  const router = useRouter();
  const [drift, setDrift] = useState<DriftResult | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyResult | null>(null);
  const [restart, setRestart] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [runs, setRuns] = useState<DeploymentRunRow[]>(recentRuns);
  const [streamingRun, setStreamingRun] = useState<StreamingRun>(null);
  const [importResult, setImportResult] = useState<ImportFromTrinoResult | null>(null);
  const [pending, start] = useTransition();

  function runDrift() {
    setMsg(null);
    start(async () => setDrift(await checkDrift()));
  }

  function runVerify() {
    setMsg(null);
    start(async () => setConsistency(await verifyConsistency()));
  }

  function runDiscover() {
    setMsg(null);
    start(async () => {
      const r = await discoverNodes();
      setMsg(r.ok ? `${r.count} düğüm keşfedildi.` : r.error);
      if (r.ok) router.refresh();
    });
  }

  function downloadAnsible() {
    start(async () => {
      const r = await generateAnsibleArtifacts(restart);
      if (!r.ok) { setMsg(r.error); return; }
      download(r.inventory, "inventory.ini");
      download(r.playbook, "deploy-trino.yml");
    });
  }

  function handleRunDeploy() {
    setStreamingRun({ type: "DISTRIBUTE", restart });
  }

  function handleRunVerify() {
    setStreamingRun({ type: "VERIFY", restart });
  }

  function handleStreamComplete(_runId: string, _status: "SUCCESS" | "FAILED") {
    start(async () => {
      const r = await getDeploymentRuns();
      if (r.ok) setRuns(r.runs);
    });
  }

  function handleImport() {
    setImportResult(null);
    setMsg(null);
    start(async () => {
      const r = await importConfigFromTrino();
      setImportResult(r);
      if (r.ok) router.refresh();
    });
  }

  function refreshHistory() {
    start(async () => {
      const r = await getDeploymentRuns();
      if (r.ok) setRuns(r.runs);
    });
  }

  const runnerAvailable = runnerStatus.available;
  const hasSsh = runnerStatus.available && runnerStatus.sshConfig !== null;

  return (
    <div className="mt-5 space-y-5">
      {/* SSH missing — prominent blocker */}
      {!hasSsh && (
        <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">SSH yapılandırması eksik</p>
            <p className="mt-0.5 text-[12px] opacity-80">
              Config dağıtımı, içe aktarma ve doğrulama için SSH kimlik bilgileri gereklidir.
              Aşağıdaki SSH Yapılandırması kartını doldurun.
            </p>
          </div>
        </div>
      )}

      {/* Delivery mode info */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Dağıtım yöntemi</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px]">
          <div>
            <span className="text-muted-foreground">Mod: </span>
            <Badge variant="primarySoft">{env.deliveryMode === "HTTP" ? "HTTP (Mode A)" : "Dosya (Mode B)"}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Hedef: </span>
            <span className="font-mono">{env.configTarget}</span>
          </div>
          {env.refreshPeriod && (
            <div>
              <span className="text-muted-foreground">refresh-period: </span>
              <span className="font-mono">{env.refreshPeriod}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">ansible-runner: </span>
            <Badge variant={runnerAvailable ? "success" : "destructive"}>
              {runnerAvailable ? "Erişilebilir" : "Erişilemiyor"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* SSH config */}
      <SshConfigPanel initial={sshState} />

      {/* Config import from coordinator via SSH */}
      <Card>
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <CardTitle className="flex items-center gap-2 text-sm">
            <HardDriveDownload className="size-4 text-muted-foreground" /> Koordinatörden Yapılandırma İçe Aktar
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={pending || !runnerAvailable || !hasSsh}
            title={!runnerAvailable ? "ansible-runner erişilemiyor" : !hasSsh ? "SSH kimlik bilgisi gerekli" : undefined}
          >
            {pending ? <RefreshCw className="animate-spin" /> : <HardDriveDownload />}
            SSH ile İçe Aktar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Koordinatör sunucusuna SSH ile bağlanarak mevcut Trino yapılandırma dosyalarını
            (rules.json, password.db, katalog ayarları vb.) veritabanına aktarır. Mevcut kayıtlar
            yeni bir sürüm olarak eklenir; veri silinmez.
          </p>
          {importResult && (
            <div className="space-y-1.5 rounded-md border p-3 text-[12px]">
              {!importResult.ok && (
                <p className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" /> {importResult.error}
                </p>
              )}
              {importResult.ok && importResult.imported.length > 0 && (
                <p className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  İçe aktarıldı: {importResult.imported.join(" · ")}
                </p>
              )}
              {importResult.ok && importResult.skipped.length > 0 && (
                <p className="text-muted-foreground">Bulunamadı / atlandı: {importResult.skipped.join(", ")}</p>
              )}
              {importResult.ok && importResult.errors.length > 0 && (
                <p className="text-destructive">Hatalar: {importResult.errors.join("; ")}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drift check */}
      <Card>
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <CardTitle className="text-sm">Drift kontrolü</CardTitle>
          <Button variant="outline" size="sm" onClick={runDrift} disabled={pending}>
            <RefreshCw className={cn(pending && "animate-spin")} /> Kontrol et
          </Button>
        </CardHeader>
        {drift && (
          <CardContent>
            {drift.ok ? (
              <>
                <p className={cn("flex items-center gap-2 text-[13px]", drift.inSync ? "text-success" : "text-warning")}>
                  {drift.inSync ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                  {drift.message}
                </p>
                {drift.diff.length > 0 && (
                  <div className="mt-3 max-h-72 overflow-auto rounded-md border font-mono text-[12px]">
                    {drift.diff.map((line, i) => (
                      <div key={i} className={cn("whitespace-pre px-3 py-0.5", DIFF_CLASS[line.type])}>
                        {DIFF_PREFIX[line.type]}{line.text}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                <AlertTriangle className="size-3.5" /> {drift.error}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Node inventory */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Düğüm envanteri</h2>
            <Badge variant="neutral">{nodes.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runDiscover}
            disabled={pending || !env.hasTrinoApi}
            title={env.hasTrinoApi ? "" : "Ortamda Trino API adresi tanımlı değil"}
          >
            <RefreshCw className={cn(pending && "animate-spin")} /> Düğümleri keşfet
          </Button>
        </div>
        {nodes.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            {env.hasTrinoApi
              ? <>Henüz düğüm keşfedilmedi. &ldquo;Düğümleri keşfet&rdquo; ile Trino API&apos;den çekin.</>
              : "Trino API adresi (trinoBaseUrl) tanımlı değil — ortam ayarına ekleyin."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Düğüm</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Son görülme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-[13px]">{n.host}</TableCell>
                  <TableCell>
                    <Badge variant={n.type === "COORDINATOR" ? "primarySoft" : "neutral"}>
                      {n.type === "COORDINATOR" ? "Koordinatör" : "Worker"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {n.lastSeen ? new Date(n.lastSeen).toLocaleString("tr-TR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Consistency verification */}
      <Card>
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-muted-foreground" /> Cluster tutarlılık doğrulama
          </CardTitle>
          <Button variant="outline" size="sm" onClick={runVerify} disabled={pending}>
            <RefreshCw className={cn(pending && "animate-spin")} /> Doğrula
          </Button>
        </CardHeader>
        {consistency && (
          <CardContent className="space-y-4">
            {!consistency.ok ? (
              <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                <AlertTriangle className="size-3.5" /> {consistency.error}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-[12px]">
                  <Badge variant={consistency.version.allReachable ? "success" : "warning"}>
                    {consistency.version.allReachable ? "Tüm node'lar erişilebilir" : `Erişilemeyen: ${consistency.version.unreachable.length}`}
                  </Badge>
                  <Badge variant={consistency.version.versionConsistent ? "success" : "warning"}>
                    {consistency.version.versionConsistent ? "Sürüm tutarlı" : `Sürüm farkı: ${consistency.version.versions.join(", ")}`}
                  </Badge>
                  <Badge variant={consistency.version.environmentConsistent ? "success" : "warning"}>
                    {consistency.version.environmentConsistent ? "Environment tutarlı" : "Environment farklı"}
                  </Badge>
                </div>

                {consistency.nodes.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Düğüm</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Erişim</TableHead>
                        <TableHead>Sürüm</TableHead>
                        <TableHead>Environment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consistency.nodes.map((n) => (
                        <TableRow key={n.host}>
                          <TableCell className="font-mono text-[12px]">{n.host}</TableCell>
                          <TableCell>
                            <Badge variant={n.type === "COORDINATOR" ? "primarySoft" : "neutral"}>
                              {n.type === "COORDINATOR" ? "Koordinatör" : "Worker"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={n.reachable ? "success" : "destructive"}>{n.reachable ? "✓" : "✗"}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[12px]">{n.version ?? "—"}</TableCell>
                          <TableCell className="font-mono text-[12px]">{n.environment ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <p className="text-[12px] text-muted-foreground">{consistency.configMessage}</p>

                {consistency.expectedFiles.length > 0 && (
                  <div className="rounded-md border font-mono text-[11px]">
                    {consistency.expectedFiles.map((f) => (
                      <div key={f.dest} className="flex items-center justify-between gap-3 border-b px-3 py-1 last:border-0">
                        <span className="text-foreground">{f.name}</span>
                        <span className="truncate text-muted-foreground" title={f.sha256}>{f.sha256.slice(0, 16)}…</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[12px] text-muted-foreground">
                  Beklenen kullanıcılar ({consistency.users.length}):{" "}
                  <span className="font-mono">{consistency.users.length ? consistency.users.join(", ") : "—"}</span> · bu küme tüm
                  node&apos;lara aynı dosyayla dağıtıldığından özdeş olmalıdır.
                </p>

                {consistency.verifyPlaybook && (
                  <Button size="sm" variant="outline" onClick={() => download(consistency.verifyPlaybook!, "verify-trino.yml")}>
                    <Download /> Doğrulama playbook&apos;u indir
                  </Button>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Automated Ansible execution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Workflow className="size-4 text-muted-foreground" /> Otomatik Ansible Dağıtımı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!runnerAvailable && (
            <p className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              ansible-runner servisi erişilemiyor. Docker Compose&apos;un çalıştığından emin olun.
            </p>
          )}
          {runnerAvailable && !hasSsh && (
            <p className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              SSH yapılandırması eksik. Yukarıdan SSH kimlik bilgilerini kaydedin.
            </p>
          )}

          <p className="text-[13px] text-muted-foreground">
            Ansible runner servisi üzerinden tüm config dosyaları cluster node&apos;larına dağıtılır. Çıktı
            aşağıdaki terminalde gerçek zamanlı olarak gösterilir; tamamlandığında geçmişe kaydedilir.
          </p>

          <Label className="flex items-center gap-2 text-[13px] font-normal">
            <Checkbox checked={restart} onCheckedChange={(c) => setRestart(c === true)} />
            Kontrollü yeniden başlatma (rolling restart — <span className="font-mono">serial: 1</span>)
          </Label>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleRunDeploy}
              disabled={!!streamingRun || !runnerAvailable || !hasSsh || nodes.length === 0}
              title={nodes.length === 0 ? "Önce düğümleri keşfedin" : undefined}
            >
              <Play /> Dağıtımı Çalıştır
            </Button>
            {env.deliveryMode === "FILE" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRunVerify}
                disabled={!!streamingRun || !runnerAvailable || !hasSsh || nodes.length === 0}
              >
                <ShieldCheck /> Doğrulamayı Çalıştır
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={downloadAnsible} disabled={pending || !!streamingRun}>
              <Download /> Artifact İndir
            </Button>
          </div>

          {/* Real-time streaming terminal */}
          {streamingRun && (
            <StreamingTerminal
              runType={streamingRun.type}
              restart={streamingRun.restart}
              onComplete={handleStreamComplete}
              onClose={() => setStreamingRun(null)}
            />
          )}
        </CardContent>
      </Card>

      {/* Deployment history */}
      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Dağıtım geçmişi</h2>
            <Badge variant="neutral">{runs.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshHistory} disabled={pending}>
            <RefreshCw className={cn(pending && "animate-spin")} />
          </Button>
        </div>
        <RunHistory runs={runs} />
      </Card>

      {msg && <p className="text-[12px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
