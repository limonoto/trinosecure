"use client";

import { useEffect, useState } from "react";
import type { ResourceGroup } from "@/lib/resource-groups/schema";
import { parseMemoryPercent } from "@/lib/resource-groups/tree";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type FormState = {
  name: string;
  softMemoryLimit: string;
  hardConcurrencyLimit: string;
  softConcurrencyLimit: string;
  maxQueued: string;
  schedulingPolicy: string;
  schedulingWeight: string;
  jmxExport: boolean;
  softCpuLimit: string;
  hardCpuLimit: string;
};

const EMPTY: FormState = {
  name: "",
  softMemoryLimit: "",
  hardConcurrencyLimit: "",
  softConcurrencyLimit: "",
  maxQueued: "",
  schedulingPolicy: "",
  schedulingWeight: "",
  jmxExport: false,
  softCpuLimit: "",
  hardCpuLimit: "",
};

function toFormState(g: ResourceGroup): FormState {
  return {
    name: g.name,
    softMemoryLimit: g.softMemoryLimit?.toString() ?? "",
    hardConcurrencyLimit: g.hardConcurrencyLimit?.toString() ?? "",
    softConcurrencyLimit: g.softConcurrencyLimit?.toString() ?? "",
    maxQueued: g.maxQueued?.toString() ?? "",
    schedulingPolicy: g.schedulingPolicy ?? "",
    schedulingWeight: g.schedulingWeight?.toString() ?? "",
    jmxExport: g.jmxExport ?? false,
    softCpuLimit: (g as Record<string, unknown>).softCpuLimit?.toString() ?? "",
    hardCpuLimit: (g as Record<string, unknown>).hardCpuLimit?.toString() ?? "",
  };
}

function toGroup(f: FormState, existing?: ResourceGroup): ResourceGroup {
  const g: ResourceGroup = { name: f.name.trim() };
  if (f.softMemoryLimit.trim()) g.softMemoryLimit = f.softMemoryLimit.trim();
  if (f.hardConcurrencyLimit.trim()) g.hardConcurrencyLimit = Number(f.hardConcurrencyLimit);
  if (f.softConcurrencyLimit.trim()) g.softConcurrencyLimit = Number(f.softConcurrencyLimit);
  if (f.maxQueued.trim()) g.maxQueued = Number(f.maxQueued);
  if (f.schedulingPolicy.trim()) g.schedulingPolicy = f.schedulingPolicy;
  if (f.schedulingWeight.trim()) g.schedulingWeight = Number(f.schedulingWeight);
  if (f.jmxExport) g.jmxExport = true;
  const extra: Record<string, unknown> = {};
  if (f.softCpuLimit.trim()) extra.softCpuLimit = f.softCpuLimit.trim();
  if (f.hardCpuLimit.trim()) extra.hardCpuLimit = f.hardCpuLimit.trim();
  if (existing?.subGroups?.length) g.subGroups = existing.subGroups;
  return { ...extra, ...g } as ResourceGroup;
}

function validate(f: FormState): string | null {
  if (!f.name.trim()) return "İsim zorunludur.";
  if (f.hardConcurrencyLimit && isNaN(Number(f.hardConcurrencyLimit)))
    return "hardConcurrencyLimit sayı olmalıdır.";
  if (f.softConcurrencyLimit && isNaN(Number(f.softConcurrencyLimit)))
    return "softConcurrencyLimit sayı olmalıdır.";
  if (f.maxQueued && isNaN(Number(f.maxQueued))) return "maxQueued sayı olmalıdır.";
  if (f.schedulingWeight && isNaN(Number(f.schedulingWeight)))
    return "schedulingWeight sayı olmalıdır.";
  return null;
}

type Props = {
  open: boolean;
  title: string;
  initial?: ResourceGroup;
  parentGroup?: ResourceGroup | null;
  onSave: (group: ResourceGroup) => void;
  onClose: () => void;
};

export function GroupFormDialog({ open, title, initial, parentGroup, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? toFormState(initial) : EMPTY);
      setError(null);
    }
  }, [open, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    const err = validate(form);
    if (err) { setError(err); return; }
    onSave(toGroup(form, initial));
  }

  const parentMemPct = parentGroup ? parseMemoryPercent(parentGroup.softMemoryLimit) : null;
  const childMemPct = parseMemoryPercent(form.softMemoryLimit) ?? parseMemoryPercent(form.softMemoryLimit);
  const relativeToParent =
    parentMemPct !== null && childMemPct !== null
      ? Math.round((childMemPct / parentMemPct) * 100)
      : null;
  const exceedsParent = parentMemPct !== null && childMemPct !== null && childMemPct > parentMemPct;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label>İsim <span className="text-destructive">*</span></Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ör. adhoc"
              className="font-mono"
            />
          </div>

          {/* Memory */}
          <div className="grid gap-1.5">
            <Label>softMemoryLimit</Label>
            <Input
              value={form.softMemoryLimit}
              onChange={(e) => set("softMemoryLimit", e.target.value)}
              placeholder="ör. 80%"
              className="font-mono"
            />
            {parentMemPct !== null && childMemPct !== null && (
              <p className={`text-[11px] ${exceedsParent ? "text-destructive" : "text-muted-foreground"}`}>
                {exceedsParent
                  ? `Üst grup sınırını aşıyor (üst: ${parentMemPct}%)`
                  : `Üst grubun ${relativeToParent}%'i · üst limit: ${parentMemPct}%`}
              </p>
            )}
          </div>

          {/* Concurrency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>hardConcurrencyLimit</Label>
              <Input
                value={form.hardConcurrencyLimit}
                onChange={(e) => set("hardConcurrencyLimit", e.target.value)}
                placeholder="ör. 20"
                type="number"
                min={0}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>softConcurrencyLimit</Label>
              <Input
                value={form.softConcurrencyLimit}
                onChange={(e) => set("softConcurrencyLimit", e.target.value)}
                placeholder="isteğe bağlı"
                type="number"
                min={0}
              />
            </div>
          </div>

          {/* Queue */}
          <div className="grid gap-1.5">
            <Label>maxQueued</Label>
            <Input
              value={form.maxQueued}
              onChange={(e) => set("maxQueued", e.target.value)}
              placeholder="ör. 100"
              type="number"
              min={0}
            />
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>schedulingPolicy</Label>
              <Select value={form.schedulingPolicy || undefined} onValueChange={(v) => set("schedulingPolicy", v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="seçin…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fair">fair</SelectItem>
                  <SelectItem value="weighted_fair">weighted_fair</SelectItem>
                  <SelectItem value="weighted">weighted</SelectItem>
                  <SelectItem value="query_priority">query_priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>schedulingWeight</Label>
              <Input
                value={form.schedulingWeight}
                onChange={(e) => set("schedulingWeight", e.target.value)}
                placeholder="ör. 100"
                type="number"
                min={0}
              />
            </div>
          </div>

          {/* CPU limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>softCpuLimit</Label>
              <Input
                value={form.softCpuLimit}
                onChange={(e) => set("softCpuLimit", e.target.value)}
                placeholder="ör. 30m"
                className="font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>hardCpuLimit</Label>
              <Input
                value={form.hardCpuLimit}
                onChange={(e) => set("hardCpuLimit", e.target.value)}
                placeholder="ör. 1h"
                className="font-mono"
              />
            </div>
          </div>

          {/* JMX export */}
          <div className="flex items-center gap-3">
            <Switch
              id="jmx"
              checked={form.jmxExport}
              onCheckedChange={(v) => set("jmxExport", v)}
            />
            <Label htmlFor="jmx">jmxExport</Label>
          </div>

          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button onClick={submit}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
