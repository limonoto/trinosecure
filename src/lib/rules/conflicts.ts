import type { RulesDocument } from "./schema";

/**
 * Allow/deny conflict & shadow detection — requirement 2.1.
 *
 * Because rules are first-match-wins, a rule can be unreachable ("shadowed") when
 * an earlier rule in the same section always matches the same (or a broader)
 * scope. Full regex subsumption is undecidable, so we detect the two cases that
 * cause real-world mistakes:
 *
 *  - **duplicate-scope:** a later rule has identical identity/location matchers as
 *    an earlier one — the later rule can never be reached.
 *  - **catch-all:** an earlier rule matches everything (all matcher patterns absent
 *    or `.*`), so every later rule in that section is dead.
 */

export type ConflictKind = "duplicate-scope" | "catch-all";

export type ConflictIssue = {
  section: string;
  /** Index (within its section) of the shadowed/unreachable rule. */
  index: number;
  /** Index of the earlier rule that shadows it. */
  shadowedBy: number;
  kind: ConflictKind;
  message: string;
};

/** Fields that decide an *outcome*, not whether a rule *matches* a request. */
const NON_MATCHER_FIELDS = new Set([
  "privileges",
  "allow",
  "owner",
  "columns",
  "filter",
  "mask",
]);

const WILDCARD_PATTERNS = new Set(["", ".*", "(.*)", ".+", "(.+)"]);

type Rule = Record<string, unknown>;

/** Sorted (field,pattern) pairs that participate in matching. */
function matcherEntries(rule: Rule): [string, string][] {
  return Object.entries(rule)
    .filter(([k, v]) => !NON_MATCHER_FIELDS.has(k) && typeof v === "string")
    .map(([k, v]) => [k, v as string] as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

export function scopeSignature(rule: Rule): string {
  return JSON.stringify(matcherEntries(rule));
}

/** A rule matches everything when every matcher pattern is absent or a wildcard. */
function isCatchAll(rule: Rule): boolean {
  return matcherEntries(rule).every(([, v]) => WILDCARD_PATTERNS.has(v));
}

/** Human description of a rule's scope ("group=analysts, catalog=prod" / "herkes"). */
export function describeScope(rule: Rule): string {
  const entries = matcherEntries(rule).filter(([, v]) => !WILDCARD_PATTERNS.has(v));
  if (entries.length === 0) return "herkes / her şey";
  return entries.map(([k, v]) => `${k}=${v}`).join(", ");
}

export function detectConflicts(doc: RulesDocument): ConflictIssue[] {
  const issues: ConflictIssue[] = [];

  for (const [section, value] of Object.entries(doc)) {
    if (!Array.isArray(value)) continue;
    const rules = value as Rule[];
    const signatures = rules.map(scopeSignature);

    let firstCatchAll = -1;
    for (let i = 0; i < rules.length; i++) {
      // 1) duplicate scope (identical matchers as an earlier rule)
      const dup = signatures.indexOf(signatures[i]);
      if (dup !== -1 && dup < i) {
        issues.push({
          section,
          index: i,
          shadowedBy: dup,
          kind: "duplicate-scope",
          message: `"${section}" #${i + 1} kuralı, aynı kapsamlı #${dup + 1} tarafından gölgeleniyor — ulaşılamaz.`,
        });
        continue;
      }
      // 2) preceded by a catch-all rule
      if (firstCatchAll !== -1 && firstCatchAll < i) {
        issues.push({
          section,
          index: i,
          shadowedBy: firstCatchAll,
          kind: "catch-all",
          message: `"${section}" #${i + 1} kuralı, her şeyi eşleyen #${firstCatchAll + 1} kuralından sonra geldiği için ulaşılamaz.`,
        });
      }
      if (firstCatchAll === -1 && isCatchAll(rules[i])) firstCatchAll = i;
    }
  }

  return issues;
}
