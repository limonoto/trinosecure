"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  type ActionResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type GroupMemberRow = { id: string; username: string };
export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  members: GroupMemberRow[];
};

type Editing = { type: "new" } | { type: "edit"; group: GroupRow } | null;

export function GroupsClient({ groups }: Readonly<{ groups: GroupRow[] }>) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [membersFor, setMembersFor] = useState<GroupRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const { confirm, ConfirmDialog } = useConfirm();

  async function onDelete(group: GroupRow) {
    const ok = await confirm({
      title: "Silme onayı",
      description: `"${group.name}" grubunu silmek istediğinize emin misiniz?`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    startDelete(async () => {
      await deleteGroup(group.id);
      router.refresh();
    });
  }

  return (
    <>
      <ConfirmDialog />
      <div className="mt-6 flex justify-end">
        <Button size="sm" onClick={() => setEditing({ type: "new" })}>
          <Plus /> Yeni grup
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="mt-3 items-center gap-3 p-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">Bu ortamda henüz grup yok. İlk grubu ekleyin.</p>
        </Card>
      ) : (
        <Card className="mt-3 gap-0 py-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="w-24">Üye</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-mono font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground">{group.description ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="neutral" render={<button type="button" onClick={() => setMembersFor(group)} />}>
                      <Users className="size-3" />
                      {group.members.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" title="Üyeler" onClick={() => setMembersFor(group)}>
                        <UserPlus />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Düzenle" onClick={() => setEditing({ type: "edit", group })}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" title="Sil" disabled={isDeleting} onClick={() => onDelete(group)}>
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
        <GroupDialog editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
      )}
      {membersFor && (
        <MembersSheet group={membersFor} onClose={() => { setMembersFor(null); router.refresh(); }} />
      )}
    </>
  );
}

function GroupDialog({
  editing,
  onClose,
  onSaved,
}: Readonly<{ editing: Exclude<Editing, null>; onClose: () => void; onSaved: () => void }>) {
  const isEdit = editing.type === "edit";
  const group = editing.type === "edit" ? editing.group : null;

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const action = isEdit ? updateGroup : createGroup;
      const result = await action(prev, formData);
      if (result.ok) onSaved();
      return result;
    },
    null,
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Grubu düzenle" : "Yeni grup"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {group && <input type="hidden" name="id" value={group.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Ad</Label>
            <Input id="group-name" name="name" className="font-mono" defaultValue={group?.name ?? ""} placeholder="analysts" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Açıklama (opsiyonel)</Label>
            <Input id="group-desc" name="description" defaultValue={group?.description ?? ""} placeholder="Analiz ekibi" />
          </div>
          {state && !state.ok && (
            <p className="flex items-center gap-1.5 text-[12px] text-destructive">
              <AlertTriangle className="size-3.5" /> {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MembersSheet({ group, onClose }: Readonly<{ group: GroupRow; onClose: () => void }>) {
  const router = useRouter();
  const [members, setMembers] = useState<GroupMemberRow[]>(group.members);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    const value = username.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await addMember(group.id, value);
      if (result.ok) {
        setMembers((prev) => [...prev, result.member].sort((a, b) => a.username.localeCompare(b.username)));
        setUsername("");
        setError(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function remove(member: GroupMemberRow) {
    startTransition(async () => {
      const result = await removeMember(member.id);
      if (result.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            <span className="font-mono">{group.name}</span> üyeleri · {members.length}
          </SheetTitle>
        </SheetHeader>

        <div className="border-b px-4 pb-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="member-username">Kullanıcı adı ekle</Label>
              <Input
                id="member-username"
                className="font-mono"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder="ali.veli"
              />
            </div>
            <Button type="button" disabled={isPending || username.trim() === ""} onClick={add}>
              <UserPlus /> Ekle
            </Button>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-destructive">
              <AlertTriangle className="size-3.5" /> {error}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {members.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Henüz üye yok.</p>
          ) : (
            <ul className="space-y-0.5">
              {members.map((member) => (
                <li key={member.id} className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent/50">
                  <span className="font-mono text-[13px]">{member.username}</span>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" title="Çıkar" disabled={isPending} onClick={() => remove(member)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
