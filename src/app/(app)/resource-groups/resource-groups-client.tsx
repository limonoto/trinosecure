"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code,
  Download,
  Layers,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { ResourceGroup } from "@/lib/resource-groups/schema";
import { parseResourceGroups, serializeResourceGroups } from "@/lib/resource-groups/schema";
import {
  childrenMemoryOverflow,
  deleteGroupAtPath,
  insertGroup,
  parseMemoryPercent,
  updateGroupAtPath,
} from "@/lib/resource-groups/tree";
import { cn } from "@/lib/utils";
import { saveResourceGroups } from "./actions";
import { GroupFormDialog } from "./group-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ─── Limit bars ──────────────────────────────────────────────────────────────

function MemoryBar({ softPct, parentPct }: { softPct: number; parentPct: number | null }) {
  const width = Math.min(100, softPct);
  return (
    <div className="flex items-center gap-2">
      <span className="w-[60px] text-right font-mono text-[11px] text-muted-foreground">
        bellek
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        {/* Parent reference line */}
        {parentPct !== null && parentPct < 100 && (
          <div
            className="absolute top-0 h-full w-[1px] bg-muted-foreground/40"
            style={{ left: `${parentPct}%` }}
          />
        )}
        <div
          className="h-full rounded-full bg-info transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-[44px] font-mono text-[11px] tabular-nums text-foreground">
        {softPct}%
        {parentPct !== null && (
          <span className="ml-0.5 text-muted-foreground">
            /{parentPct}
          </span>
        )}
      </span>
    </div>
  );
}

function ConcurrencyBar({
  hard,
  soft,
  maxHard,
}: {
  hard: number | undefined;
  soft: number | undefined;
  maxHard: number;
}) {
  if (!hard && !soft) return null;
  const hardWidth = hard ? Math.min(100, (hard / maxHard) * 100) : 0;
  const softWidth = soft ? Math.min(100, (soft / maxHard) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[60px] text-right font-mono text-[11px] text-muted-foreground">
        eşzamanlı
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        {soft !== undefined && (
          <div
            className="absolute h-full rounded-full bg-warning/50"
            style={{ width: `${softWidth}%` }}
          />
        )}
        {hard !== undefined && (
          <div
            className="absolute h-full rounded-full bg-destructive/70"
            style={{ width: `${hardWidth}%` }}
          />
        )}
      </div>
      <span className="w-[44px] font-mono text-[11px] tabular-nums text-foreground">
        {hard !== undefined && <span className="text-destructive">{hard}</span>}
        {soft !== undefined && hard !== undefined && (
          <span className="text-muted-foreground">/{soft}</span>
        )}
        {soft !== undefined && hard === undefined && (
          <span className="text-warning">{soft}</span>
        )}
      </span>
    </div>
  );
}

// ─── Tree node ───────────────────────────────────────────────────────────────

type NodeProps = {
  group: ResourceGroup;
  path: string;
  depth: number;
  isLast: boolean;
  parentMemPct: number | null;
  maxConcurrency: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onEdit: (path: string, group: ResourceGroup, parent: ResourceGroup | null) => void;
  onAddChild: (parentPath: string, parent: ResourceGroup) => void;
  onDelete: (path: string) => void;
  parentGroup: ResourceGroup | null;
};

function GroupNode({
  group,
  path,
  depth,
  isLast,
  parentMemPct,
  maxConcurrency,
  collapsed,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  parentGroup,
}: NodeProps) {
  const hasChildren = !!group.subGroups?.length;
  const isCollapsed = collapsed.has(path);
  const memPct = parseMemoryPercent(group.softMemoryLimit);
  const overflowPct = childrenMemoryOverflow(group);
  const softCpu = (group as Record<string, unknown>).softCpuLimit as string | undefined;
  const hardCpu = (group as Record<string, unknown>).hardCpuLimit as string | undefined;

  return (
    <div className="relative">
      {/* Connector lines */}
      {depth > 0 && (
        <>
          {/* Vertical line going up */}
          <div
            className={cn(
              "absolute left-0 top-0 w-[1px] bg-border",
              isLast ? "h-[22px]" : "h-full",
            )}
          />
          {/* Horizontal connector */}
          <div className="absolute left-0 top-[22px] h-[1px] w-[14px] bg-border" />
        </>
      )}

      {/* Row */}
      <div
        className={cn(
          "group/row relative rounded-md px-3 py-2 hover:bg-muted/40",
          depth > 0 && "ml-[14px]",
        )}
      >
        {/* Header line */}
        <div className="flex items-center gap-2">
          {/* Expand/collapse */}
          {hasChildren ? (
            <button
              onClick={() => onToggle(path)}
              className="flex size-4 flex-none items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          ) : (
            <Layers className="size-4 flex-none text-muted-foreground" />
          )}

          <span className="font-mono text-[13px] font-medium">{group.name}</span>

          {group.schedulingPolicy && (
            <Badge variant="neutral" className="text-[10px]">
              {group.schedulingPolicy}
            </Badge>
          )}
          {group.schedulingWeight !== undefined && (
            <Badge variant="neutral" className="text-[10px]">
              w:{group.schedulingWeight}
            </Badge>
          )}
          {group.jmxExport && (
            <Badge variant="neutral" className="text-[10px]">
              jmx
            </Badge>
          )}
          {group.maxQueued !== undefined && (
            <Badge variant="neutral" className="text-[10px]">
              kuyruk:{group.maxQueued}
            </Badge>
          )}
          {overflowPct !== null && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="mr-0.5 size-2.5" />
              alt gruplar toplamı: {overflowPct}%
            </Badge>
          )}

          {/* Actions — shown on hover */}
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title="Alt grup ekle"
              onClick={() => onAddChild(path, group)}
            >
              <Plus className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title="Düzenle"
              onClick={() => onEdit(path, group, parentGroup)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-destructive hover:text-destructive"
              title="Sil"
              onClick={() => onDelete(path)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Limit bars */}
        <div className="mt-1.5 space-y-1 pl-6">
          {memPct !== null && (
            <MemoryBar softPct={memPct} parentPct={parentMemPct} />
          )}
          {group.softMemoryLimit && memPct === null && (
            <div className="flex items-center gap-2">
              <span className="w-[60px] text-right font-mono text-[11px] text-muted-foreground">bellek</span>
              <span className="font-mono text-[11px]">{group.softMemoryLimit}</span>
            </div>
          )}
          {(group.hardConcurrencyLimit !== undefined || group.softConcurrencyLimit !== undefined) && (
            <ConcurrencyBar
              hard={group.hardConcurrencyLimit}
              soft={group.softConcurrencyLimit}
              maxHard={maxConcurrency}
            />
          )}
          {(softCpu ?? hardCpu) && (
            <div className="flex items-center gap-2">
              <span className="w-[60px] text-right font-mono text-[11px] text-muted-foreground">cpu</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                soft:{softCpu ?? "—"} · hard:{hardCpu ?? "—"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div className={cn("relative", depth > 0 && "ml-[14px]")}>
          {group.subGroups!.map((child, i) => (
            <GroupNode
              key={`${path}.${child.name}`}
              group={child}
              path={`${path}.${child.name}`}
              depth={depth + 1}
              isLast={i === group.subGroups!.length - 1}
              parentMemPct={memPct}
              maxConcurrency={maxConcurrency}
              collapsed={collapsed}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              parentGroup={group}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dialog state ─────────────────────────────────────────────────────────────

type DialogState =
  | { type: "add-root" }
  | { type: "add-child"; parentPath: string; parentGroup: ResourceGroup }
  | { type: "edit"; path: string; group: ResourceGroup; parentGroup: ResourceGroup | null }
  | null;

// ─── Main client ─────────────────────────────────────────────────────────────

export function ResourceGroupsClient({ initialContent }: Readonly<{ initialContent: string }>) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [mode, setMode] = useState<"view" | "raw">("view");
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const parsed = useMemo(() => parseResourceGroups(content), [content]);
  const roots: ResourceGroup[] = parsed.ok ? (parsed.doc.rootGroups ?? []) : [];
  const selectors = parsed.ok ? (parsed.doc.selectors ?? []) : [];
  const dirty = content !== savedContent;

  const maxConcurrency = useMemo(() => {
    if (!parsed.ok) return 50;
    const all = (function collect(groups: ResourceGroup[]): number[] {
      return groups.flatMap((g) => [
        g.hardConcurrencyLimit ?? 0,
        ...collect(g.subGroups ?? []),
      ]);
    })(parsed.doc.rootGroups ?? []);
    return Math.max(50, ...all);
  }, [parsed]);

  function applyMutation(newRoots: ResourceGroup[]) {
    if (!parsed.ok) return;
    const next = serializeResourceGroups({ ...parsed.doc, rootGroups: newRoots });
    setContent(next);
  }

  function handleToggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function handleDialogSave(group: ResourceGroup) {
    if (!dialog) return;
    if (dialog.type === "add-root") {
      applyMutation(insertGroup(roots, null, group));
    } else if (dialog.type === "add-child") {
      applyMutation(insertGroup(roots, dialog.parentPath, group));
    } else if (dialog.type === "edit") {
      const { subGroups: _, ...fields } = group;
      applyMutation(updateGroupAtPath(roots, dialog.path, fields));
    }
    setDialog(null);
  }

  async function handleDelete(path: string) {
    const ok = await confirm({
      title: "Silme onayı",
      description: `"${path}" grubunu silmek istediğinizden emin misiniz?`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    applyMutation(deleteGroupAtPath(roots, path));
  }

  function save() {
    setError(null);
    startSave(async () => {
      const result = await saveResourceGroups(content);
      if (result.ok) {
        setSavedContent(content);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function exportFile() {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resource-groups.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Dialog metadata
  const dialogTitle =
    dialog?.type === "add-root"
      ? "Kök Grup Ekle"
      : dialog?.type === "add-child"
        ? `Alt Grup Ekle → ${dialog.parentPath}`
        : dialog?.type === "edit"
          ? `Düzenle: ${dialog.path}`
          : "";

  const dialogInitial = dialog?.type === "edit" ? dialog.group : undefined;
  const dialogParent =
    dialog?.type === "add-child"
      ? dialog.parentGroup
      : dialog?.type === "edit"
        ? dialog.parentGroup
        : null;

  let saveLabel = "Kaydedildi";
  if (saving) saveLabel = "Kaydediliyor…";
  else if (dirty) saveLabel = "Kaydet";

  return (
    <>
      <ConfirmDialog />
      <div className="mt-5 space-y-4">
        {/* Toolbar */}
        <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          {parsed.ok ? (
            <span className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="size-[18px] text-success" /> Geçerli yapı
            </span>
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-destructive">
              <AlertTriangle className="size-[18px]" /> Geçersiz JSON / yapı
            </span>
          )}
          <span className="text-[13px] text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{roots.length === 0 ? 0 : (function count(gs: ResourceGroup[]): number { return gs.reduce((s, g) => s + 1 + count(g.subGroups ?? []), 0); })(roots)}</span> grup ·{" "}
            <span className="font-semibold tabular-nums text-foreground">{selectors.length}</span> seçici
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportFile}>
              <Download /> Dışa aktar
            </Button>
            <Tabs value={mode} onValueChange={(v) => setMode(v === "raw" ? "raw" : "view")}>
              <TabsList>
                <TabsTrigger value="view">
                  <Layers className="mr-1 inline size-3.5" />Ağaç
                </TabsTrigger>
                <TabsTrigger value="raw">
                  <Code className="mr-1 inline size-3.5" />Ham JSON
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" disabled={!parsed.ok || !dirty || saving} onClick={save}>
              <Save /> {saveLabel}
            </Button>
          </div>
        </Card>

        {!parsed.ok && (
          <p className="flex items-center gap-1.5 text-[12px] text-destructive">
            <AlertTriangle className="size-3.5" /> {parsed.error}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-1.5 text-[12px] text-destructive">
            <AlertTriangle className="size-3.5" /> {error}
          </p>
        )}

        {mode === "raw" ? (
          <Textarea
            className={cn(
              "min-h-[560px] font-mono text-[12px] leading-relaxed",
              !parsed.ok && "border-destructive",
            )}
            spellCheck={false}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <div className="space-y-4">
            {/* Tree */}
            <Card className="gap-0 py-0">
              <div className="flex items-center border-b px-4 py-2.5">
                <span className="text-sm font-semibold">Hiyerarşi</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-[12px]"
                  onClick={() => setDialog({ type: "add-root" })}
                >
                  <Plus className="size-3.5" /> Kök Grup Ekle
                </Button>
              </div>

              {roots.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Kaynak grubu yok. &quot;Kök Grup Ekle&quot; butonunu kullanın.
                </p>
              ) : (
                <div className="px-3 py-2">
                  {roots.map((root, i) => (
                    <GroupNode
                      key={root.name}
                      group={root}
                      path={root.name}
                      depth={0}
                      isLast={i === roots.length - 1}
                      parentMemPct={null}
                      maxConcurrency={maxConcurrency}
                      collapsed={collapsed}
                      onToggle={handleToggle}
                      onEdit={(path, group, parent) => setDialog({ type: "edit", path, group, parentGroup: parent })}
                      onAddChild={(parentPath, parent) => setDialog({ type: "add-child", parentPath, parentGroup: parent })}
                      onDelete={handleDelete}
                      parentGroup={null}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded-full bg-info" /> softMemoryLimit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded-full bg-destructive/70" /> hardConcurrencyLimit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded-full bg-warning/50" /> softConcurrencyLimit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-[1px] bg-muted-foreground/40" /> üst grup limiti
              </span>
            </div>

            {/* Selectors */}
            {selectors.length > 0 && (
              <Card className="gap-0 py-0">
                <div className="border-b px-4 py-2.5 text-sm font-semibold">Seçiciler</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı Grubu</TableHead>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Kaynak</TableHead>
                      <TableHead>Hedef Grup</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectors.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-[13px]">
                          {(s as Record<string, unknown>).userGroup as string ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-[13px]">{s.user ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[13px]">{s.source ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[13px]">{s.group ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        )}
      </div>

      <GroupFormDialog
        open={dialog !== null}
        title={dialogTitle}
        initial={dialogInitial}
        parentGroup={dialogParent}
        onSave={handleDialogSave}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
