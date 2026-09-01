import type { ResourceGroup } from "./schema";

/**
 * Flatten the resource-group hierarchy into depth-tagged rows for the tree view,
 * and parse memory limits into a 0–100 percentage for the graphical bars
 * (requirement 2.1: "hard/soft limitler grafiksel olarak anlaşılır olmalı").
 */

export type FlatGroup = {
  depth: number;
  /** Dotted path, e.g. "global.adhoc". */
  path: string;
  group: ResourceGroup;
};

export function flattenGroups(roots: readonly ResourceGroup[] | undefined): FlatGroup[] {
  const out: FlatGroup[] = [];
  const walk = (groups: readonly ResourceGroup[], depth: number, prefix: string) => {
    for (const group of groups) {
      const path = prefix ? `${prefix}.${group.name}` : group.name;
      out.push({ depth, path, group });
      if (group.subGroups?.length) walk(group.subGroups, depth + 1, path);
    }
  };
  walk(roots ?? [], 0, "");
  return out;
}

/** Parse a soft memory limit ("80%" or a 0–1 fraction) into a 0–100 percentage. */
export function parseMemoryPercent(limit: string | number | undefined): number | null {
  if (limit === undefined) return null;
  if (typeof limit === "number") {
    // A fraction like 0.8 → 80%; anything ≥1 is treated as an absolute (no bar).
    return limit > 0 && limit <= 1 ? Math.round(limit * 100) : null;
  }
  const match = /^(\d+(?:\.\d+)?)\s*%$/.exec(limit.trim());
  return match ? Math.min(100, Math.round(parseFloat(match[1]))) : null;
}

/** Total number of groups across the whole tree. */
export function countGroups(roots: readonly ResourceGroup[] | undefined): number {
  return flattenGroups(roots).length;
}

/**
 * Map each group's dotted path AND leaf name → its hardConcurrencyLimit, for the
 * resource-group performance saturation view (requirement 6.4.2).
 */
export function concurrencyLimits(roots: readonly ResourceGroup[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const { path, group } of flattenGroups(roots)) {
    if (typeof group.hardConcurrencyLimit === "number") {
      map.set(path, group.hardConcurrencyLimit);
      map.set(group.name, group.hardConcurrencyLimit);
    }
  }
  return map;
}

/** A group's own fields (without subGroups), serialized for shallow comparison. */
function ownFields(group: ResourceGroup): string {
  const clone: Record<string, unknown> = { ...group };
  delete clone.subGroups;
  return JSON.stringify(clone);
}

/**
 * Resource-group paths that differ between two trees — added, removed, or whose
 * own (non-child) fields changed. Powers per-resource-group authorization scoping
 * (requirement 3.2): a scoped editor may only touch groups within their set.
 */
export function changedGroupPaths(
  before: readonly ResourceGroup[] | undefined,
  after: readonly ResourceGroup[] | undefined,
): string[] {
  const a = new Map(flattenGroups(before).map((f) => [f.path, ownFields(f.group)]));
  const b = new Map(flattenGroups(after).map((f) => [f.path, ownFields(f.group)]));
  const changed = new Set<string>();
  for (const [path, fields] of b) if (a.get(path) !== fields) changed.add(path);
  for (const path of a.keys()) if (!b.has(path)) changed.add(path);
  return [...changed];
}

/**
 * Whether a changed resource-group `path` falls within an allowed set. A scope
 * entry matches the full dotted path or any single segment (so "etl" covers
 * "global.etl" and its subgroups).
 */
export function isPathInScope(path: string, allowed: readonly string[]): boolean {
  if (allowed.includes(path)) return true;
  return path.split(".").some((segment) => allowed.includes(segment));
}

// ─── Mutation helpers ────────────────────────────────────────────────────────

type GroupFields = Omit<ResourceGroup, "subGroups">;

function applyAtPath(
  groups: ResourceGroup[],
  segments: string[],
  fn: (g: ResourceGroup) => ResourceGroup,
): ResourceGroup[] {
  return groups.map((g) => {
    if (g.name !== segments[0]) return g;
    if (segments.length === 1) return fn(g);
    return { ...g, subGroups: applyAtPath(g.subGroups ?? [], segments.slice(1), fn) };
  });
}

/** Append a new group as a child of parentPath, or as a new root if parentPath is null. */
export function insertGroup(
  roots: ResourceGroup[],
  parentPath: string | null,
  newGroup: ResourceGroup,
): ResourceGroup[] {
  if (parentPath === null) return [...roots, newGroup];
  return applyAtPath(roots, parentPath.split("."), (g) => ({
    ...g,
    subGroups: [...(g.subGroups ?? []), newGroup],
  }));
}

/** Replace own fields (name, limits, …) of the group at path; keeps subGroups intact. */
export function updateGroupAtPath(
  roots: ResourceGroup[],
  path: string,
  fields: GroupFields,
): ResourceGroup[] {
  return applyAtPath(roots, path.split("."), (g) => ({ ...g, ...fields }));
}

/** Remove the group at path from the tree. */
export function deleteGroupAtPath(roots: ResourceGroup[], path: string): ResourceGroup[] {
  const segments = path.split(".");
  if (segments.length === 1) return roots.filter((g) => g.name !== segments[0]);
  return applyAtPath(roots, segments.slice(0, -1), (g) => ({
    ...g,
    subGroups: (g.subGroups ?? []).filter((sub) => sub.name !== segments[segments.length - 1]),
  }));
}

/**
 * Check whether children's combined softMemoryLimit exceeds the parent's.
 * Returns the combined child percentage when exceeded, null otherwise.
 * Note: in Trino, all percentages are relative to the full cluster, so
 * this is advisory (not a hard error), but useful to surface as a warning.
 */
export function childrenMemoryOverflow(group: ResourceGroup): number | null {
  if (!group.subGroups?.length) return null;
  const parentPct = parseMemoryPercent(group.softMemoryLimit);
  if (parentPct === null) return null;
  const childSum = group.subGroups.reduce((acc, sub) => {
    const pct = parseMemoryPercent(sub.softMemoryLimit);
    return acc + (pct ?? 0);
  }, 0);
  return childSum > parentPct ? childSum : null;
}
