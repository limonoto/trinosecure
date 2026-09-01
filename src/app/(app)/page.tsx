import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ShieldCheck,
  Users,
  History,
  Server,
  Activity,
  ChevronRight,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { getRulesContent } from "@/lib/rules/service";
import { parseRulesJson, ruleCounts } from "@/lib/rules/rules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "primary" | "info" | "success" | "warning";

const STAT_TONE: Record<Tone, string> = {
  primary: "bg-primary/12 text-primary",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
};

async function countActiveRules(environmentId: string): Promise<number> {
  try {
    const parsed = parseRulesJson(await getRulesContent(environmentId));
    if (!parsed.ok) return 0;
    const c = ruleCounts(parsed.doc);
    return c.catalogs + c.schemas + c.tables;
  } catch {
    return 0;
  }
}

function initials(value: string): string {
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tAudit = await getTranslations("audit.actions");
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Card className="mt-6 items-center justify-center gap-4 p-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Server className="size-6" />
          </span>
          <div>
            <p className="text-base font-semibold">{t("noEnvironmentTitle")}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("noEnvironmentBody")}</p>
          </div>
          <Button size="sm" render={<Link href="/environments" />}>
            <Plus /> {t("addEnvironment")}
          </Button>
        </Card>
      </div>
    );
  }

  const [rules, groups, versions, nodes, recent] = await Promise.all([
    countActiveRules(env.id),
    prisma.appGroup.count({ where: { environmentId: env.id } }),
    prisma.configVersion.count({ where: { artifact: { environmentId: env.id } } }),
    prisma.trinoNode.count({ where: { environmentId: env.id } }),
    prisma.auditLog.findMany({ where: { environmentId: env.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const stats: { label: string; value: number; tone: Tone; href: string; icon: LucideIcon }[] = [
    { label: t("stats.rules"), value: rules, tone: "primary", href: "/rules", icon: ShieldCheck },
    { label: t("stats.groups"), value: groups, tone: "info", href: "/groups", icon: Users },
    { label: t("stats.versions"), value: versions, tone: "success", href: "/history", icon: History },
    { label: t("stats.nodes"), value: nodes, tone: "warning", href: "/nodes", icon: Server },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{env.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="group block">
              <Card className="transition-colors group-hover:bg-accent/40">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <span className={`flex size-9 items-center justify-center rounded-md ${STAT_TONE[s.tone]}`}>
                      <Icon className="size-[18px]" />
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
                  <div className="mt-0.5 text-[13px] font-medium">{s.label}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="gap-0 py-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">{t("sections.recentActivity")}</h2>
            <Link href="/audit" className="text-[13px] font-medium text-primary hover:underline">
              {t("sections.recentActivity")}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">{t("sections.recentActivityEmpty")}</p>
          ) : (
            <ol className="divide-y divide-border">
              {recent.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                    {initials(log.actorUsername)}
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] leading-snug">
                    <span className="font-medium">{log.actorUsername}</span>{" "}
                    <span className="text-muted-foreground">{tAudit(log.action)}</span>{" "}
                    <span className="font-mono font-medium">{log.entityType}</span>
                  </p>
                  <time className="flex-none whitespace-nowrap text-[12px] text-muted-foreground">
                    {formatDistanceToNow(log.createdAt, { addSuffix: true, locale: tr })}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Link href="/rules" className="group block">
            <Card className="transition-colors group-hover:bg-accent/40">
              <CardContent>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <ShieldCheck className="size-[18px]" />
                  </span>
                  <h2 className="text-sm font-semibold">{t("sections.authorization")}</h2>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{t("sections.authorizationBody")}</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/metrics" className="group block">
            <Card className="transition-colors group-hover:bg-accent/40">
              <CardContent>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-md bg-info/12 text-info">
                    <Activity className="size-[18px]" />
                  </span>
                  <h2 className="text-sm font-semibold">{t("sections.observability")}</h2>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{t("sections.observabilityBody")}</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
