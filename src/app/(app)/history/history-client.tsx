"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History, RotateCcw } from "lucide-react";
import type { ArtifactHistory, VersionSummary } from "@/lib/versioning";
import type { LogicalChange } from "@/lib/rules/logical-diff";
import { rollbackToVersion, getVersionDiff, type VersionDiff } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ── Logical diff badge colours ────────────────────────────────────────────────

const KIND_VARIANT: Record<LogicalChange["kind"], { label: string; cls: string }> = {
  added:    { label: "Eklendi",    cls: "bg-green-500/15 text-green-800 dark:text-green-300" },
  removed:  { label: "Kaldırıldı", cls: "bg-red-500/15 text-red-800 dark:text-red-300"      },
  modified: { label: "Değişti",    cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
};

// ── Line-level diff viewer ────────────────────────────────────────────────────

const LINE_CLS: Record<"add" | "del" | "ctx", string> = {
  add: "bg-green-500/10 text-green-800 dark:text-green-300 border-l-2 border-green-500",
  del: "bg-red-500/10 text-red-800 dark:text-red-300 border-l-2 border-red-500",
  ctx: "text-muted-foreground border-l-2 border-transparent",
};
const LINE_PFX: Record<"add" | "del" | "ctx", string> = { add: "+", del: "−", ctx: " " };

type FoldedLine = ["add" | "del" | "ctx", string] | ["fold", number];

function foldCtx(lines: Array<["add" | "del" | "ctx", string]>, ctx = 3): FoldedLine[] {
  const out: FoldedLine[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i][0] === "ctx") {
      let end = i;
      while (end < lines.length && lines[end][0] === "ctx") end++;
      const len = end - i;
      if (len <= ctx * 2 + 1) {
        out.push(...lines.slice(i, end));
      } else {
        out.push(...lines.slice(i, i + ctx));
        out.push(["fold", len - ctx * 2]);
        out.push(...lines.slice(end - ctx, end));
      }
      i = end;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out;
}

function LineDiffView({ diff }: Readonly<{ diff: VersionDiff }>) {
  const [expanded, setExpanded] = useState(false);
  const folded = expanded
    ? diff.lines.map<FoldedLine>((l) => l)
    : foldCtx(diff.lines);

  if (diff.addedLines === 0 && diff.removedLines === 0) {
    return <p className="text-[12px] text-muted-foreground">İçerik değişmemiş.</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold text-green-700 dark:text-green-400">+{diff.addedLines}</span>
        <span className="font-semibold text-red-700 dark:text-red-400">−{diff.removedLines}</span>
        <button
          className="ml-auto text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? "Katla" : "Tümünü göster"}
        </button>
      </div>
      <div className="max-h-80 overflow-auto rounded-md border font-mono text-[11px] leading-relaxed">
        {folded.map((line, idx) => {
          if (line[0] === "fold") {
            return (
              <div key={idx} className="border-y border-dashed bg-muted/30 px-3 py-0.5 text-[10px] text-muted-foreground">
                ⋯ {line[1]} satır gizlendi
              </div>
            );
          }
          const kind = line[0] as "add" | "del" | "ctx";
          return (
            <div key={idx} className={cn("flex gap-2 whitespace-pre px-3 py-px", LINE_CLS[kind])}>
              <span className="w-3 shrink-0 select-none text-center opacity-60">{LINE_PFX[kind]}</span>
              <span className="break-all">{line[1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Diff panel (expandable below each version row) ────────────────────────────

function DiffPanel({
  versionId,
  artifactType,
}: Readonly<{ versionId: string; artifactType: string }>) {
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchDiff() {
    if (fetched) return;
    setLoading(true);
    try {
      const result = await getVersionDiff(versionId);
      setDiff(result);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  const hasLogical = diff?.logical && diff.logical.length > 0;

  return (
    <div className="space-y-4 px-5 py-4 text-[12px]">
      {loading && <p className="text-muted-foreground">Diff yükleniyor…</p>}

      {/* Logical diff — rules.json only */}
      {hasLogical && (
        <div>
          <p className="mb-2 font-semibold">Mantıksal değişiklikler</p>
          <div className="space-y-1">
            {diff!.logical!.map((c, i) => {
              const { label, cls } = KIND_VARIANT[c.kind];
              return (
                <div key={i} className="flex flex-wrap items-start gap-2">
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", cls)}>
                    {label}
                  </span>
                  <span className="font-mono text-muted-foreground">[{c.section}]</span>
                  <span className="font-mono">{c.scope}</span>
                  {c.details.length > 0 && (
                    <span className="text-muted-foreground">
                      — {c.details.join(" · ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Line diff — always shown for non-rules or when logical is empty */}
      {diff && (!hasLogical || artifactType !== "RULES_JSON") && (
        <div>
          {hasLogical && <p className="mb-2 font-semibold">Satır farkı</p>}
          <LineDiffView diff={diff} />
        </div>
      )}

      {diff && !hasLogical && diff.addedLines === 0 && diff.removedLines === 0 && (
        <p className="text-muted-foreground">Önceki sürümle aynı içerik.</p>
      )}

      {!fetched && !loading && (
        <button
          className="text-primary underline-offset-2 hover:underline"
          onClick={fetchDiff}
        >
          Farkı göster
        </button>
      )}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function HistoryClient({ artifacts }: Readonly<{ artifacts: ArtifactHistory[] }>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  async function rollback(v: VersionSummary, label: string) {
    const ok = await confirm({
      title: "Geri alma onayı",
      description: `"${label}" → v${v.version} sürümüne geri dönülsün ve yeniden dağıtılsın mı?`,
      confirmLabel: "Geri Dön",
      variant: "default",
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    start(async () => {
      const result = await rollbackToVersion(v.id);
      if (result.ok) {
        setMessage(result.message);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function toggleDiff(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (artifacts.length === 0) {
    return (
      <Card className="mt-6 items-center gap-3 p-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <History className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">
          Henüz kaydedilmiş sürüm yok. Bir config dosyasını kaydedince burada görünür.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <ConfirmDialog />
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-destructive">
          <AlertTriangle className="size-3.5" /> {error}
        </p>
      )}
      {message && (
        <p className="flex items-center gap-1.5 text-[12px] text-success">
          <CheckCircle2 className="size-3.5" /> {message}
        </p>
      )}
      {artifacts.map((a) => (
        <Card key={a.artifactId} className="gap-0 py-0">
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <span className="text-sm font-semibold">{a.label}</span>
            <Badge variant="neutral" className="font-mono text-[11px]">{a.name}</Badge>
          </div>
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Sürüm</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kaydeden</TableHead>
                <TableHead>Tarih (UTC)</TableHead>
                <TableHead>Not</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.versions.map((v) => {
                const isOpen = expandedId === v.id;
                return (
                  <>
                    <TableRow key={v.id} className="cursor-pointer" onClick={() => toggleDiff(v.id)}>
                      <TableCell className="font-medium tabular-nums">v{v.version}</TableCell>
                      <TableCell>
                        {v.isActive ? (
                          <Badge variant="success">
                            <CheckCircle2 className="size-3" /> aktif
                          </Badge>
                        ) : (
                          <Badge variant="neutral">pasif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px]">{v.createdBy}</TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {v.createdAt.slice(0, 16).replace("T", " ")}
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{v.note ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!v.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={(e) => { e.stopPropagation(); rollback(v, a.label); }}
                            >
                              <RotateCcw /> Geri al
                            </Button>
                          )}
                          {isOpen
                            ? <ChevronUp className="size-4 text-muted-foreground" />
                            : <ChevronDown className="size-4 text-muted-foreground" />}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${v.id}-diff`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="p-0">
                          <DiffPanel versionId={v.id} artifactType={a.type} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
