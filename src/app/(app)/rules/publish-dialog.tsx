"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { publishToFile, regenerateHttpToken, validateActiveConfig, type ValidationReport } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PublishEnv = {
  id: string;
  deliveryMode: "HTTP" | "FILE";
  configTarget: string;
  httpToken: string | null;
};

function ValidationPanel({ report }: Readonly<{ report: ValidationReport }>) {
  const allOk = report.errors.length === 0 && report.trino.reachable && report.warnings.length === 0;
  return (
    <div className="space-y-2 rounded-md border p-3 text-[12px]">
      {/* Structural check */}
      <div className="flex items-center gap-2 font-semibold">
        {report.errors.length === 0
          ? <CheckCircle2 className="size-3.5 text-success" />
          : <AlertTriangle className="size-3.5 text-destructive" />}
        Yapısal doğrulama
      </div>
      {report.errors.map((e, i) => (
        <p key={i} className="ml-5 text-destructive">{e}</p>
      ))}
      {report.warnings.map((w, i) => (
        <p key={i} className="ml-5 text-warning">{w}</p>
      ))}
      {report.errors.length === 0 && report.warnings.length === 0 && (
        <p className="ml-5 text-muted-foreground">Hata veya uyarı yok</p>
      )}

      {/* Trino connectivity */}
      <div className="mt-2 flex items-center gap-2 font-semibold">
        {report.trino.reachable
          ? <CheckCircle2 className="size-3.5 text-success" />
          : <AlertTriangle className="size-3.5 text-warning" />}
        Trino bağlantısı
      </div>
      {report.trino.reachable ? (
        <p className="ml-5 text-muted-foreground">
          Bağlandı · Trino {report.trino.version}
        </p>
      ) : (
        <p className="ml-5 text-warning">{report.trino.error ?? "Erişilemiyor"}</p>
      )}

      {allOk && (
        <p className="mt-1 flex items-center gap-1.5 text-success">
          <ShieldCheck className="size-3.5" /> Yayınlamaya hazır
        </p>
      )}
    </div>
  );
}

export function PublishDialog({ env, onClose }: Readonly<{ env: PublishEnv; onClose: () => void }>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [token, setToken] = useState(env.httpToken);
  const [copied, setCopied] = useState(false);
  const [fileResult, setFileResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof globalThis.location === "undefined" ? "" : globalThis.location.origin;
  const endpoint = token ? `${origin}/api/trino/${env.id}?token=${token}` : null;

  async function validate() {
    setValidating(true);
    setReport(null);
    try {
      setReport(await validateActiveConfig());
    } finally {
      setValidating(false);
    }
  }

  function rotate() {
    setError(null);
    start(async () => {
      const result = await regenerateHttpToken();
      if (result.ok) {
        setToken(result.token);
        setCopied(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function writeToFile() {
    setError(null);
    setFileResult(null);
    start(async () => {
      const result = await publishToFile();
      if (result.ok) setFileResult(`Dosyaya yazıldı: ${env.configTarget}`);
      else setError(result.error);
    });
  }

  function copyEndpoint() {
    if (endpoint) {
      globalThis.navigator?.clipboard?.writeText(endpoint).then(() => setCopied(true)).catch(() => {});
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yayınla</DialogTitle>
          <DialogDescription>
            Aktif <span className="font-mono">rules.json</span> sürümünü Trino’ya ulaştır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 2.2 — validate before publish */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={validating || pending}
              onClick={validate}
              className="gap-1.5"
            >
              {validating
                ? <Loader2 className="size-3.5 animate-spin" />
                : <ShieldCheck className="size-3.5" />}
              {validating ? "Doğrulanıyor…" : "Doğrula"}
            </Button>
            {report && <ValidationPanel report={report} />}
          </div>

          {env.deliveryMode === "HTTP" ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">HTTP-served (Mode A)</span> — Trino bu uç
                noktayı periyodik çeker. Aktif sürüm her zaman buradan sunulur.
              </p>
              {endpoint ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-endpoint">Uç nokta (token dahil)</Label>
                    <div className="flex gap-2">
                      <Input id="pub-endpoint" readOnly className="font-mono text-[12px]" value={endpoint} />
                      <Button type="button" variant="outline" onClick={copyEndpoint}>
                        {copied ? <CheckCircle2 /> : <Copy />}
                        {copied ? "Kopyalandı" : "Kopyala"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 text-[12px] text-muted-foreground">
                    Trino tarafında:
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground">{`access-control.name=file
security.config-file=${endpoint}
security.refresh-period=30s`}</pre>
                  </div>
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={rotate}>
                    <RefreshCw /> Token’ı yenile
                  </Button>
                </>
              ) : (
                <Button type="button" disabled={pending} onClick={rotate}>
                  Token oluştur
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">File-write (Mode B)</span> — aktif kurallar
                şu yola yazılır:
              </p>
              <p className="rounded-md border bg-muted/30 p-3 font-mono text-[12px]">{env.configTarget}</p>
              <Button type="button" disabled={pending} onClick={writeToFile}>
                {pending ? "Yazılıyor…" : "Dosyaya yaz"}
              </Button>
              {fileResult && (
                <p className="flex items-center gap-1.5 text-[12px] text-success">
                  <CheckCircle2 className="size-3.5" /> {fileResult}
                </p>
              )}
            </>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-[12px] text-destructive">
              <AlertTriangle className="size-3.5" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
