"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Menu, RefreshCw, Boxes } from "lucide-react";
import { ENV_TONE_DOT, environmentTone, type EnvironmentSummary } from "@/lib/environments-shared";
import { setActiveEnvironment } from "@/lib/environment-actions";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function EnvSwitcher({
  environments,
  activeEnvId,
}: Readonly<{ environments: EnvironmentSummary[]; activeEnvId: string | null }>) {
  const t = useTranslations("topbar");
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (environments.length === 0) {
    return (
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/environments" />}>
        <Boxes /> {t("addEnvironment")}
      </Button>
    );
  }

  const current = environments.find((e) => e.id === activeEnvId) ?? environments[0];

  function select(id: string) {
    startTransition(async () => {
      await setActiveEnvironment(id);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="h-9 gap-2 px-2.5" />}
      >
        <span className={cn("size-2 rounded-full", ENV_TONE_DOT[environmentTone(current.name)])} />
        <span className="text-left leading-tight">
          <span className="block text-[13px] font-semibold">{current.name}</span>
          <span className="block max-w-[180px] truncate font-mono text-[11px] text-muted-foreground">
            {current.configTarget}
          </span>
        </span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {environments.map((e) => (
          <DropdownMenuItem key={e.id} onClick={() => select(e.id)}>
            <span className={cn("size-2 rounded-full", ENV_TONE_DOT[environmentTone(e.name)])} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-medium">{e.name}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {e.configTarget}
              </span>
            </span>
            {e.id === current.id && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/environments" />}>
          <Boxes /> {t("manageEnvironments")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavTrigger() {
  const t = useTranslations("sidebar");
  const { setMobileOpen } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden"
      aria-label={t("openMenu")}
      title={t("openMenu")}
      onClick={() => setMobileOpen(true)}
    >
      <Menu />
    </Button>
  );
}

function RefreshButton() {
  const t = useTranslations("topbar");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("refresh")}
      title={t("refresh")}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={cn(pending && "animate-spin")} />
    </Button>
  );
}

export function Topbar({
  environments,
  activeEnvId,
}: Readonly<{ environments: EnvironmentSummary[]; activeEnvId: string | null }>) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <MobileNavTrigger />
      <EnvSwitcher environments={environments} activeEnvId={activeEnvId} />
      <div className="ml-auto flex items-center gap-1.5">
        <RefreshButton />
      </div>
    </header>
  );
}
