"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formString } from "@/lib/form";
import { cn } from "@/lib/utils";
import type { ColumnConstraint } from "@/lib/rules/schema";
import type { FieldConfig, SectionConfig } from "./rule-sections";
import type { EditorRule } from "./rule-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function opt(value: FormDataEntryValue | null): string | undefined {
  const text = formString(value).trim();
  return text === "" ? undefined : text;
}

type ColRow = { id: string; name: string; mask: string; allow: boolean };

let colCounter = 0;
function newColRow(partial: Partial<ColRow> = {}): ColRow {
  colCounter += 1;
  return { id: `c${colCounter}`, name: "", mask: "", allow: true, ...partial };
}

function toColRows(item: EditorRule | null): ColRow[] {
  const cols = item && Array.isArray(item.columns) ? item.columns : [];
  return cols.map((entry) => {
    const rec = entry as Record<string, unknown>;
    return newColRow({
      name: typeof rec.name === "string" ? rec.name : "",
      mask: typeof rec.mask === "string" ? rec.mask : "",
      allow: rec.allow !== false,
    });
  });
}

function buildColumns(rows: ColRow[]): ColumnConstraint[] {
  return rows
    .filter((row) => row.name.trim() !== "")
    .map((row) => {
      const col: ColumnConstraint = { name: row.name.trim() };
      if (!row.allow) col.allow = false;
      if (row.mask.trim() !== "") col.mask = row.mask.trim();
      return col;
    });
}

function buildRule(section: SectionConfig, fd: FormData, colRows: ColRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of section.fields) {
    switch (field.type) {
      case "text": {
        const value = opt(fd.get(field.name));
        if (value !== undefined) out[field.name] = value;
        break;
      }
      case "select":
        out[field.name] = formString(fd.get(field.name)) || (field.options?.[0] ?? "");
        break;
      case "bool":
        out[field.name] = fd.get(field.name) === "on";
        break;
      case "multi":
        out[field.name] = fd.getAll(field.name).map(String);
        break;
      case "columns": {
        const cols = buildColumns(colRows);
        if (cols.length > 0) out[field.name] = cols;
        break;
      }
    }
  }
  return out;
}

function defaultText(item: EditorRule | null, name: string): string {
  const value = item?.[name];
  return typeof value === "string" ? value : "";
}

function ScalarField({ field, item }: Readonly<{ field: FieldConfig; item: EditorRule | null }>) {
  const id = `f-${field.name}`;
  const wrap = cn("space-y-1.5", field.fullWidth && "col-span-2");
  if (field.type === "select") {
    return (
      <div className={wrap}>
        <Label htmlFor={id}>{field.label}</Label>
        <Select name={field.name} defaultValue={defaultText(item, field.name) || field.options?.[0]}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className={wrap}>
      <Label htmlFor={id}>{field.label}</Label>
      <Input id={id} name={field.name} className="font-mono" defaultValue={defaultText(item, field.name)} placeholder={field.placeholder} />
    </div>
  );
}

function multiChecked(item: EditorRule | null, name: string, option: string): boolean {
  const value = item?.[name];
  return Array.isArray(value) && value.map(String).includes(option);
}

export function RuleDrawer({
  section,
  item,
  onSave,
  onClose,
}: Readonly<{
  section: SectionConfig;
  item: EditorRule | null;
  onSave: (rule: Record<string, unknown>) => void;
  onClose: () => void;
}>) {
  const [cols, setCols] = useState<ColRow[]>(() => toColRows(item));

  const scalarFields = section.fields.filter((f) => f.type === "text" || f.type === "select");
  const boolFields = section.fields.filter((f) => f.type === "bool");
  const multiFields = section.fields.filter((f) => f.type === "multi");
  const columnsField = section.fields.find((f) => f.type === "columns");

  function updateCol(id: string, patch: Partial<ColRow>) {
    setCols((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(buildRule(section, new FormData(event.currentTarget), cols));
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {item ? "Kuralı düzenle" : "Yeni kural"} · {section.label}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-5">
            {scalarFields.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {scalarFields.map((field) => (
                  <ScalarField key={field.name} field={field} item={item} />
                ))}
              </div>
            )}

            {boolFields.map((field) => (
              <Label key={field.name} className="flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] font-normal">
                <Checkbox name={field.name} value="on" defaultChecked={item ? item[field.name] !== false : Boolean(field.defaultOn)} />
                {field.label}
              </Label>
            ))}

            {multiFields.map((field) => (
              <section key={field.name}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{field.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {field.options?.map((option) => (
                    <Label key={option} className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] font-normal transition-colors hover:bg-accent/50">
                      <Checkbox name={field.name} value={option} defaultChecked={multiChecked(item, field.name, option)} />
                      <span className="font-mono">{option}</span>
                    </Label>
                  ))}
                </div>
              </section>
            ))}

            {columnsField && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{columnsField.label}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCols((c) => [...c, newColRow()])}>
                    <Plus /> Sütun
                  </Button>
                </div>
                {cols.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    Sütun kısıtı yok. Bir sütunu maskelemek veya gizlemek için ekleyin.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cols.map((row) => (
                      <div key={row.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
                        <Input className="font-mono text-[13px]" placeholder="sütun adı" value={row.name} onChange={(e) => updateCol(row.id, { name: e.target.value })} />
                        <Input className="font-mono text-[13px]" placeholder="maske ifadesi (ops.)" value={row.mask} onChange={(e) => updateCol(row.id, { mask: e.target.value })} />
                        <Label className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-normal">
                          <Checkbox checked={row.allow} onCheckedChange={(c) => updateCol(row.id, { allow: c === true })} />
                          izin
                        </Label>
                        <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Sütunu kaldır" onClick={() => setCols((current) => current.filter((r) => r.id !== row.id))}>
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[12px] text-muted-foreground">
                  “izin” kapalıysa sütun gizlenir; “maske ifadesi” doluysa değer maskelenir.
                </p>
              </section>
            )}
          </div>

          <SheetFooter className="flex-row justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" size="sm">
              Kaydet
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
