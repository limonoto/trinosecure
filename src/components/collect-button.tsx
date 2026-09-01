"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { collectNow } from "@/app/(app)/metrics/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Trigger one metrics collection for the active environment and refresh. */
export function CollectButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const result = await collectNow();
      setMsg(result.ok ? `${result.queries} sorgu toplandı` : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[12px] text-muted-foreground">{msg}</span>}
      <Button variant="outline" size="sm" onClick={run} disabled={pending}>
        <RefreshCw className={cn(pending && "animate-spin")} />
        Şimdi topla
      </Button>
    </div>
  );
}
