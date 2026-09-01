import type { RulesDocument } from "./schema";
import { scopeSignature, describeScope } from "./conflicts";

/**
 * Logical (semantic) diff between two rules documents — requirement 4.2
 * ("limit 10 → 20" style changes, not just text lines). Rules are paired by
 * their matcher scope; matched pairs report outcome-field changes, the rest are
 * reported as added/removed.
 */

export type LogicalChangeKind = "added" | "removed" | "modified";

export type LogicalChange = {
  section: string;
  kind: LogicalChangeKind;
  /** Human description of the affected rule's scope. */
  scope: string;
  /** For "modified": the field-level changes (e.g. "privileges: [SELECT] → [SELECT, INSERT]"). */
  details: string[];
};

type Rule = Record<string, unknown>;

const OUTCOME_FIELDS = ["privileges", "allow", "owner", "filter", "columns", "mask"];

function asSection(doc: RulesDocument, key: string): Rule[] {
  const value = (doc as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as Rule[]) : [];
}

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (Array.isArray(value)) {
    return `[${value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")}]`;
  }
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Field-level outcome changes between two rules with the same scope. */
function diffOutcomes(before: Rule, after: Rule): string[] {
  const details: string[] = [];
  for (const field of OUTCOME_FIELDS) {
    if (!sameValue(before[field], after[field])) {
      details.push(`${field}: ${formatValue(before[field])} → ${formatValue(after[field])}`);
    }
  }
  return details;
}

/** Pair rules within a section by scope, in document order, then diff. */
function diffSection(section: string, before: Rule[], after: Rule[]): LogicalChange[] {
  const changes: LogicalChange[] = [];
  const afterUsed = new Array(after.length).fill(false);

  for (const b of before) {
    const sig = scopeSignature(b);
    const matchIdx = after.findIndex((a, i) => !afterUsed[i] && scopeSignature(a) === sig);
    if (matchIdx === -1) {
      changes.push({ section, kind: "removed", scope: describeScope(b), details: [] });
    } else {
      afterUsed[matchIdx] = true;
      const details = diffOutcomes(b, after[matchIdx]);
      if (details.length > 0) {
        changes.push({ section, kind: "modified", scope: describeScope(b), details });
      }
    }
  }
  after.forEach((a, i) => {
    if (!afterUsed[i]) changes.push({ section, kind: "added", scope: describeScope(a), details: [] });
  });

  return changes;
}

const SECTIONS = [
  "catalogs",
  "schemas",
  "tables",
  "functions",
  "procedures",
  "queries",
  "impersonation",
  "authorization",
  "system_information",
  "system_session_properties",
  "catalog_session_properties",
];

export function logicalDiff(before: RulesDocument, after: RulesDocument): LogicalChange[] {
  return SECTIONS.flatMap((section) =>
    diffSection(section, asSection(before, section), asSection(after, section)),
  );
}
