"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, BellRing, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { ALERT_METRICS, metricLabel } from "@/lib/alerts/evaluate";
import { cn } from "@/lib/utils";
import { createAlertRule, toggleAlertRule, deleteAlertRule, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type RuleRow = {
  id: string;
  name: string;
  kind: string;
  metric: string;
  comparator: string;
  threshold: number;
  window: string;
  enabled: boolean;
  status: string | null;
};
export type EventRow = { id: string; rule: string; status: string; value: number; ts: string };

const COMPARATOR_SYMBOL: Record<string, string> = { GT: ">", GTE: "≥", LT: "<", LTE: "≤" };

function conditionText(r: RuleRow): string {
  if (r.kind === "DYNAMIC") return `anomali ≥ ${r.threshold}σ`;
  return `${COMPARATOR_SYMBOL[r.comparator] ?? r.comparator} ${r.threshold}`;
}

function StatusBadge({ status }: Readonly<{ status: string | null }>) {
  if (status === "FIRING") return <Badge variant="destructive">Aktif</Badge>;
  if (status === "RESOLVED") return <Badge variant="success">Çözüldü</Badge>;
  return <Badge variant="neutral">—</Badge>;
}

function CreateDialog({ onClose }: Readonly<{ onClose: (saved: boolean) => void }>) {
  const [kind, setKind] = useState("STATIC");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => createAlertRule(_prev, formData),
    null,
  );
  useEffect(() => {
    if (state?.ok) onClose(true);
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni alarm kuralı</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="al-name">Ad</Label>
            <Input id="al-name" name="name" placeholder="ör. Yüksek hata oranı" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select name="kind" value={kind} onValueChange={(v) => v && setKind(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATIC">Statik eşik</SelectItem>
                  <SelectItem value="DYNAMIC">Dinamik anomali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-window">Pencere</Label>
              <Input id="al-window" name="window" className="font-mono" defaultValue="5m" placeholder="5m" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Metrik</Label>
            <Select name="metric" defaultValue="error_rate">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALERT_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{kind === "DYNAMIC" ? "Karşılaştırma (kullanılmaz)" : "Karşılaştırma"}</Label>
              <Select name="comparator" defaultValue="GT" disabled={kind === "DYNAMIC"}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GT">&gt; büyük</SelectItem>
                  <SelectItem value="GTE">≥ büyük/eşit</SelectItem>
                  <SelectItem value="LT">&lt; küçük</SelectItem>
                  <SelectItem value="LTE">≤ küçük/eşit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-threshold">{kind === "DYNAMIC" ? "Hassasiyet (kσ)" : "Eşik"}</Label>
              <Input id="al-threshold" name="threshold" type="number" step="any" defaultValue={kind === "DYNAMIC" ? "3" : "5"} />
            </div>
          </div>
          {state && !state.ok && (
            <p className="flex items-center gap-1.5 text-[12px] text-destructive">
              <AlertTriangle className="size-3.5" /> {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onClose(false)}>Vazgeç</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AlertsClient({ rules, events }: Readonly<{ rules: RuleRow[]; events: EventRow[] }>) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();
  const { confirm, ConfirmDialog } = useConfirm();

  function toggle(rule: RuleRow) {
    start(async () => {
      await toggleAlertRule(rule.id, !rule.enabled);
      router.refresh();
    });
  }

  async function remove(rule: RuleRow) {
    const ok = await confirm({
      title: "Silme onayı",
      description: `"${rule.name}" kuralını silmek istediğinize emin misiniz?`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    start(async () => {
      await deleteAlertRule(rule.id);
      router.refresh();
    });
  }

  const firing = rules.filter((r) => r.status === "FIRING").length;

  return (
    <div className="mt-5 space-y-5">
      <ConfirmDialog />
      <Card className="flex-row items-center gap-3 px-4 py-3">
        <BellRing className={cn("size-4", firing > 0 ? "text-destructive" : "text-muted-foreground")} />
        <span className="text-[13px]">
          {firing > 0 ? (
            <span className="text-destructive">{firing} alarm aktif</span>
          ) : (
            <span className="text-muted-foreground">Aktif alarm yok</span>
          )}
        </span>
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> Yeni alarm
        </Button>
      </Card>

      <Card className="gap-0 py-0">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">Kurallar</div>
        {rules.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Henüz alarm kuralı yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Metrik</TableHead>
                <TableHead>Koşul</TableHead>
                <TableHead>Pencere</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Aktif</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{metricLabel(r.metric)}</TableCell>
                  <TableCell className="font-mono text-[13px]">{conditionText(r)}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{r.window}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell><Switch checked={r.enabled} onCheckedChange={() => toggle(r)} aria-label="Aktif/pasif" /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" title="Sil" onClick={() => remove(r)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="gap-0 py-0">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">Alarm geçmişi</div>
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Henüz alarm olayı yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zaman</TableHead>
                <TableHead>Kural</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Değer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-[12px] text-muted-foreground">
                    {formatDistanceToNow(new Date(e.ts), { addSuffix: true, locale: tr })}
                  </TableCell>
                  <TableCell className="font-medium">{e.rule}</TableCell>
                  <TableCell>
                    {e.status === "FIRING" ? (
                      <Badge variant="destructive"><AlertTriangle className="size-3" /> Tetiklendi</Badge>
                    ) : (
                      <Badge variant="success"><CheckCircle2 className="size-3" /> Çözüldü</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-[13px]">{e.value.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {creating && (
        <CreateDialog
          onClose={(saved) => {
            setCreating(false);
            if (saved) router.refresh();
          }}
        />
      )}
    </div>
  );
}
