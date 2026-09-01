/**
 * Pure alert evaluation (requirement 6.6): static threshold comparison and a
 * simple statistical anomaly check (z-score vs the preceding windows). Kept pure
 * for unit testing; DB-backed metric computation lives in service.ts.
 */

export type Comparator = "GT" | "GTE" | "LT" | "LTE";

/** Metrics an alert rule can watch (pure catalog — safe to import in client UI). */
export const ALERT_METRICS = [
  { key: "error_rate", label: "Hata oranı (%)", unit: "%" },
  { key: "error_rate:USER_ERROR", label: "USER_ERROR oranı (%)", unit: "%" },
  { key: "error_rate:INTERNAL_ERROR", label: "INTERNAL_ERROR oranı (%)", unit: "%" },
  { key: "error_rate:INSUFFICIENT_RESOURCES", label: "INSUFFICIENT_RESOURCES oranı (%)", unit: "%" },
  { key: "error_rate:EXCEEDED_TIME_LIMIT", label: "EXCEEDED_TIME_LIMIT oranı (%)", unit: "%" },
  { key: "avg_runtime_ms", label: "Ort. çalışma süresi (ms)", unit: "ms" },
] as const;

export function metricLabel(key: string): string {
  return ALERT_METRICS.find((m) => m.key === key)?.label ?? key;
}

export function compareThreshold(value: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case "GT":
      return value > threshold;
    case "GTE":
      return value >= threshold;
    case "LT":
      return value < threshold;
    case "LTE":
      return value <= threshold;
    default:
      return false;
  }
}

/** Standard score of `current` against the history's mean/stddev (null if too few points). */
export function zScore(history: readonly number[], current: number): number | null {
  if (history.length < 3) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const std = Math.sqrt(variance);
  if (std === 0) return current === mean ? 0 : Number.POSITIVE_INFINITY;
  return (current - mean) / std;
}

/**
 * Anomaly when `current` deviates from the recent norm by ≥ `k` standard
 * deviations. `direction` limits to spikes ("up") or drops ("down"); "both" by
 * default (catches an abnormal error increase or a sudden performance drop).
 */
export function isAnomaly(
  history: readonly number[],
  current: number,
  k = 3,
  direction: "up" | "down" | "both" = "both",
): boolean {
  const z = zScore(history, current);
  if (z === null) return false;
  if (direction === "up") return z >= k;
  if (direction === "down") return z <= -k;
  return Math.abs(z) >= k;
}
