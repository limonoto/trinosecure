import { rulesDocumentSchema, type RulesDocument } from "./schema";

/** A valid, empty rules document (deny-by-default everywhere). */
export const EMPTY_RULES: RulesDocument = { catalogs: [], schemas: [], tables: [] };

export type ParseResult =
  | { ok: true; doc: RulesDocument }
  | { ok: false; error: string };

/** Parse + validate a rules.json string. */
export function parseRulesJson(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Geçersiz JSON" };
  }
  const result = rulesDocumentSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    const where = path ? ` (${path})` : "";
    return { ok: false, error: `Geçersiz kural yapısı${where}: ${issue?.message ?? ""}` };
  }
  return { ok: true, doc: result.data };
}

/** Pretty-print a rules document (stable 2-space JSON). */
export function serializeRulesJson(doc: RulesDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function isValidRegex(pattern: string): boolean {
  try {
    return Boolean(new RegExp(pattern));
  } catch {
    return false;
  }
}

export type RuleIssue = { severity: "error" | "warning"; message: string };

const PATTERN_FIELDS = [
  "user",
  "role",
  "group",
  "catalog",
  "schema",
  "table",
  "function",
  "procedure",
  "property",
  "queryOwner",
  "original_user",
  "original_role",
  "original_group",
  "new_user",
  "new_role",
] as const;

// Sections where an empty array means "deny all at this level" (a footgun worth warning about).
const DENY_ALL_SECTIONS = new Set([
  "catalogs",
  "schemas",
  "tables",
  "functions",
  "procedures",
  "queries",
  "system_information",
  "system_session_properties",
  "catalog_session_properties",
]);

/**
 * Semantic checks beyond structural validity, across every rule section:
 * invalid regex in pattern fields, and deny-all empty arrays.
 */
export function validateRulesDocument(doc: RulesDocument): RuleIssue[] {
  const issues: RuleIssue[] = [];

  for (const [section, value] of Object.entries(doc)) {
    if (!Array.isArray(value)) continue;

    value.forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      const record = row as Record<string, unknown>;
      for (const field of PATTERN_FIELDS) {
        const fieldValue = record[field];
        if (typeof fieldValue === "string" && !isValidRegex(fieldValue)) {
          issues.push({
            severity: "error",
            message: `Geçersiz regex — ${section}[${index}].${field}: "${fieldValue}"`,
          });
        }
      }
    });

    if (value.length === 0 && DENY_ALL_SECTIONS.has(section)) {
      issues.push({
        severity: "warning",
        message: `"${section}" boş — bu seviyede her şey reddedilir (deny-all).`,
      });
    }
  }

  return issues;
}

export function ruleCounts(doc: RulesDocument): { catalogs: number; schemas: number; tables: number } {
  return {
    catalogs: doc.catalogs?.length ?? 0,
    schemas: doc.schemas?.length ?? 0,
    tables: doc.tables?.length ?? 0,
  };
}
