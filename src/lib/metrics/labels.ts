/** Display formatting for dashboards (locale-based; not unit-tested). */

export function bucketLabel(startMs: number, rangeMs: number): string {
  const d = new Date(startMs);
  const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (rangeMs > 24 * 60 * 60_000) {
    return `${d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })} ${time}`;
  }
  return time;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} sn`;
  return `${(ms / 60_000).toFixed(1)} dk`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}
