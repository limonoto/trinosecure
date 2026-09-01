"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { parseRulesJson } from "@/lib/rules/rules";
import { diffLines, diffStats } from "@/lib/rules/diff";
import { logicalDiff, type LogicalChangeKind } from "@/lib/rules/logical-diff";
import { cn } from "@/lib/utils";
import { importRules } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const PREFIX: Record<string, string> = { add: "+ ", del: "- ", ctx: "  " };
const LINE_CLASS: Record<string, string> = {
  add: "border-l-2 border-success bg-success/12",
  del: "border-l-2 border-destructive bg-destructive/12",
  ctx: "border-l-2 border-transparent",
};
const LOGICAL_BADGE: Record<LogicalChangeKind, { label: string; variant: "success" | "destructive" | "warning" }> = {
  added: { label: "eklendi", variant: "success" },
  removed: { label: "kaldırıldı", variant: "destructive" },
  modified: { label: "değişti", variant: "warning" },
};

export function ImportClient({ currentContent }: Readonly<{ currentContent: string }>) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [applying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() === "" ? null : parseRulesJson(text)), [text]);
  const diff = useMemo(() => (parsed?.ok ? diffLines(currentContent, text) : []), [parsed, currentContent, text]);
  const stats = diffStats(diff);
  const diffRows = diff.map((line, index) => ({ key: `l${index}`, line }));
  const logical = useMemo(() => {
    if (!parsed?.ok) return [];
    const current = parseRulesJson(currentContent);
    return current.ok ? logicalDiff(current.doc, parsed.doc) : [];
  }, [parsed, currentContent]);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) file.text().then(setText).catch(() => setError("Dosya okunamadı"));
  }

  function apply() {
    if (!parsed?.ok) return;
    setError(null);
    startApply(async () => {
      const result = await importRules(text);
      if (result.ok) router.push("/rules");
      else setError(result.error);
    });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">JSON yapıştır</h2>
          <Textarea
            className="mt-3 min-h-[320px] font-mono text-[12px] leading-relaxed"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'{ "tables": [ ... ] }'}
          />
        </Card>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card p-5 text-center transition-colors hover:border-primary/50 hover:bg-accent/30">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Upload className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium">rules.json yükle</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Tıklayın veya sürükleyin</p>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
        </label>
      </div>

      {parsed && !parsed.ok && (
        <p className="flex items-center gap-1.5 text-[12px] text-destructive">
          <AlertTriangle className="size-3.5" /> {parsed.error}
        </p>
      )}

      {parsed?.ok && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[13px]">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" />
                <span className="tabular-nums">{stats.added}</span> eklendi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                <span className="tabular-nums">{stats.removed}</span> kaldırıldı
              </span>
            </div>
            <Button size="sm" disabled={applying} onClick={apply}>
              <CheckCircle2 /> {applying ? "Uygulanıyor…" : "Uygula (yeni sürüm)"}
            </Button>
          </div>

          {logical.length > 0 && (
            <Card className="gap-0 py-0">
              <div className="border-b px-4 py-2 text-[12px] font-medium text-muted-foreground">
                Mantıksal fark — anlamsal değişiklikler
              </div>
              <ul className="divide-y divide-border">
                {logical.map((c, index) => (
                  <li key={`${c.section}-${c.scope}-${index}`} className="flex items-start gap-2.5 px-4 py-2 text-[13px]">
                    <Badge variant={LOGICAL_BADGE[c.kind].variant} className="mt-0.5 flex-none">
                      {LOGICAL_BADGE[c.kind].label}
                    </Badge>
                    <div className="min-w-0">
                      <span className="font-mono text-muted-foreground">{c.section}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span>{c.scope}</span>
                      {c.details.length > 0 && (
                        <div className="mt-0.5 font-mono text-[12px] text-muted-foreground">{c.details.join("; ")}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="gap-0 py-0">
            <div className="border-b px-4 py-2 text-[12px] font-medium text-muted-foreground">
              Satır farkı — mevcut → içe aktarılan
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[640px] font-mono text-[12px] leading-relaxed">
                {diffRows.map(({ key, line }) => (
                  <div key={key} className={cn("whitespace-pre px-4 py-0.5", LINE_CLASS[line.type])}>
                    {PREFIX[line.type]}
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-destructive">
          <AlertTriangle className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
