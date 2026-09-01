"use client";

import { useMemo, useState } from "react";
import { Check, Database, X } from "lucide-react";
import type { RulesDocument } from "@/lib/rules/schema";
import {
  ALL_TABLE_PRIVILEGES,
  evaluateAllTablePrivileges,
  evaluateCatalogAccess,
} from "@/lib/rules/effective";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CATALOG_ACCESS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  all: "success",
  "read-only": "warning",
  none: "destructive",
};

/**
 * Rule preview ("Bu user/grup şu aksiyonu yapabilir mi?") — requirement 2.1.
 * Evaluates the in-editor rules document with Trino's first-match-wins semantics
 * (see src/lib/rules/effective.ts) and shows the verdict per table privilege.
 */
export function AccessPreview({
  doc,
  onClose,
}: Readonly<{ doc: RulesDocument; onClose: () => void }>) {
  const [user, setUser] = useState("");
  const [groups, setGroups] = useState("");
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");
  const [table, setTable] = useState("");

  const subject = useMemo(
    () => ({ user, groups: groups.split(",").map((g) => g.trim()).filter(Boolean) }),
    [user, groups],
  );
  const tableResults = useMemo(
    () => evaluateAllTablePrivileges(doc, subject, { catalog, schema, table }),
    [doc, subject, catalog, schema, table],
  );
  const catalogAccess = useMemo(() => evaluateCatalogAccess(doc, subject, { catalog }), [doc, subject, catalog]);

  const ready = catalog.trim().length > 0 && schema.trim().length > 0 && table.trim().length > 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Erişim Önizleme</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-5">
          <p className="text-[12px] text-muted-foreground">
            Bir kullanıcı/grubu ve hedef tabloyu girin; mevcut kuralların{" "}
            <span className="font-medium text-foreground">ilk eşleşen kazanır</span> mantığıyla bu kişiye
            hangi yetkileri verdiğini görün.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Kullanıcı</Label>
              <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="ör. ali.veli" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Gruplar (virgülle)</Label>
              <Input value={groups} onChange={(e) => setGroups(e.target.value)} placeholder="ör. analysts, finance" />
            </div>
            <div className="space-y-1.5">
              <Label>Katalog</Label>
              <Input value={catalog} onChange={(e) => setCatalog(e.target.value)} placeholder="prod" />
            </div>
            <div className="space-y-1.5">
              <Label>Şema</Label>
              <Input value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="public" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tablo</Label>
              <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="orders" />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-[13px]">
            <Database className="size-4 text-muted-foreground" />
            <span>Katalog erişimi</span>
            <Badge variant={CATALOG_ACCESS_VARIANT[catalogAccess.access]} className="ml-auto">
              {catalogAccess.access}
            </Badge>
          </div>

          {!ready ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-[12px] text-muted-foreground">
              Tablo yetkilerini görmek için katalog, şema ve tablo girin.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Yetki</TableHead>
                    <TableHead>Sonuç</TableHead>
                    <TableHead>Eşleşen kural</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_TABLE_PRIVILEGES.map((privilege) => {
                    const r = tableResults[privilege];
                    return (
                      <TableRow key={privilege}>
                        <TableCell className="font-mono text-[13px]">{privilege}</TableCell>
                        <TableCell>
                          <Badge variant={r.allowed ? "success" : "destructive"}>
                            {r.allowed ? <Check /> : <X />}
                            {r.allowed ? "İzin" : "Red"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {r.matchedIndex >= 0 ? `tables[${r.matchedIndex}]` : "eşleşme yok (varsayılan red)"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
