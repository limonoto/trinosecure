"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, Server, Trash2, Wifi, WifiOff } from "lucide-react";
import {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  testConnection,
  testSshConnection,
  type ActionResult,
  type BootstrapResult,
  type SshTestResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type EnvironmentRow = {
  id: string;
  name: string;
  deliveryMode: "HTTP" | "FILE";
  configTarget: string;
  refreshPeriod: string | null;
  trinoBaseUrl: string | null;
  trinoUsername: string | null;
  createdAt: string;
};

type Editing = { type: "new" } | { type: "edit"; env: EnvironmentRow } | null;

export function EnvironmentsClient({ environments }: Readonly<{ environments: EnvironmentRow[] }>) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [isDeleting, startDelete] = useTransition();
  const { confirm, ConfirmDialog } = useConfirm();

  async function onDelete(env: EnvironmentRow) {
    const ok = await confirm({
      title: "Silme onayı",
      description: `"${env.name}" ortamını silmek istediğinize emin misiniz? Bağlı gruplar ve yapılandırmalar da silinir.`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    startDelete(async () => {
      await deleteEnvironment(env.id);
      router.refresh();
    });
  }

  return (
    <>
      <ConfirmDialog />
      <div className="mt-6 flex justify-end">
        <Button size="sm" onClick={() => setEditing({ type: "new" })}>
          <Plus /> Yeni ortam
        </Button>
      </div>

      {environments.length === 0 ? (
        <Card className="mt-3 items-center gap-3 p-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Server className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">Henüz ortam yok. İlk Trino ortamınızı ekleyin.</p>
        </Card>
      ) : (
        <Card className="mt-3 gap-0 py-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead>Yenileme</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {environments.map((env) => (
                <TableRow key={env.id}>
                  <TableCell className="font-medium">{env.name}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{env.configTarget}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{env.refreshPeriod ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" title="Düzenle" onClick={() => setEditing({ type: "edit", env })}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" title="Sil" disabled={isDeleting} onClick={() => onDelete(env)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {editing && (
        <EnvironmentDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BootstrapSummary({
  bootstrap,
  onClose,
}: Readonly<{ bootstrap: BootstrapResult; onClose: () => void }>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {bootstrap.connected ? (
          <>
            <Wifi className="size-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Bağlantı başarılı</span>
          </>
        ) : (
          <>
            <WifiOff className="size-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Bağlantı kurulamadı</span>
          </>
        )}
      </div>

      {bootstrap.warning && (
        <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          <AlertTriangle className="size-3.5 shrink-0" /> {bootstrap.warning}
        </p>
      )}

      {bootstrap.imported.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">İçe aktarıldı</p>
          <ul className="space-y-1">
            {bootstrap.imported.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[13px]">
                <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                <span className="font-mono">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bootstrap.skipped.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Bulunamadı / atlandı</p>
          <ul className="space-y-1">
            {bootstrap.skipped.map((item) => (
              <li key={item} className="text-[13px] text-muted-foreground font-mono pl-5">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bootstrap.sshOk !== null && (
        <div className="flex items-center gap-2">
          {bootstrap.sshOk ? (
            <>
              <CheckCircle2 className="size-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700">{bootstrap.sshMessage}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700">SSH: {bootstrap.sshMessage}</span>
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button onClick={onClose}>Tamam</Button>
      </DialogFooter>
    </div>
  );
}

type ConnState = "idle" | "ok" | "fail";

function EnvironmentDialog({
  editing,
  onClose,
  onSaved,
}: Readonly<{ editing: Exclude<Editing, null>; onClose: () => void; onSaved: () => void }>) {
  const isEdit = editing.type === "edit";
  const env = editing.type === "edit" ? editing.env : null;

  const [trinoUrl, setTrinoUrl] = useState(env?.trinoBaseUrl ?? "");
  const [trinoUsername, setTrinoUsername] = useState(env?.trinoUsername ?? "");
  const [connState, setConnState] = useState<ConnState>(isEdit ? "ok" : "idle");
  const [connMsg, setConnMsg] = useState("");
  const [isTesting, startTest] = useTransition();

  const [sshUser, setSshUser] = useState("ansible");
  const [sshPassword, setSshPassword] = useState("");
  const [sshPrivateKey, setSshPrivateKey] = useState("");
  const [sshState, setSshState] = useState<SshTestResult | null>(null);
  const [isSshTesting, startSshTest] = useTransition();

  function deriveHost(url: string): string {
    try { return new URL(url).hostname; } catch { return url.trim(); }
  }

  function handleSshTest() {
    const host = deriveHost(trinoUrl);
    if (!host || (!sshPassword && !sshPrivateKey)) return;
    setSshState(null);
    startSshTest(async () => {
      const result = await testSshConnection(host, sshUser, sshPassword || undefined, sshPrivateKey || undefined);
      setSshState(result);
    });
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTrinoUrl(e.target.value);
    setConnState("idle");
    setConnMsg("");
  }

  function handleTest() {
    const url = trinoUrl.trim();
    if (!url) return;
    startTest(async () => {
      const result = await testConnection(url, trinoUsername.trim() || undefined);
      if (result.ok) {
        setConnState("ok");
        setConnMsg(`Trino ${result.version}${result.uptime ? ` — ${result.uptime}` : ""}`);
      } else {
        setConnState("fail");
        setConnMsg(result.error);
      }
    });
  }

  const urlFilled = trinoUrl.trim() !== "";
  const usernameFilled = trinoUsername.trim() !== "";
  const canSave = urlFilled && usernameFilled && connState === "ok";

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const action = isEdit ? updateEnvironment : createEnvironment;
      const result = await action(prev, formData);
      if (result.ok && !result.bootstrap) onSaved();
      return result;
    },
    null,
  );

  const showBootstrap = state?.ok && state.bootstrap;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showBootstrap ? "Ortam oluşturuldu" : isEdit ? "Ortamı düzenle" : "Yeni ortam"}
          </DialogTitle>
        </DialogHeader>

        {showBootstrap && state?.bootstrap ? (
          <BootstrapSummary bootstrap={state.bootstrap} onClose={onSaved} />
        ) : (
          <form action={formAction} className="space-y-4">
            {env && <input type="hidden" name="id" value={env.id} />}
            <div className="space-y-1.5">
              <Label htmlFor="env-name">Ad</Label>
              <Input id="env-name" name="name" defaultValue={env?.name ?? ""} placeholder="production" />
            </div>
            <input type="hidden" name="deliveryMode" value="FILE" />
            <div className="space-y-1.5">
              <Label htmlFor="env-target">Hedef (URL veya dosya yolu)</Label>
              <Input id="env-target" name="configTarget" className="font-mono" defaultValue={env?.configTarget ?? ""} placeholder="https://… veya /etc/trino/rules.json" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="env-refresh">Yenileme periyodu (opsiyonel)</Label>
              <Input id="env-refresh" name="refreshPeriod" className="font-mono" defaultValue={env?.refreshPeriod ?? ""} placeholder="1s" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="env-api">
                Trino API adresi <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="env-api"
                  name="trinoBaseUrl"
                  className="font-mono"
                  value={trinoUrl}
                  onChange={handleUrlChange}
                  placeholder="https://coordinator:8443"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!urlFilled || !usernameFilled || isTesting}
                  onClick={handleTest}
                >
                  {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : "Test Et"}
                </Button>
              </div>
              {connState === "ok" && (
                <p className="flex items-center gap-1.5 text-[12px] text-green-700">
                  <CheckCircle2 className="size-3.5" /> {connMsg}
                </p>
              )}
              {connState === "fail" && (
                <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                  <WifiOff className="size-3.5" /> {connMsg}
                </p>
              )}
              {connState === "idle" && urlFilled && (
                <p className="text-[11px] text-amber-600">Kaydetmeden önce bağlantıyı test edin.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="env-trino-user">
                  Trino kullanıcı adı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="env-trino-user"
                  name="trinoUsername"
                  value={trinoUsername}
                  onChange={(e) => setTrinoUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="env-trino-pass">
                  Trino şifresi{" "}
                  <span className="text-destructive">{isEdit ? "" : "*"}</span>
                  {isEdit && <span className="text-muted-foreground text-[11px]"> (boş → mevcut korunur)</span>}
                </Label>
                <Input
                  id="env-trino-pass"
                  name="trinoPassword"
                  type="password"
                  placeholder={isEdit ? "Değiştirmek için girin" : "Zorunlu"}
                  required={!isEdit}
                />
              </div>
            </div>
            {!isEdit && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-[12px] font-medium">
                  SSH Yapılandırması{" "}
                  <span className="font-normal text-muted-foreground">(opsiyonel — dağıtım için önerilir)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[12px] text-muted-foreground">SSH Kullanıcı</label>
                    <input
                      name="sshUser"
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                      placeholder="ansible"
                      className="h-7 w-full rounded-md border bg-background px-2.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] text-muted-foreground">SSH Şifre</label>
                    <input
                      name="sshPassword"
                      type="password"
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      placeholder="Opsiyonel"
                      className="h-7 w-full rounded-md border bg-background px-2.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-muted-foreground">PEM Özel Anahtar</label>
                  <textarea
                    name="sshPrivateKey"
                    value={sshPrivateKey}
                    onChange={(e) => setSshPrivateKey(e.target.value)}
                    rows={3}
                    placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                    className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSshTesting || !trinoUrl || (!sshPassword && !sshPrivateKey)}
                    onClick={handleSshTest}
                  >
                    {isSshTesting ? <Loader2 className="size-3.5 animate-spin" /> : "SSH Test Et"}
                  </Button>
                  {sshState && sshState.ok && (
                    <span className="flex items-center gap-1 text-[12px] text-green-700">
                      <CheckCircle2 className="size-3.5" /> SSH bağlantısı başarılı
                    </span>
                  )}
                  {sshState && !sshState.ok && (
                    <span className="flex items-center gap-1 text-[12px] text-destructive">
                      <WifiOff className="size-3.5" /> {sshState.error}
                    </span>
                  )}
                </div>
              </div>
            )}

            {state && !state.ok && (
              <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                <AlertTriangle className="size-3.5" /> {state.error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
              <Button type="submit" disabled={pending || !canSave} title={!canSave ? "API adresi ve kullanıcı adını doldurup bağlantıyı test edin" : undefined}>
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
