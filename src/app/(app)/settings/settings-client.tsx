"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { assignRole, removeRole, runRetentionCleanup, type ActionResult, type RetentionResult } from "./actions";
import { SCOPABLE_CONFIG_TYPES, CONFIG_TYPE_LABEL } from "@/lib/config-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type RoleRow = {
  id: string;
  username: string;
  role: string;
  scope: string;
  scopeConfigTypes: string[];
  scopeResourceGroups: string[];
};
export type EnvOption = { id: string; name: string };

const ROLE_LABEL: Record<string, string> = {
  VIEWER: "Görüntüleyici",
  CONFIG_EDITOR: "Config Editör",
  PLATFORM_ADMIN: "Platform Admin",
};
type BadgeVariant = "neutral" | "info" | "primarySoft";
const ROLE_VARIANT: Record<string, BadgeVariant> = {
  VIEWER: "neutral",
  CONFIG_EDITOR: "info",
  PLATFORM_ADMIN: "primarySoft",
};

export function SettingsClient({
  rows,
  envOptions,
  myRole,
  unconfigured,
}: Readonly<{ rows: RoleRow[]; envOptions: EnvOption[]; myRole: string; unconfigured: boolean }>) {
  const router = useRouter();
  const [, start] = useTransition();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => assignRole(_prev, formData),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("VIEWER");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const [retentionResult, setRetentionResult] = useState<RetentionResult | null>(null);
  const [retentionPending, setRetentionPending] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  async function remove(row: RoleRow) {
    const ok = await confirm({
      title: "Rolü kaldır",
      description: `"${row.username}" için ${ROLE_LABEL[row.role]} rolünü kaldır?`,
      confirmLabel: "Kaldır",
      variant: "destructive",
    });
    if (!ok) return;
    start(async () => {
      await removeRole(row.id);
      router.refresh();
    });
  }

  async function handleRetentionCleanup() {
    const ok = await confirm({
      title: "Temizleme onayı",
      description: "Eski audit log ve config versiyonları silinecek. Devam edilsin mi?",
      confirmLabel: "Temizle",
      variant: "destructive",
    });
    if (!ok) return;
    setRetentionPending(true);
    setRetentionResult(null);
    try {
      const result = await runRetentionCleanup();
      setRetentionResult(result);
    } finally {
      setRetentionPending(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <ConfirmDialog />
      <Card className="flex-row flex-wrap items-center gap-3 px-4 py-3">
        <ShieldCheck className="size-4 text-primary" />
        <span className="text-[13px]">
          Geçerli rolünüz:{" "}
          <Badge variant={ROLE_VARIANT[myRole] ?? "neutral"} className="ml-1">{ROLE_LABEL[myRole] ?? myRole}</Badge>
        </span>
        {unconfigured && (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-warning">
            <AlertTriangle className="size-3.5" />
            Hiç rol atanmamış — herkes geçici olarak Platform Admin. İlk rolü atayınca uygulanır.
          </span>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Rol ata</h2>
        <form ref={formRef} action={action} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="role-username">Kullanıcı adı</Label>
            <Input id="role-username" name="username" className="w-56" placeholder="ör. ali.veli veya e-posta" />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select name="role" value={role} onValueChange={(v) => setRole(v ?? "VIEWER")}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Görüntüleyici</SelectItem>
                <SelectItem value="CONFIG_EDITOR">Config Editör</SelectItem>
                <SelectItem value="PLATFORM_ADMIN">Platform Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ortam kapsamı</Label>
            <Select name="scope" defaultValue="global">
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (tüm ortamlar)</SelectItem>
                {envOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Plus /> {pending ? "Atanıyor…" : "Ata"}
          </Button>

          {/* Fine-grained scope (requirement 3.2) — only meaningful for a Config Editor. */}
          {role === "CONFIG_EDITOR" && (
            <div className="mt-2 w-full space-y-3 rounded-lg border border-dashed p-3">
              <p className="text-[12px] text-muted-foreground">
                İnce kapsam (opsiyonel). Boş bırakılırsa Config Editör tüm dosyaları/grupları düzenleyebilir.
              </p>
              <div className="space-y-1.5">
                <Label>Yalnızca bu config dosyaları</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {SCOPABLE_CONFIG_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-[13px]">
                      <Checkbox name="scopeConfigTypes" value={t} />
                      {CONFIG_TYPE_LABEL[t]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scope-rgs">Yalnızca bu resource-group&apos;lar (virgülle)</Label>
                <Input id="scope-rgs" name="scopeResourceGroups" className="w-full max-w-md" placeholder="ör. etl, adhoc.reports" />
              </div>
            </div>
          )}
        </form>
        {state && !state.ok && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-destructive">
            <AlertTriangle className="size-3.5" /> {state.error}
          </p>
        )}
      </Card>

      {/* Retention cleanup — PLATFORM_ADMIN only action */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Veri saklama politikası</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Eski audit log kayıtlarını ve fazla config versiyonlarını temizler.
          Saklama süreleri <code>AUDIT_RETENTION_DAYS</code> (varsayılan 90 gün) ve{" "}
          <code>CONFIG_VERSION_KEEP</code> (varsayılan 10 versiyon) ile ayarlanır.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetentionCleanup}
            disabled={retentionPending || myRole !== "PLATFORM_ADMIN"}
            className="gap-1.5"
          >
            {retentionPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Temizle
          </Button>
          {retentionResult && retentionResult.ok && (
            <span className="text-[12px] text-muted-foreground">
              Silindi:{" "}
              <span className="font-semibold text-foreground">{retentionResult.auditLogsDeleted}</span> audit log,{" "}
              <span className="font-semibold text-foreground">{retentionResult.configVersionsDeleted}</span> config versiyonu
            </span>
          )}
          {retentionResult && !retentionResult.ok && (
            <span className="flex items-center gap-1.5 text-[12px] text-destructive">
              <AlertTriangle className="size-3.5" /> {retentionResult.error}
            </span>
          )}
        </div>
      </Card>

      <Card className="gap-0 py-0">
        <div className="border-b px-5 py-3 text-sm font-semibold">Rol atamaları</div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">Henüz rol atanmamış.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Ortam</TableHead>
                <TableHead>Yetki kapsamı</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-[13px]">{row.username}</TableCell>
                  <TableCell><Badge variant={ROLE_VARIANT[row.role] ?? "neutral"}>{ROLE_LABEL[row.role] ?? row.role}</Badge></TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{row.scope === "global" ? "Global" : row.scope}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.role !== "CONFIG_EDITOR" || (row.scopeConfigTypes.length === 0 && row.scopeResourceGroups.length === 0) ? (
                      <span className="text-muted-foreground/70">Tüm dosyalar</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.scopeConfigTypes.map((t) => (
                          <Badge key={t} variant="neutral">{CONFIG_TYPE_LABEL[t as keyof typeof CONFIG_TYPE_LABEL] ?? t}</Badge>
                        ))}
                        {row.scopeResourceGroups.map((g) => (
                          <Badge key={g} variant="info">RG: {g}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" title="Kaldır" onClick={() => remove(row)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
