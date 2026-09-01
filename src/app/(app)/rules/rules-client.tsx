"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Code,
  Download,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Rocket,
  Save,
  ShieldX,
  Table2,
  Trash2,
} from "lucide-react";
import {
  EMPTY_RULES,
  parseRulesJson,
  ruleCounts,
  serializeRulesJson,
  validateRulesDocument,
} from "@/lib/rules/rules";
import { detectConflicts } from "@/lib/rules/conflicts";
import { cn } from "@/lib/utils";
import { saveRules } from "./actions";
import { AccessPreview } from "./access-preview";
import { PublishDialog } from "./publish-dialog";
import { RuleDrawer } from "./rule-drawer";
import { SECTIONS, type BadgeTone, type Cell, type SectionConfig } from "./rule-sections";
import {
  moveItem,
  nextKey,
  toDocument,
  toEditorDoc,
  type EditorDoc,
  type EditorRule,
} from "./rule-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

const BADGE_VARIANT: Record<BadgeTone, "neutral" | "primarySoft" | "info" | "success" | "warning" | "destructive"> = {
  neutral: "neutral",
  primary: "primarySoft",
  info: "info",
  success: "success",
  warning: "warning",
  destructive: "destructive",
};

function CellView({ cell }: Readonly<{ cell: Cell }>) {
  if (cell.kind === "mono") return <span className="font-mono text-[13px]">{cell.value}</span>;
  if (cell.kind === "muted") return <span className="text-muted-foreground">{cell.value}</span>;
  if (cell.kind === "badge") {
    return <Badge variant={BADGE_VARIANT[cell.tone]}>{cell.value}</Badge>;
  }
  if (cell.values.length === 0) {
    return <span className="text-muted-foreground">{cell.emptyValue}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {cell.values.map((value) => (
        <Badge key={value} variant={BADGE_VARIANT[cell.tone]}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

function SectionEditor({
  section,
  items,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
}: Readonly<{
  section: SectionConfig;
  items: EditorRule[];
  onAdd: () => void;
  onEdit: (item: EditorRule) => void;
  onDelete: (item: EditorRule) => void;
  onReorder: (from: number, to: number) => void;
}>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <Card data-section={section.key} className="mt-4 gap-0 py-0">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{section.label}</h2>
          <Badge variant="neutral">{items.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus /> Ekle
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Kural yok.</p>
      ) : (
        <Table style={{ minWidth: section.minWidth }}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              {section.columns.map((col) => (
                <TableHead key={col.header}>{col.header}</TableHead>
              ))}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={item.__key}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(dragIndex === index && "opacity-55")}
              >
                <TableCell>
                  <span className="inline-flex cursor-grab text-muted-foreground active:cursor-grabbing">
                    <GripVertical className="size-4" />
                  </span>
                </TableCell>
                {section.columns.map((col) => (
                  <TableCell key={col.header}>
                    <CellView cell={col.cell(item)} />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon-sm" title="Düzenle" onClick={() => onEdit(item)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" title="Sil" onClick={() => onDelete(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export function RulesClient({
  initialContent,
  env,
}: Readonly<{
  initialContent: string;
  env: { id: string; deliveryMode: "HTTP" | "FILE"; configTarget: string; httpToken: string | null };
}>) {
  const router = useRouter();
  const [doc, setDoc] = useState<EditorDoc>(() => {
    const parsed = parseRulesJson(initialContent);
    return toEditorDoc(parsed.ok ? parsed.doc : EMPTY_RULES);
  });
  const [savedContent, setSavedContent] = useState(initialContent);
  const [mode, setMode] = useState<"view" | "raw">("view");
  const [rawText, setRawText] = useState("");
  const [editing, setEditing] = useState<{ section: SectionConfig; item: EditorRule | null } | null>(null);
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const outputDoc = useMemo(() => toDocument(doc), [doc]);
  const serialized = useMemo(() => serializeRulesJson(outputDoc), [outputDoc]);
  const issues = useMemo(() => validateRulesDocument(outputDoc), [outputDoc]);
  const conflicts = useMemo(() => detectConflicts(outputDoc), [outputDoc]);
  const counts = ruleCounts(outputDoc);
  const totalRules = SECTIONS.reduce((sum, section) => sum + (doc.sections[section.key]?.length ?? 0), 0);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const dirty = serialized !== savedContent;
  const rawParsed = useMemo(() => (mode === "raw" ? parseRulesJson(rawText) : null), [mode, rawText]);
  const otherSections = Object.keys(doc.rest);

  function onSaveRule(rule: Record<string, unknown>) {
    if (!editing) return;
    const { section, item } = editing;
    const keyed: EditorRule = { ...rule, __key: item?.__key ?? nextKey() };
    setDoc((prev) => {
      const list = prev.sections[section.key] ?? [];
      const next = item ? list.map((r) => (r.__key === item.__key ? keyed : r)) : [...list, keyed];
      return { ...prev, sections: { ...prev.sections, [section.key]: next } };
    });
    setEditing(null);
  }

  async function deleteRule(sectionKey: string, key: string) {
    const ok = await confirm({
      title: "Silme onayı",
      description: "Bu kuralı silmek istediğinize emin misiniz?",
      confirmLabel: "Sil",
    });
    if (!ok) return;
    setDoc((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: (prev.sections[sectionKey] ?? []).filter((r) => r.__key !== key),
      },
    }));
  }

  function reorder(sectionKey: string, from: number, to: number) {
    setDoc((prev) => ({
      ...prev,
      sections: { ...prev.sections, [sectionKey]: moveItem(prev.sections[sectionKey] ?? [], from, to) },
    }));
  }

  function enterRaw() {
    setRawText(serialized);
    setMode("raw");
  }

  function applyRaw() {
    const parsed = parseRulesJson(rawText);
    if (!parsed.ok) return;
    setDoc(toEditorDoc(parsed.doc));
    setMode("view");
  }

  function save() {
    setSaveError(null);
    startSave(async () => {
      const result = await saveRules(serialized);
      if (result.ok) {
        setSavedContent(serialized);
        router.refresh();
      } else {
        setSaveError(result.error);
      }
    });
  }

  function exportRules() {
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rules.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  let saveLabel = "Kaydedildi";
  if (saving) saveLabel = "Kaydediliyor…";
  else if (dirty) saveLabel = "Kaydet";

  return (
    <div className="mt-5">
      <ConfirmDialog />
      <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        {errorCount > 0 ? (
          <span className="flex items-center gap-2 text-[13px] text-destructive" title="Geçersiz kurallar Trino tarafından reddedilir">
            <ShieldX className="size-[18px]" /> Trino&apos;da ayağa kalkmaz
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[13px]" title="Yapısal doğrulama geçti">
            <CheckCircle2 className="size-[18px] text-success" /> Trino&apos;da ayağa kalkar
          </span>
        )}
        <span className="text-[13px] text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{totalRules}</span> kural ·{" "}
          <span className="font-semibold tabular-nums text-foreground">{counts.tables}</span> table ·{" "}
          <span className="font-semibold tabular-nums text-foreground">{counts.catalogs}</span> catalog ·{" "}
          <span className="font-semibold tabular-nums text-foreground">{counts.schemas}</span> schema
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye /> Önizleme
          </Button>
          <Button variant="outline" size="sm" onClick={exportRules}>
            <Download /> Dışa aktar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPublish(true)}>
            <Rocket /> Yayınla
          </Button>
          <Tabs value={mode} onValueChange={(v) => (v === "raw" ? enterRaw() : setMode("view"))}>
            <TabsList>
              <TabsTrigger value="view"><Table2 className="mr-1 inline size-3.5" />Kurallar</TabsTrigger>
              <TabsTrigger value="raw"><Code className="mr-1 inline size-3.5" />Ham JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "raw" ? (
            <Button size="sm" disabled={!rawParsed?.ok} onClick={applyRaw}>
              Uygula
            </Button>
          ) : (
            <Button size="sm" disabled={errorCount > 0 || !dirty || saving} onClick={save}>
              <Save /> {saveLabel}
            </Button>
          )}
        </div>
      </Card>

      {issues.length > 0 && (
        <div className="mt-3 space-y-1">
          {issues.map((issue) => (
            <p
              key={issue.message}
              className={cn(
                "flex items-center gap-1.5 text-[12px]",
                issue.severity === "error" ? "text-destructive" : "text-warning",
              )}
            >
              <AlertTriangle className="size-3.5 flex-none" />
              {issue.message}
            </p>
          ))}
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="mt-2 space-y-1">
          {conflicts.map((c) => (
            <p key={`${c.section}-${c.index}-${c.kind}`} className="flex items-center gap-1.5 text-[12px] text-warning">
              <AlertTriangle className="size-3.5 flex-none" />
              {c.message}
            </p>
          ))}
        </div>
      )}
      {saveError && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-destructive">
          <AlertTriangle className="size-3.5" />
          {saveError}
        </p>
      )}

      {mode === "raw" ? (
        <div className="mt-4">
          <Textarea
            className={cn("min-h-[520px] font-mono text-[12px] leading-relaxed", rawParsed && !rawParsed.ok && "border-destructive")}
            spellCheck={false}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          {rawParsed && !rawParsed.ok && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-destructive">
              <AlertTriangle className="size-3.5" />
              {rawParsed.error}
            </p>
          )}
          <p className="mt-1 text-[12px] text-muted-foreground">
            “Uygula” ile yapısal düzenleyiciye aktarın, sonra kaydedin.
          </p>
        </div>
      ) : (
        <div>
          {SECTIONS.map((section) => (
            <SectionEditor
              key={section.key}
              section={section}
              items={doc.sections[section.key] ?? []}
              onAdd={() => setEditing({ section, item: null })}
              onEdit={(item) => setEditing({ section, item })}
              onDelete={(item) => deleteRule(section.key, item.__key)}
              onReorder={(from, to) => reorder(section.key, from, to)}
            />
          ))}

          {otherSections.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Code className="size-3.5" />
              Diğer bölümler ({otherSections.join(", ")}) korunuyor — “Ham JSON” sekmesinden düzenlenir.
            </p>
          )}
        </div>
      )}

      {editing && (
        <RuleDrawer
          section={editing.section}
          item={editing.item}
          onSave={onSaveRule}
          onClose={() => setEditing(null)}
        />
      )}

      {showPublish && <PublishDialog env={env} onClose={() => setShowPublish(false)} />}
      {showPreview && <AccessPreview doc={outputDoc} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
