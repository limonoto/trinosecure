/**
 * Pure aggregation helpers for the dashboards (requirement 6.2/6.4). Page-level
 * code passes plain numbers/strings so these stay unit-testable.
 */

import { RUNNING_STATES, QUEUED_STATES } from "./ingest";

/** Count timestamps into fixed buckets spanning [since, until]. */
export function bucketCounts(
  timestamps: readonly number[],
  sinceMs: number,
  untilMs: number,
  bucketMs: number,
): { start: number; value: number }[] {
  const first = Math.floor(sinceMs / bucketMs) * bucketMs;
  const buckets: { start: number; value: number }[] = [];
  for (let s = first; s <= untilMs; s += bucketMs) buckets.push({ start: s, value: 0 });
  if (buckets.length === 0) return buckets;
  for (const ts of timestamps) {
    const idx = Math.floor((ts - first) / bucketMs);
    if (idx >= 0 && idx < buckets.length) buckets[idx].value += 1;
  }
  return buckets;
}

/** Top-N counts of categorical values (null → "(bilinmiyor)"), descending. */
export function topCounts(values: readonly (string | null)[], limit = 8): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v && v.trim() !== "" ? v : "(bilinmiyor)";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Rounded average of the defined numbers, or null when there are none. */
export function average(nums: readonly (number | null | undefined)[]): number | null {
  const defined = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (defined.length === 0) return null;
  return Math.round(defined.reduce((a, b) => a + b, 0) / defined.length);
}

/** A query is a "limit exceed" when it ran out of resources / time / queue (6.4.2). */
export function isLimitError(errorType: string | null, errorCode: string | null): boolean {
  if (errorType === "INSUFFICIENT_RESOURCES") return true;
  const code = errorCode ?? "";
  return /EXCEEDED|OUT_OF_MEMORY|QUEUE_FULL|QUERY_QUEUE/.test(code);
}

export type QueryRow = {
  resourceGroup: string | null;
  state: string;
  elapsedMs: number | null;
  errorType: string | null;
  errorCode: string | null;
};

export type RgPerfRow = {
  group: string;
  avgMs: number | null;
  running: number;
  queued: number;
  limit: number | null;
  /** running / hardConcurrencyLimit as a percentage (concurrency saturation), or null. */
  saturationPct: number | null;
  /** Count of limit-exceed errors (6.4.2 "limit aşımları"). */
  exceeded: number;
  total: number;
};

/**
 * Per-resource-group performance (requirement 6.4.2): average runtime, current
 * concurrency vs the hard-concurrency limit (saturation), queued count, and
 * limit-exceed count. `limits` maps a resource-group name/path → hardConcurrencyLimit.
 */
export function resourceGroupPerformance(
  queries: readonly QueryRow[],
  limits: ReadonlyMap<string, number>,
): RgPerfRow[] {
  const groups = new Map<string, QueryRow[]>();
  for (const q of queries) {
    const key = q.resourceGroup && q.resourceGroup.trim() !== "" ? q.resourceGroup : "(bilinmiyor)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }

  const rows: RgPerfRow[] = [];
  for (const [group, rowsForGroup] of groups) {
    const running = rowsForGroup.filter((q) => RUNNING_STATES.has(q.state)).length;
    const queued = rowsForGroup.filter((q) => QUEUED_STATES.has(q.state)).length;
    const limit = limits.get(group) ?? limitBySuffix(group, limits);
    rows.push({
      group,
      avgMs: average(rowsForGroup.filter((q) => q.state === "FINISHED").map((q) => q.elapsedMs)),
      running,
      queued,
      limit: limit ?? null,
      saturationPct: limit && limit > 0 ? Math.round((running / limit) * 100) : null,
      exceeded: rowsForGroup.filter((q) => isLimitError(q.errorType, q.errorCode)).length,
      total: rowsForGroup.length,
    });
  }
  return rows.sort((a, b) => (b.saturationPct ?? -1) - (a.saturationPct ?? -1) || b.total - a.total);
}

/** Match "global.etl" against a limit keyed by the leaf "etl" when the full path is absent. */
function limitBySuffix(group: string, limits: ReadonlyMap<string, number>): number | undefined {
  const leaf = group.split(".").pop();
  return leaf ? limits.get(leaf) : undefined;
}
