import type { BootCheckResult } from "@/lib/rules/boot-check";
import { getConnector } from "./connectors";

/**
 * "Will this catalog `.properties` boot in Trino?" (requirement 2.2). Errors are
 * load-time blockers: an unknown connector, or a required connector parameter
 * left empty. Warnings flag recommended-but-optional params.
 */
export function bootCheckCatalog(connector: string, properties: Record<string, string>): BootCheckResult {
  const def = getConnector(connector);
  if (!def) return { ready: false, errors: [`Bilinmeyen connector: "${connector}"`], warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];
  for (const param of def.params) {
    const value = properties[param.key];
    const missing = value === undefined || value.trim() === "";
    if (param.required && missing) {
      errors.push(`Zorunlu parametre eksik: ${param.key} (${param.label})`);
    }
  }
  return { ready: errors.length === 0, errors, warnings };
}
