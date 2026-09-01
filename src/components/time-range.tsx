"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { RANGES } from "@/lib/metrics/range";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Time-range control (requirement 6.5.2): preset windows (15m/1h/24h/7d) plus a
 * custom specific range via from/to. Writes ?range= (presets) or ?from=&to= (custom).
 */
export function TimeRangeControl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const isCustom = !!params.get("from") && !!params.get("to");
  const current = isCustom ? "custom" : params.get("range") ?? "1h";

  function selectPreset(key: string) {
    const next = new URLSearchParams(params);
    next.set("range", key);
    next.delete("from");
    next.delete("to");
    start(() => router.replace(`${pathname}?${next.toString()}`));
  }

  function applyCustom(from: string, to: string) {
    if (!from || !to) return;
    const next = new URLSearchParams(params);
    next.set("from", new Date(from).toISOString());
    next.set("to", new Date(to).toISOString());
    next.delete("range");
    setCustomOpen(false);
    start(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex items-center gap-2">
      <Tabs value={current} onValueChange={(value) => value !== "custom" && selectPreset(String(value))}>
        <TabsList>
          {RANGES.map((r) => (
            <TabsTrigger key={r.key} value={r.key}>
              {r.key}
            </TabsTrigger>
          ))}
          {isCustom && <TabsTrigger value="custom">özel</TabsTrigger>}
        </TabsList>
      </Tabs>
      <Button variant="outline" size="icon-sm" title="Özel aralık" onClick={() => setCustomOpen((o) => !o)}>
        <CalendarRange />
      </Button>
      {customOpen && <CustomRange onApply={applyCustom} />}
    </div>
  );
}

function CustomRange({ onApply }: Readonly<{ onApply: (from: string, to: string) => void }>) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5">
      <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-44 text-[12px]" />
      <span className="text-muted-foreground">→</span>
      <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-44 text-[12px]" />
      <Button size="sm" onClick={() => onApply(from, to)}>Uygula</Button>
    </div>
  );
}
