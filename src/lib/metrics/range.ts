/**
 * Time-range helpers for the dashboards (requirement 6.5.2). Pure (a `now` is
 * passed in) so they are unit-testable; pages call them with the current time.
 */

export const RANGES = [
  { key: "15m", label: "Son 15 dakika", ms: 15 * 60_000 },
  { key: "1h", label: "Son 1 saat", ms: 60 * 60_000 },
  { key: "24h", label: "Son 24 saat", ms: 24 * 60 * 60_000 },
  { key: "7d", label: "Son 7 gün", ms: 7 * 24 * 60 * 60_000 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"] | "custom";

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  ms: number;
  since: Date;
  until: Date;
  bucketMs: number;
};

/** Choose a bucket size targeting ~40–60 points across the range (min 1 minute). */
export function bucketSizeMs(rangeMs: number): number {
  return Math.max(60_000, Math.round(rangeMs / 48 / 60_000) * 60_000);
}

function parseIso(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Resolve a dashboard time range (requirement 6.5.2). A preset key (15m/1h/24h/7d)
 * sets a window ending now; an explicit `from`/`to` pair (ISO) overrides it with a
 * specific custom range.
 */
export function resolveRange(
  key: string | undefined,
  now: Date,
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const fromMs = parseIso(custom?.from);
  const toMs = parseIso(custom?.to);
  if (fromMs !== null && toMs !== null && toMs > fromMs) {
    const ms = toMs - fromMs;
    return {
      key: "custom",
      label: "Özel aralık",
      ms,
      since: new Date(fromMs),
      until: new Date(toMs),
      bucketMs: bucketSizeMs(ms),
    };
  }
  const found = RANGES.find((r) => r.key === key) ?? RANGES[1]; // default: 1h
  return {
    key: found.key,
    label: found.label,
    ms: found.ms,
    since: new Date(now.getTime() - found.ms),
    until: now,
    bucketMs: bucketSizeMs(found.ms),
  };
}
