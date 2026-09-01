import type { BootCheckResult } from "@/lib/rules/boot-check";
import { parseResourceGroups } from "./schema";
import { flattenGroups } from "./tree";

/**
 * "Will this resource-groups.json boot in Trino?" (requirement 2.2). Errors are
 * things Trino rejects at load time (invalid JSON/schema, a selector routing to a
 * group that does not exist). Warnings are recommended-but-not-fatal gaps (a leaf
 * group missing hardConcurrencyLimit / maxQueued).
 */
export function bootCheckResourceGroups(content: string): BootCheckResult {
  const parsed = parseResourceGroups(content);
  if (!parsed.ok) return { ready: false, errors: [parsed.error], warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];
  const flat = flattenGroups(parsed.doc.rootGroups);
  const names = new Set<string>();
  for (const f of flat) {
    names.add(f.group.name);
    names.add(f.path);
  }

  // Selectors must route to a group that exists.
  for (const selector of parsed.doc.selectors ?? []) {
    const g = (selector as { group?: unknown }).group;
    if (typeof g === "string" && g.trim() !== "" && !names.has(g)) {
      errors.push(`Selector var olmayan bir gruba yönlendiriyor: "${g}"`);
    }
  }

  // Leaf groups should declare concurrency + queue limits (Trino needs them).
  for (const f of flat) {
    const isLeaf = !f.group.subGroups?.length;
    if (isLeaf && typeof f.group.hardConcurrencyLimit !== "number") {
      warnings.push(`"${f.path}" için hardConcurrencyLimit tanımlı değil.`);
    }
    if (isLeaf && typeof f.group.maxQueued !== "number") {
      warnings.push(`"${f.path}" için maxQueued tanımlı değil.`);
    }
  }

  return { ready: errors.length === 0, errors, warnings };
}
