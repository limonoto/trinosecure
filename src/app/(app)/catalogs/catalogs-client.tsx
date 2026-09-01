"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { CONNECTORS, getConnector } from "@/lib/catalogs/connectors";
import {
  createCatalog,
  updateCatalog,
  deleteCatalog,
  exportCatalog,
  type ActionResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type CatalogItem = {
  id: string;
  name: string;
  connector: string;
  properties: Record<string, string>;
};

type ExtraRow = { key: string; value: string };

function CatalogSheet({
  item,
  onClose,
}: Readonly<{ item: CatalogItem | null; onClose: (saved: boolean) => void }>) {
  const editing = item !== null;
  const [name, setName] = useState(item?.name ?? "");
  const [connector, setConnector] = useState(item?.connector ?? "postgresql");
  const def = getConnector(connector);

  const [values, setValues] = useState<Record<string, string>>(item?.properties ?? {});
  const [extras, setExtras] = useState<ExtraRow[]>(() =>
    Object.entries(item?.properties ?? {})
      .filter(([k]) => !getConnector(item?.connector ?? "")?.params.some((p) => p.key === k))
      .map(([key, value]) => ({ key, value })),
  );

  const propertiesJson = useMemo(() => {
    const out: Record<string, string> = {};
    for (const param of def?.params ?? []) {
      const v = values[param.key];
      if (v !== undefined && v !== "") out[param.key] = v;
    }
    for (const row of extras) {
      if (row.key.trim() !== "" && row.value !== "") out[row.key.trim()] = row.value;
    }
    return JSON.stringify(out);
  }, [def, values, extras]);

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => (editing ? updateCatalog(_prev, formData) : createCatalog(_prev, formData)),
    null,
  );

  useEffect(() => {
    if (state?.ok) onClose(true);
  }, [state, onClose]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose(false)}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? "Katalog düzenle" : "Yeni katalog"}</SheetTitle>
        </SheetHeader>
        <form action={action} className="flex min-h-0 flex-1 flex-col">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="properties" value={propertiesJson} />
          <input type="hidden" name="connector" value={connector} />

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Katalog adı</Label>
              <Input id="cat-name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. analytics" />
              <p className="text-[11px] text-muted-foreground">küçük harf, rakam, alt çizgi</p>
            </div>

            <div className="space-y-1.5">
              <Label>Connector</Label>
              <Select value={connector} onValueChange={(v) => v && setConnector(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONNECTORS.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.label} ({c.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(def?.params.length ?? 0) > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Önerilen parametreler</p>
                {def?.params.map((param) => (
                  <div key={param.key} className="space-y-1.5">
                    <Label className="gap-1.5">
                      {param.label}
                      {param.required && <span className="text-destructive">*</span>}
                      <span className="font-mono text-[11px] font-normal text-muted-foreground">{param.key}</span>
                    </Label>
                    <Input
                      type={param.secret ? "password" : "text"}
                      value={values[param.key] ?? ""}
                      placeholder={param.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [param.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ek parametreler</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setExtras((r) => [...r, { key: "", value: "" }])}>
                  <Plus /> Parametre ekle
                </Button>
              </div>
              {extras.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="flex-1 font-mono text-[12px]"
                    placeholder="anahtar"
                    value={row.key}
                    onChange={(e) => setExtras((rows) => rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))}
                  />
                  <Input
                    className="flex-1 font-mono text-[12px]"
                    placeholder="değer"
                    value={row.value}
                    onChange={(e) => setExtras((rows) => rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Kaldır" onClick={() => setExtras((rows) => rows.filter((_, i) => i !== index))}>
                    <X />
                  </Button>
                </div>
              ))}
            </div>

            {state && !state.ok && (
              <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                <AlertTriangle className="size-3.5" /> {state.error}
              </p>
            )}
          </div>

          <SheetFooter className="flex-row justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onClose(false)}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function CatalogsClient({ catalogs }: Readonly<{ catalogs: CatalogItem[] }>) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ item: CatalogItem | null } | null>(null);
  const [, start] = useTransition();
  const { confirm, ConfirmDialog } = useConfirm();

  async function remove(item: CatalogItem) {
    const ok = await confirm({
      title: "Silme onayı",
      description: `"${item.name}" katalogunu silmek istediğinize emin misiniz?`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    start(async () => {
      await deleteCatalog(item.id);
      router.refresh();
    });
  }

  function exportOne(item: CatalogItem) {
    start(async () => {
      const result = await exportCatalog(item.id);
      if (!result.ok) return;
      const blob = new Blob([result.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.name}.properties`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <ConfirmDialog />
      <Card className="flex-row items-center gap-3 px-4 py-3">
        <span className="text-[13px] text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{catalogs.length}</span> katalog
        </span>
        <Button size="sm" className="ml-auto" onClick={() => setEditing({ item: null })}>
          <Plus /> Yeni katalog
        </Button>
      </Card>

      <Card className="gap-0 py-0">
        {catalogs.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Henüz katalog yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Katalog</TableHead>
                <TableHead>Connector</TableHead>
                <TableHead>Parametre</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Database className="size-4 text-muted-foreground" />
                      <span className="font-mono text-[13px]">{c.name}</span>
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="primarySoft">{c.connector}</Badge></TableCell>
                  <TableCell className="tabular-nums text-[13px] text-muted-foreground">
                    {Object.keys(c.properties).length}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" title="Dışa aktar" onClick={() => exportOne(c)}>
                        <Download />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Düzenle" onClick={() => setEditing({ item: c })}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" title="Sil" onClick={() => remove(c)}>
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

      {editing && (
        <CatalogSheet
          item={editing.item}
          onClose={(saved) => {
            setEditing(null);
            if (saved) router.refresh();
          }}
        />
      )}
    </div>
  );
}
