"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronDown, ChevronUp, Database, Download, Loader2, Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { loadMoreAuditEntries, exportAuditCsv } from "./actions";

export type AuditEntry = {
  id: string;
  actorUsername: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  trinoEnvName: string | null;
  trinoBaseUrl: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

type BadgeVariant = "neutral" | "success" | "info" | "warning" | "destructive" | "primarySoft";
const ACTION_VARIANT: Record<string, BadgeVariant> = {
  CREATE:   "success",
  UPDATE:   "info",
  DELETE:   "destructive",
  IMPORT:   "neutral",
  EXPORT:   "neutral",
  PUBLISH:  "primarySoft",
  ROLLBACK: "warning",
  DEPLOY:   "primarySoft",
  RESTART:  "warning",
};

const ALL = "__all__";

// ── JSON diff engine ──────────────────────────────────────────────────────────

type DiffLine = { kind: "add" | "del" | "ctx"; text: string };

function jsonLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  return JSON.stringify(value, null, 2).split("\n");
}

/**
 * Compute a line-level diff between `before` and `after` JSON values.
 * Uses the Myers O(ND) algorithm simplified to LCS via DP — sufficient for
 * audit payloads which are typically < 300 lines.
 */
function diffJson(before: unknown, after: unknown): DiffLine[] {
  const a = jsonLines(before);
  const b = jsonLines(after);

  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return b.map((t) => ({ kind: "add", text: t }));
  if (b.length === 0) return a.map((t) => ({ kind: "del", text: t }));

  // LCS DP table
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      result.push({ kind: "ctx", text: a[i] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ kind: "add", text: b[j] });
      j++;
    } else {
      result.push({ kind: "del", text: a[i] });
      i++;
    }
  }
  return result;
}

/** Check whether before and after actually differ (ignoring identical ctx lines). */
function hasDiff(lines: DiffLine[]): boolean {
  return lines.some((l) => l.kind !== "ctx");
}

// ── Diff viewer ───────────────────────────────────────────────────────────────

const LINE_CLASS: Record<DiffLine["kind"], string> = {
  add: "bg-green-500/10 text-green-800 dark:text-green-300 border-l-2 border-green-500",
  del: "bg-red-500/10 text-red-800 dark:text-red-300 border-l-2 border-red-500",
  ctx: "text-muted-foreground border-l-2 border-transparent",
};
const LINE_PREFIX: Record<DiffLine["kind"], string> = { add: "+", del: "−", ctx: " " };

/** Collapses long runs of identical context lines (> 4) into a fold marker. */
function foldContext(lines: DiffLine[], ctx = 3): Array<DiffLine | { kind: "fold"; count: number }> {
  const out: Array<DiffLine | { kind: "fold"; count: number }> = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind === "ctx") {
      let end = i;
      while (end < lines.length && lines[end].kind === "ctx") end++;
      const len = end - i;
      if (len <= ctx * 2 + 1) {
        out.push(...lines.slice(i, end));
      } else {
        out.push(...lines.slice(i, i + ctx));
        out.push({ kind: "fold", count: len - ctx * 2 });
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

function DiffView({ before, after }: Readonly<{ before: unknown; after: unknown }>) {
  const lines = useMemo(() => diffJson(before, after), [before, after]);
  const [expanded, setExpanded] = useState(false);

  if (!hasDiff(lines)) {
    // No change in JSON — show raw after value
    return (
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
        {JSON.stringify(after ?? before, null, 2)}
      </pre>
    );
  }

  const folded = foldContext(lines);
  const addCount = lines.filter((l) => l.kind === "add").length;
  const delCount = lines.filter((l) => l.kind === "del").length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold text-green-700 dark:text-green-400">+{addCount}</span>
        <span className="font-semibold text-red-700 dark:text-red-400">−{delCount}</span>
        <button
          className="ml-auto text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? "Katla" : "Tümünü göster"}
        </button>
      </div>
      <div className="max-h-96 overflow-auto rounded-md border font-mono text-[11px] leading-relaxed">
        {(expanded ? lines.map((l) => ({ ...l })) : folded).map((line, idx) => {
          if ("count" in line) {
            return (
              <div key={idx} className="border-y border-dashed bg-muted/30 px-3 py-0.5 text-[10px] text-muted-foreground">
                ⋯ {line.count} satır gizlendi
              </div>
            );
          }
          const dl = line as DiffLine;
          return (
            <div key={idx} className={cn("flex gap-2 whitespace-pre px-3 py-px", LINE_CLASS[dl.kind])}>
              <span className="w-3 shrink-0 select-none text-center opacity-60">{LINE_PREFIX[dl.kind]}</span>
              <span className="break-all">{dl.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail panel (expanded row) ───────────────────────────────────────────────

function EntryDetail({ entry, actionLabel }: Readonly<{ entry: AuditEntry; actionLabel: string }>) {
  return (
    <div className="space-y-4 px-4 py-4">
      {/* Actor + connection */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] sm:grid-cols-4">
        <div>
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <User className="size-3" /> Aktör
          </div>
          <div className="font-mono">{entry.actorEmail ?? entry.actorUsername}</div>
          {entry.actorEmail && entry.actorEmail !== entry.actorUsername && (
            <div className="text-[11px] text-muted-foreground">{entry.actorUsername}</div>
          )}
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aksiyon</div>
          <Badge variant={ACTION_VARIANT[entry.action] ?? "neutral"} className="text-[11px]">{actionLabel}</Badge>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Varlık</div>
          <div className="font-mono">{entry.entityType}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={entry.entityId}>{entry.entityId.slice(0, 24)}…</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Zaman</div>
          <div>{new Date(entry.createdAt).toLocaleString("tr-TR")}</div>
          <div className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: tr })}
          </div>
        </div>
      </div>

      {/* Trino connection context */}
      {(entry.trinoEnvName ?? entry.trinoBaseUrl) && (
        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px]">
          <Database className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-primary">Bağlantı: </span>
            {entry.trinoEnvName && <span className="mr-2 font-medium">{entry.trinoEnvName}</span>}
            {entry.trinoBaseUrl && (
              <span className="font-mono text-muted-foreground">{entry.trinoBaseUrl}</span>
            )}
          </div>
        </div>
      )}

      {/* Diff */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Değişiklik (önceki → sonraki)
        </div>
        {entry.before === null && entry.after === null ? (
          <p className="text-[12px] text-muted-foreground">Veri yok</p>
        ) : (
          <DiffView before={entry.before} after={entry.after} />
        )}
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function AuditClient({
  entries: initial,
  initialCursor,
}: Readonly<{ entries: AuditEntry[]; initialCursor: string | null }>) {
  const t = useTranslations("audit.actions");
  const [entries, setEntries] = useState<AuditEntry[]>(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actions = useMemo(() => [...new Set(entries.map((e) => e.action))].sort(), [entries]);
  const entityTypes = useMemo(() => [...new Set(entries.map((e) => e.entityType))].sort(), [entries]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (actionFilter === "" || e.action === actionFilter) &&
          (entityFilter === "" || e.entityType === entityFilter) &&
          (actorSearch === "" ||
            e.actorUsername.toLowerCase().includes(actorSearch.toLowerCase()) ||
            (e.actorEmail ?? "").toLowerCase().includes(actorSearch.toLowerCase())),
      ),
    [entries, actionFilter, entityFilter, actorSearch],
  );

  const label = (a: string) => {
    try { return t(a); } catch { return a; }
  };

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const result = await loadMoreAuditEntries(cursor, "", "");
      setEntries((prev) => [...prev, ...result.entries]);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const result = await exportAuditCsv(actionFilter, entityFilter, actorSearch);
      if (!result.ok) return;
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      {/* Filters */}
      <Card className="flex-row flex-wrap items-center gap-2 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-52 pl-8"
            placeholder="Aktör / e-posta ara…"
            value={actorSearch}
            onChange={(e) => setActorSearch(e.target.value)}
          />
        </div>
        <Select value={actionFilter || ALL} onValueChange={(v) => setActionFilter(v === ALL ? "" : (v ?? ""))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm aksiyonlar</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{label(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityFilter || ALL} onValueChange={(v) => setEntityFilter(v === ALL ? "" : (v ?? ""))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm varlıklar</SelectItem>
            {entityTypes.map((etype) => <SelectItem key={etype} value={etype}>{etype}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-[13px] text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span> kayıt
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={exportingCsv || filtered.length === 0}
          className="gap-1.5"
        >
          {exportingCsv ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          CSV İndir
        </Button>
      </Card>

      {/* Table */}
      <Card className="gap-0 py-0">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Kayıt yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zaman</TableHead>
                <TableHead>Aktör</TableHead>
                <TableHead>Aksiyon</TableHead>
                <TableHead>Varlık</TableHead>
                <TableHead>Trino Bağlantısı</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const isOpen = expandedId === e.id;
                return (
                  <>
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => toggle(e.id)}
                    >
                      <TableCell className="whitespace-nowrap text-[12px] text-muted-foreground" title={e.createdAt}>
                        {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: tr })}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-[12px]">{e.actorEmail ?? e.actorUsername}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[e.action] ?? "neutral"} className="text-[11px]">
                          {label(e.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[12px]">{e.entityType}</TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        {e.trinoEnvName ? (
                          <span className="flex items-center gap-1">
                            <Database className="size-3 shrink-0" />
                            {e.trinoEnvName}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOpen
                          ? <ChevronUp className="size-4 text-muted-foreground" />
                          : <ChevronDown className="size-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${e.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="p-0">
                          <EntryDetail entry={e} actionLabel={label(e.action)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Load more */}
      {cursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" />}
            Daha fazla yükle
          </Button>
        </div>
      )}
    </div>
  );
}
