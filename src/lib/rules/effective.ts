import type { RulesDocument, TableRule, TablePrivilege, CatalogAccess } from "./schema";

/**
 * Effective-permission evaluation ("can this user/group do X?") — requirement 2.1
 * rule preview. Mirrors Trino's file-based access control semantics:
 *
 *  - identity/location patterns are **full-match** regex (anchored), absent = match-any;
 *  - rules are evaluated top-down, **first match wins** (no fall-through);
 *  - for a matched table rule, the privilege is allowed iff it is in `privileges`;
 *  - no matching rule → denied (deny by default).
 */

export type AccessSubject = {
  user: string;
  groups?: string[];
  roles?: string[];
};

export type TableAccessQuery = {
  catalog: string;
  schema: string;
  table: string;
  privilege: TablePrivilege;
};

export type CatalogAccessQuery = {
  catalog: string;
};

export type EvalReason = "matched-allow" | "matched-deny" | "no-match";

export type EvalResult = {
  allowed: boolean;
  /** Index of the matched rule within its section, or -1 if nothing matched. */
  matchedIndex: number;
  reason: EvalReason;
};

/** Trino patterns are anchored full-matches; an invalid regex never matches. */
export function fullMatch(pattern: string | undefined, value: string): boolean {
  if (pattern === undefined) return true;
  try {
    return new RegExp(`^(?:${pattern})$`).test(value);
  } catch {
    return false;
  }
}

/** Does the rule's identity (user/role/group) match the subject? */
function identityMatches(
  rule: { user?: string; role?: string; group?: string },
  subject: AccessSubject,
): boolean {
  if (!fullMatch(rule.user, subject.user)) return false;
  if (rule.group !== undefined && !(subject.groups ?? []).some((g) => fullMatch(rule.group, g))) {
    return false;
  }
  if (rule.role !== undefined && !(subject.roles ?? []).some((r) => fullMatch(rule.role, r))) {
    return false;
  }
  return true;
}

function tableLocationMatches(rule: TableRule, q: TableAccessQuery): boolean {
  return (
    fullMatch(rule.catalog, q.catalog) &&
    fullMatch(rule.schema, q.schema) &&
    fullMatch(rule.table, q.table)
  );
}

/** Evaluate a single table privilege for a subject (first-match-wins). */
export function evaluateTableAccess(
  doc: RulesDocument,
  subject: AccessSubject,
  q: TableAccessQuery,
): EvalResult {
  const tables = doc.tables ?? [];
  for (let i = 0; i < tables.length; i++) {
    const rule = tables[i];
    if (identityMatches(rule, subject) && tableLocationMatches(rule, q)) {
      const allowed = rule.privileges.includes(q.privilege);
      return { allowed, matchedIndex: i, reason: allowed ? "matched-allow" : "matched-deny" };
    }
  }
  return { allowed: false, matchedIndex: -1, reason: "no-match" };
}

/** Evaluate catalog-level visibility/access for a subject (first-match-wins). */
export function evaluateCatalogAccess(
  doc: RulesDocument,
  subject: AccessSubject,
  q: CatalogAccessQuery,
): { access: CatalogAccess; matchedIndex: number } {
  // Trino: an *absent* `catalogs` key defaults to "all"; a *present* `catalogs`
  // list (even empty) denies anything that does not match a rule.
  const catalogs = doc.catalogs;
  if (catalogs === undefined) return { access: "all", matchedIndex: -1 };
  for (let i = 0; i < catalogs.length; i++) {
    const rule = catalogs[i];
    if (identityMatches(rule, subject) && fullMatch(rule.catalog, q.catalog)) {
      return { access: rule.allow, matchedIndex: i };
    }
  }
  return { access: "none", matchedIndex: -1 };
}

/** Convenience: evaluate every table privilege at once (for the preview panel). */
export const ALL_TABLE_PRIVILEGES: TablePrivilege[] = [
  "SELECT",
  "INSERT",
  "DELETE",
  "UPDATE",
  "OWNERSHIP",
  "GRANT_SELECT",
];

export function evaluateAllTablePrivileges(
  doc: RulesDocument,
  subject: AccessSubject,
  location: Omit<TableAccessQuery, "privilege">,
): Record<TablePrivilege, EvalResult> {
  const out = {} as Record<TablePrivilege, EvalResult>;
  for (const privilege of ALL_TABLE_PRIVILEGES) {
    out[privilege] = evaluateTableAccess(doc, subject, { ...location, privilege });
  }
  return out;
}
