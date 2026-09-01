import { z } from "zod";

/**
 * Zod schemas for Trino's file-based access control `rules.json` — all rule
 * sections are modeled. Unmodeled keys still survive via passthrough.
 * See docs/04-rules-json-reference.md.
 */

const identity = {
  user: z.string().optional(),
  role: z.string().optional(),
  group: z.string().optional(),
};

export const catalogAccessSchema = z.enum(["all", "read-only", "none"]);
export const catalogRuleSchema = z.object({
  ...identity,
  catalog: z.string().optional(),
  allow: catalogAccessSchema,
});

export const schemaRuleSchema = z.object({
  ...identity,
  catalog: z.string().optional(),
  schema: z.string().optional(),
  owner: z.boolean(),
});

export const tablePrivilegeSchema = z.enum([
  "SELECT",
  "INSERT",
  "DELETE",
  "UPDATE",
  "OWNERSHIP",
  "GRANT_SELECT",
]);
export const columnConstraintSchema = z.object({
  name: z.string(),
  allow: z.boolean().optional(),
  mask: z.string().optional(),
});
export const tableRuleSchema = z.object({
  ...identity,
  catalog: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().optional(),
  privileges: z.array(tablePrivilegeSchema),
  columns: z.array(columnConstraintSchema).optional(),
  filter: z.string().optional(),
});

export const functionPrivilegeSchema = z.enum(["EXECUTE", "GRANT_EXECUTE", "OWNERSHIP"]);
export const functionRuleSchema = z.object({
  ...identity,
  catalog: z.string().optional(),
  schema: z.string().optional(),
  function: z.string().optional(),
  privileges: z.array(functionPrivilegeSchema),
});

export const procedurePrivilegeSchema = z.enum(["EXECUTE", "GRANT_EXECUTE"]);
export const procedureRuleSchema = z.object({
  ...identity,
  catalog: z.string().optional(),
  schema: z.string().optional(),
  procedure: z.string().optional(),
  privileges: z.array(procedurePrivilegeSchema),
});

export const queryAccessSchema = z.enum(["execute", "view", "kill"]);
export const queryRuleSchema = z.object({
  user: z.string().optional(),
  role: z.string().optional(),
  group: z.string().optional(),
  queryOwner: z.string().optional(),
  allow: z.array(queryAccessSchema),
});

export const impersonationRuleSchema = z.object({
  original_user: z.string().optional(),
  original_role: z.string().optional(),
  new_user: z.string(),
  allow: z.boolean().optional(),
});

export const authorizationRuleSchema = z.object({
  original_user: z.string().optional(),
  original_role: z.string().optional(),
  original_group: z.string().optional(),
  new_user: z.string().optional(),
  new_role: z.string().optional(),
  allow: z.boolean().optional(),
});

export const systemInformationAccessSchema = z.enum(["read", "write"]);
export const systemInformationRuleSchema = z.object({
  user: z.string().optional(),
  role: z.string().optional(),
  allow: z.array(systemInformationAccessSchema),
});

export const systemSessionPropertyRuleSchema = z.object({
  ...identity,
  property: z.string().optional(),
  allow: z.boolean(),
});

export const catalogSessionPropertyRuleSchema = z.object({
  ...identity,
  catalog: z.string().optional(),
  property: z.string().optional(),
  allow: z.boolean(),
});

// Section key order follows the canonical rules.json hierarchy (Trino Secure
// report §4.5). It is kept identical to SECTIONS in rules/rule-sections.ts so the
// model, the editor, and the serialized file all agree on the same ordering.
export const rulesDocumentSchema = z.looseObject({
  catalogs: z.array(catalogRuleSchema).optional(),
  schemas: z.array(schemaRuleSchema).optional(),
  tables: z.array(tableRuleSchema).optional(),
  functions: z.array(functionRuleSchema).optional(),
  procedures: z.array(procedureRuleSchema).optional(),
  queries: z.array(queryRuleSchema).optional(),
  impersonation: z.array(impersonationRuleSchema).optional(),
  system_information: z.array(systemInformationRuleSchema).optional(),
  system_session_properties: z.array(systemSessionPropertyRuleSchema).optional(),
  catalog_session_properties: z.array(catalogSessionPropertyRuleSchema).optional(),
  authorization: z.array(authorizationRuleSchema).optional(),
});

export type CatalogAccess = z.infer<typeof catalogAccessSchema>;
export type CatalogRule = z.infer<typeof catalogRuleSchema>;
export type SchemaRule = z.infer<typeof schemaRuleSchema>;
export type TablePrivilege = z.infer<typeof tablePrivilegeSchema>;
export type ColumnConstraint = z.infer<typeof columnConstraintSchema>;
export type TableRule = z.infer<typeof tableRuleSchema>;
export type RulesDocument = z.infer<typeof rulesDocumentSchema>;
