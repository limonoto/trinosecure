import { prisma } from "@/lib/db";
import { parseTrinoDuration } from "@/lib/metrics/ingest";
import { average } from "@/lib/metrics/aggregate";
import { compareThreshold, isAnomaly, type Comparator } from "./evaluate";

/**
 * DB-backed alert metric computation + rule evaluation (requirement 6.6). Run
 * after each collection (see collectAll). Static rules compare the windowed metric
 * to a threshold; dynamic rules flag anomalies vs the preceding windows. Events
 * are written only on FIRING↔RESOLVED transitions (no duplicate spam).
 */

const HISTORY_WINDOWS = 8;
const DEFAULT_WINDOW_MS = 5 * 60_000;

/** Compute one metric value for an environment over [since, until]. */
export async function computeMetric(
  environmentId: string,
  metric: string,
  since: Date,
  until: Date,
): Promise<number> {
  const createTime = { gte: since, lt: until };

  if (metric === "avg_runtime_ms") {
    const rows = await prisma.queryStat.findMany({
      where: { environmentId, state: "FINISHED", createTime },
      select: { elapsedMs: true },
    });
    return average(rows.map((r) => r.elapsedMs)) ?? 0;
  }

  // error_rate or error_rate:<TYPE>
  const total = await prisma.queryStat.count({ where: { environmentId, createTime } });
  if (total === 0) return 0;
  const type = metric.startsWith("error_rate:") ? metric.slice("error_rate:".length) : null;
  const failed = await prisma.queryStat.count({
    where: { environmentId, createTime, errorType: type ? type : { not: null } },
  });
  return (failed / total) * 100;
}

export type RuleEvaluation = { ruleId: string; firing: boolean; value: number; changed: boolean };

export async function evaluateRulesForEnv(environmentId: string, now: Date): Promise<RuleEvaluation[]> {
  const rules = await prisma.alertRule.findMany({ where: { environmentId, enabled: true } });
  const out: RuleEvaluation[] = [];

  for (const rule of rules) {
    const windowMs = parseTrinoDuration(rule.window) ?? DEFAULT_WINDOW_MS;
    const until = now.getTime();
    const since = until - windowMs;
    const value = await computeMetric(environmentId, rule.metric, new Date(since), new Date(until));

    let firing: boolean;
    if (rule.kind === "DYNAMIC") {
      const history: number[] = [];
      for (let i = 1; i <= HISTORY_WINDOWS; i += 1) {
        const end = since - (i - 1) * windowMs;
        history.push(await computeMetric(environmentId, rule.metric, new Date(end - windowMs), new Date(end)));
      }
      const k = rule.threshold > 0 ? rule.threshold : 3;
      firing = isAnomaly(history, value, k);
    } else {
      firing = compareThreshold(value, rule.comparator as Comparator, rule.threshold);
    }

    const last = await prisma.alertEvent.findFirst({ where: { ruleId: rule.id }, orderBy: { ts: "desc" } });
    const lastStatus = last?.status ?? "RESOLVED";
    let changed = false;
    if (firing && lastStatus !== "FIRING") {
      await prisma.alertEvent.create({ data: { ruleId: rule.id, value, status: "FIRING", ts: now } });
      changed = true;
    } else if (!firing && lastStatus === "FIRING") {
      await prisma.alertEvent.create({ data: { ruleId: rule.id, value, status: "RESOLVED", ts: now } });
      changed = true;
    }
    out.push({ ruleId: rule.id, firing, value, changed });
  }

  return out;
}
