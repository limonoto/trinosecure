"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, Download, KeyRound, Plus, Trash2 } from "lucide-react";
import {
  createPasswordUser,
  changePassword,
  deletePasswordUser,
  exportPasswordDb,
  type ActionResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Entry = { id: string; username: string; encoding: string; updatedAt: string };
type Group = { id: string; name: string };

const NO_GROUP = "__none__";

function FormError({ message }: Readonly<{ message: string }>) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] text-destructive">
      <AlertTriangle className="size-3.5" />
      {message}
    </p>
  );
}

function CreateDialog({
  groups,
  onClose,
}: Readonly<{ groups: Group[]; onClose: (saved: boolean) => void }>) {
  const [groupId, setGroupId] = useState(NO_GROUP);
  const [encoding, setEncoding] = useState("BCRYPT");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => createPasswordUser(_prev, formData),
    null,
  );

  useEffect(() => {
    if (state?.ok) onClose(true);
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni şifre kullanıcısı</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="encoding" value={encoding} />
          <input type="hidden" name="groupId" value={groupId === NO_GROUP ? "" : groupId} />
          <div className="space-y-1.5">
            <Label htmlFor="pw-username">Kullanıcı adı</Label>
            <Input id="pw-username" name="username" autoFocus placeholder="ör. analyst1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-password">Şifre</Label>
            <Input id="pw-password" name="password" type="password" placeholder="en az 6 karakter" />
          </div>
          <div className="space-y-1.5">
            <Label>Şifreleme tipi</Label>
            <Select value={encoding} onValueChange={(v) => setEncoding(v ?? "BCRYPT")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BCRYPT">bcrypt</SelectItem>
                <SelectItem value="PBKDF2">PBKDF2 (HMAC-SHA256)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Trino password.db her iki formatı da doğrular. bcrypt yaygın; PBKDF2 FIPS ortamlarında tercih edilir.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Grup (opsiyonel)</Label>
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? NO_GROUP)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>— gruba ekleme —</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Seçilirse kullanıcı bu gruba dahil edilir ve yayınla ile tüm node’lara dağıtılır.
            </p>
          </div>
          {state && !state.ok && <FormError message={state.error} />}
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onClose(false)}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({
  entry,
  onClose,
}: Readonly<{ entry: Entry; onClose: () => void }>) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const result = await changePassword(entry.id, password);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Şifre değiştir — <span className="font-mono">{entry.username}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">Yeni şifre</Label>
            <Input
              id="pw-new"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="en az 6 karakter"
            />
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={submit}>
            {pending ? "Kaydediliyor…" : "Değiştir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordsClient({
  entries,
  groups,
}: Readonly<{ entries: Entry[]; groups: Group[] }>) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState<Entry | null>(null);
  const [, start] = useTransition();
  const { confirm, ConfirmDialog } = useConfirm();

  async function remove(entry: Entry) {
    const ok = await confirm({
      title: "Silme onayı",
      description: `"${entry.username}" kullanıcısını silmek istediğinize emin misiniz?`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    start(async () => {
      await deletePasswordUser(entry.id);
      router.refresh();
    });
  }

  function exportDb() {
    start(async () => {
      const result = await exportPasswordDb();
      if (!result.ok) return;
      const blob = new Blob([result.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "password.db";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <ConfirmDialog />
      <Card className="flex-row items-center gap-3 px-4 py-3">
        <span className="text-[13px] text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{entries.length}</span> kullanıcı
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportDb} disabled={entries.length === 0}>
            <Download /> password.db indir
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> Yeni kullanıcı
          </Button>
        </div>
      </Card>

      <Card className="gap-0 py-0">
        {entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            Henüz şifre kullanıcısı yok.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Şifreleme</TableHead>
                <TableHead>Güncellendi</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <KeyRound className="size-4 text-muted-foreground" />
                      <span className="font-mono text-[13px]">{entry.username}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{entry.encoding.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true, locale: tr })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => setChanging(entry)}>
                        Şifre değiştir
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" title="Sil" onClick={() => remove(entry)}>
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

      {creating && (
        <CreateDialog
          groups={groups}
          onClose={(saved) => {
            setCreating(false);
            if (saved) router.refresh();
          }}
        />
      )}
      {changing && <ChangePasswordDialog entry={changing} onClose={() => setChanging(null)} />}
    </div>
  );
}
