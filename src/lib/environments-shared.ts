// Pure environment helpers (no server/React imports) — safe to import anywhere
// and unit-testable.

export type EnvironmentSummary = {
  id: string;
  name: string;
  configTarget: string;
  deliveryMode: "HTTP" | "FILE";
};

export type EnvironmentTone = "destructive" | "warning" | "info";

/** Literal background classes per tone (kept literal so Tailwind detects them). */
export const ENV_TONE_DOT: Record<EnvironmentTone, string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

/**
 * Heuristic colour cue for an environment by name (prod = red, staging/test = amber,
 * otherwise blue) — a glanceable safety signal.
 */
export function environmentTone(name: string): EnvironmentTone {
  const n = name.toLowerCase();
  if (n.includes("prod")) return "destructive";
  if (n.includes("stag") || n.includes("pre") || n.includes("test")) return "warning";
  return "info";
}

/** Resolve the active environment from a list (cookie id → fallback to first). */
export function resolveActiveEnvironment(
  environments: EnvironmentSummary[],
  activeId: string | undefined,
): EnvironmentSummary | null {
  if (environments.length === 0) return null;
  return environments.find((e) => e.id === activeId) ?? environments[0];
}
