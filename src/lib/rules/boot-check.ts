import { parseRulesJson, validateRulesDocument } from "./rules";
import { detectConflicts } from "./conflicts";

/**
 * "Will this config boot in Trino?" readiness aggregation — requirement 2.2.
 *
 * Errors are things Trino would reject at load time (invalid JSON/structure,
 * uncompilable regex). Warnings (deny-all sections, shadowed/unreachable rules)
 * still boot but are surfaced so the operator can confirm intent. The optional
 * live probe (does the cluster respond?) is layered on top in the server action.
 */

export type BootCheckResult = {
  ready: boolean;
  errors: string[];
  warnings: string[];
};

export function bootCheck(content: string): BootCheckResult {
  const parsed = parseRulesJson(content);
  if (!parsed.ok) {
    return { ready: false, errors: [parsed.error], warnings: [] };
  }

  const issues = validateRulesDocument(parsed.doc);
  const errors = issues.filter((i) => i.severity === "error").map((i) => i.message);
  const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);

  for (const conflict of detectConflicts(parsed.doc)) {
    warnings.push(conflict.message);
  }

  return { ready: errors.length === 0, errors, warnings };
}
