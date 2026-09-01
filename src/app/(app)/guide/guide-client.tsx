"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Database,
  FileCog,
  Lightbulb,
  RadioTower,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GUIDE_SECTIONS,
  GUIDE_GROUPS,
  FILE_PAGE_MAP,
  SOURCE_KIND_META,
  type DataSource,
  type DataSourceKind,
  type GuideSection,
} from "./guide-content";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type KindStyle = { variant: React.ComponentProps<typeof Badge>["variant"]; icon: LucideIcon };

const KIND_STYLE: Record<DataSourceKind, KindStyle> = {
  file: { variant: "primarySoft", icon: FileCog },
  db: { variant: "neutral", icon: Database },
  api: { variant: "info", icon: RadioTower },
};

/** A single source shown as a compact chip; file names are rendered monospace. */
function SourceChip({ source }: { source: DataSource }) {
  const { variant, icon: Icon } = KIND_STYLE[source.kind];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" />
      <span className={cn(source.kind === "file" && "font-mono text-[11px]")}>{source.name}</span>
    </Badge>
  );
}

function matches(section: GuideSection, q: string): boolean {
  if (!q) return true;
  const hay = [
    section.title,
    section.summary,
    ...section.steps,
    ...(section.tips ?? []),
    ...section.sources.flatMap((s) => [s.name, s.op]),
    section.req ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("tr");
  return q
    .toLocaleLowerCase("tr")
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

/** Top reference: which page operates on which Trino config file, and how. */
function FileMapTable() {
  const rows = useMemo(
    () =>
      [...FILE_PAGE_MAP].sort((a, b) => a.file.localeCompare(b.file, "tr") || a.title.localeCompare(b.title, "tr")),
    [],
  );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileCog className="size-4 text-primary" /> Sayfa ↔ Dosya Eşlemesi
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Her Trino güvenlik dosyasını hangi sayfadan, nasıl yönetirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(SOURCE_KIND_META) as DataSourceKind[]).map((kind) => {
            const { icon: Icon } = KIND_STYLE[kind];
            return (
              <Badge key={kind} variant={KIND_STYLE[kind].variant} className="gap-1" title={SOURCE_KIND_META[kind].hint}>
                <Icon className="size-3" /> {SOURCE_KIND_META[kind].label}
              </Badge>
            );
          })}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[240px]">Dosya</TableHead>
            <TableHead className="w-[190px]">Sayfa</TableHead>
            <TableHead>Bu sayfada yapılan işlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`${row.file}-${row.href}-${i}`}>
              <TableCell>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[12px] text-primary">{row.file}</span>
              </TableCell>
              <TableCell>
                <Link href={row.href} className="font-medium text-primary hover:underline">
                  {row.title}
                </Link>
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">{row.op}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function GuideClient() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => GUIDE_SECTIONS.filter((s) => matches(s, query)), [query]);
  const allOpen = filtered.length > 0 && filtered.every((s) => open.has(s.id));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setOpen(allOpen ? new Set() : new Set(filtered.map((s) => s.id)));
  }

  return (
    <div className="mt-5 space-y-5">
      <FileMapTable />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kılavuzda ara… (ör. rules.json, rollback, PBKDF2, drift)"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll}>
          {allOpen ? "Tümünü kapat" : "Tümünü aç"}
        </Button>
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-[13px] text-muted-foreground">“{query}” için sonuç yok.</p>
      )}

      {GUIDE_GROUPS.map((group) => {
        const sections = filtered.filter((s) => s.group === group);
        if (sections.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group}</h2>
            <div className="space-y-2">
              {sections.map((s) => {
                const isOpen = open.has(s.id);
                return (
                  <Card key={s.id} className="gap-0 overflow-hidden py-0">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{s.title}</span>
                          {s.req && <Badge variant="neutral" className="text-[10px]">ister {s.req}</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{s.summary}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {s.sources.map((src, i) => (
                            <SourceChip key={i} source={src} />
                          ))}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t px-4 py-3 pl-11">
                        <p className="text-[13px] text-muted-foreground">{s.summary}</p>

                        <div className="mt-3 rounded-md border bg-muted/30 p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            İşlediği dosya / veri
                          </p>
                          <ul className="space-y-1.5">
                            {s.sources.map((src, i) => {
                              const { icon: Icon } = KIND_STYLE[src.kind];
                              return (
                                <li key={i} className="flex items-start gap-2 text-[13px]">
                                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                  <span>
                                    <span className={cn(src.kind === "file" ? "font-mono text-primary" : "font-medium")}>{src.name}</span>
                                    <span className="text-muted-foreground"> — {src.op}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] marker:text-muted-foreground">
                          {s.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                        {s.tips?.map((tip, i) => (
                          <p key={i} className="mt-2 flex items-start gap-1.5 text-[12px] text-info">
                            <Lightbulb className="mt-0.5 size-3.5 shrink-0" /> {tip}
                          </p>
                        ))}
                        <Link
                          href={s.href}
                          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                        >
                          Sayfaya git <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
