// Declarative registry of every rules.json rule type. One source of truth that
// drives both the structured editor table (columns) and the add/edit form (fields).
//
// Section order matches the canonical rules.json hierarchy (Trino Secure report
// §4.5 "rules.json Genel Yapısı"): catalogs, schemas, tables, functions,
// procedures, queries, impersonation, system_information,
// system_session_properties, catalog_session_properties, authorization. This
// array is the single source of truth for that order — it drives both the
// on-screen section order and the serialized JSON key order (see rule-types.ts
// toDocument), so the hierarchy stays identical in the UI and the raw file.

export type BadgeTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "destructive";

export type Cell =
  | { kind: "mono"; value: string }
  | { kind: "muted"; value: string }
  | { kind: "badge"; tone: BadgeTone; value: string }
  | { kind: "badges"; tone: BadgeTone; values: string[]; emptyValue: string };

export type FieldType = "text" | "bool" | "multi" | "select" | "columns";
export type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  fullWidth?: boolean;
  defaultOn?: boolean;
};

type RuleRecord = Record<string, unknown>;
export type ColumnConfig = { header: string; cell: (rule: RuleRecord) => Cell };

export type SectionConfig = {
  key: string;
  label: string;
  minWidth: number;
  fields: FieldConfig[];
  columns: ColumnConfig[];
};

// ---- option lists ----
const TABLE_PRIVS = ["SELECT", "INSERT", "DELETE", "UPDATE", "OWNERSHIP", "GRANT_SELECT"];
const FUNCTION_PRIVS = ["EXECUTE", "GRANT_EXECUTE", "OWNERSHIP"];
const PROCEDURE_PRIVS = ["EXECUTE", "GRANT_EXECUTE"];
const QUERY_ALLOW = ["execute", "view", "kill"];
const SYSINFO_ALLOW = ["read", "write"];
const CATALOG_ALLOW = ["all", "read-only", "none"];

const CATALOG_TONE: Record<string, BadgeTone> = {
  all: "primary",
  "read-only": "neutral",
  none: "destructive",
};

// ---- cell + field helpers ----
function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function identityCell(rule: RuleRecord): Cell {
  const role = str(rule.role);
  const group = str(rule.group);
  const user = str(rule.user);
  if (role) return { kind: "mono", value: `role:${role}` };
  if (group) return { kind: "mono", value: `group:${group}` };
  if (user && user !== ".*") return { kind: "mono", value: `user:${user}` };
  return { kind: "muted", value: "herkes" };
}
function pathCell(rule: RuleRecord, parts: string[]): Cell {
  return { kind: "mono", value: parts.map((p) => str(rule[p]) ?? ".*").join(".") };
}
function allowBoolCell(rule: RuleRecord): Cell {
  const allowed = rule.allow !== false; // optional → default allow
  return { kind: "badge", tone: allowed ? "success" : "destructive", value: allowed ? "izin" : "red" };
}
function hasColumnMask(rule: RuleRecord): boolean {
  const cols = Array.isArray(rule.columns) ? rule.columns : [];
  return cols.some(
    (c) => typeof c === "object" && c !== null && Boolean((c as { mask?: unknown }).mask),
  );
}

const IDENTITY_FIELDS: FieldConfig[] = [
  { name: "user", label: "User", type: "text", placeholder: ".*" },
  { name: "group", label: "Group", type: "text", placeholder: "analysts" },
  { name: "role", label: "Role", type: "text", placeholder: "(opsiyonel)" },
];

const identityColumn: ColumnConfig = { header: "Kimlik", cell: identityCell };

export const SECTIONS: SectionConfig[] = [
  {
    key: "catalogs",
    label: "Catalog kuralları",
    minWidth: 560,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "catalog", label: "Catalog", type: "text", placeholder: ".*" },
      { name: "allow", label: "Erişim", type: "select", options: CATALOG_ALLOW },
    ],
    columns: [
      identityColumn,
      { header: "Catalog", cell: (r) => ({ kind: "mono", value: str(r.catalog) ?? ".*" }) },
      {
        header: "Erişim",
        cell: (r) => {
          const allow = str(r.allow) ?? "";
          return { kind: "badge", tone: CATALOG_TONE[allow] ?? "neutral", value: allow };
        },
      },
    ],
  },
  {
    key: "schemas",
    label: "Schema kuralları",
    minWidth: 560,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "catalog", label: "Catalog", type: "text", placeholder: ".*" },
      { name: "schema", label: "Schema", type: "text", placeholder: ".*" },
      { name: "owner", label: "Sahip (owner)", type: "bool" },
    ],
    columns: [
      identityColumn,
      { header: "Şema", cell: (r) => pathCell(r, ["catalog", "schema"]) },
      {
        header: "Sahip",
        cell: (r) =>
          r.owner === true
            ? { kind: "badge", tone: "primary", value: "owner" }
            : { kind: "badge", tone: "neutral", value: "hayır" },
      },
    ],
  },
  {
    key: "tables",
    label: "Table kuralları",
    minWidth: 760,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "catalog", label: "Catalog", type: "text", placeholder: ".*" },
      { name: "schema", label: "Schema", type: "text", placeholder: ".*" },
      { name: "table", label: "Table", type: "text", placeholder: ".*" },
      { name: "privileges", label: "Yetkiler", type: "multi", options: TABLE_PRIVS },
      { name: "columns", label: "Sütun kısıtları / maskeler", type: "columns", fullWidth: true },
      {
        name: "filter",
        label: "Satır filtresi (SQL)",
        type: "text",
        fullWidth: true,
        placeholder: "region = current_user_region()",
      },
    ],
    columns: [
      identityColumn,
      { header: "Kaynak", cell: (r) => pathCell(r, ["catalog", "schema", "table"]) },
      {
        header: "Yetkiler",
        cell: (r) => {
          const privs = strArray(r.privileges);
          if (privs.length === 0) return { kind: "badge", tone: "destructive", value: "Deny" };
          return { kind: "badges", tone: "neutral", values: privs, emptyValue: "—" };
        },
      },
      {
        header: "Ek",
        cell: (r) => {
          const extras: string[] = [];
          if (hasColumnMask(r)) extras.push("maske");
          if (str(r.filter)) extras.push("satır filtresi");
          return { kind: "badges", tone: "info", values: extras, emptyValue: "—" };
        },
      },
    ],
  },
  {
    key: "functions",
    label: "Function kuralları",
    minWidth: 680,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "catalog", label: "Catalog", type: "text", placeholder: ".*" },
      { name: "schema", label: "Schema", type: "text", placeholder: ".*" },
      { name: "function", label: "Function", type: "text", placeholder: ".*" },
      { name: "privileges", label: "Yetkiler", type: "multi", options: FUNCTION_PRIVS },
    ],
    columns: [
      identityColumn,
      { header: "Kaynak", cell: (r) => pathCell(r, ["catalog", "schema", "function"]) },
      {
        header: "Yetkiler",
        cell: (r) => ({ kind: "badges", tone: "neutral", values: strArray(r.privileges), emptyValue: "—" }),
      },
    ],
  },
  {
    key: "procedures",
    label: "Procedure kuralları",
    minWidth: 680,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "catalog", label: "Catalog", type: "text", placeholder: ".*" },
      { name: "schema", label: "Schema", type: "text", placeholder: ".*" },
      { name: "procedure", label: "Procedure", type: "text", placeholder: ".*" },
      { name: "privileges", label: "Yetkiler", type: "multi", options: PROCEDURE_PRIVS },
    ],
    columns: [
      identityColumn,
      { header: "Kaynak", cell: (r) => pathCell(r, ["catalog", "schema", "procedure"]) },
      {
        header: "Yetkiler",
        cell: (r) => ({ kind: "badges", tone: "neutral", values: strArray(r.privileges), emptyValue: "—" }),
      },
    ],
  },
  {
    key: "queries",
    label: "Query kuralları",
    minWidth: 560,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "queryOwner", label: "Query Owner", type: "text", placeholder: ".*" },
      { name: "allow", label: "İzin", type: "multi", options: QUERY_ALLOW },
    ],
    columns: [
      identityColumn,
      { header: "Query Owner", cell: (r) => ({ kind: "mono", value: str(r.queryOwner) ?? "—" }) },
      { header: "İzin", cell: (r) => ({ kind: "badges", tone: "info", values: strArray(r.allow), emptyValue: "—" }) },
    ],
  },
  {
    key: "impersonation",
    label: "Impersonation kuralları",
    minWidth: 560,
    fields: [
      { name: "original_user", label: "Original User", type: "text", placeholder: ".*" },
      { name: "original_role", label: "Original Role", type: "text", placeholder: "(opsiyonel)" },
      { name: "new_user", label: "New User (zorunlu)", type: "text", placeholder: "team_$1_sandbox" },
      { name: "allow", label: "İzin ver", type: "bool", defaultOn: true },
    ],
    columns: [
      { header: "Original", cell: (r) => ({ kind: "mono", value: str(r.original_user) ?? str(r.original_role) ?? ".*" }) },
      { header: "New User", cell: (r) => ({ kind: "mono", value: str(r.new_user) ?? "" }) },
      { header: "İzin", cell: allowBoolCell },
    ],
  },
  {
    key: "system_information",
    label: "System Information kuralları",
    minWidth: 480,
    fields: [
      { name: "user", label: "User", type: "text", placeholder: ".*" },
      { name: "role", label: "Role", type: "text", placeholder: "(opsiyonel)" },
      { name: "allow", label: "İzin", type: "multi", options: SYSINFO_ALLOW },
    ],
    columns: [
      identityColumn,
      { header: "İzin", cell: (r) => ({ kind: "badges", tone: "info", values: strArray(r.allow), emptyValue: "—" }) },
    ],
  },
  {
    key: "system_session_properties",
    label: "System Session Properties",
    minWidth: 520,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "property", label: "Property", type: "text", placeholder: ".*" },
      { name: "allow", label: "İzin ver", type: "bool", defaultOn: true },
    ],
    columns: [
      identityColumn,
      { header: "Property", cell: (r) => ({ kind: "mono", value: str(r.property) ?? ".*" }) },
      { header: "İzin", cell: allowBoolCell },
    ],
  },
  {
    key: "catalog_session_properties",
    label: "Catalog Session Properties",
    minWidth: 560,
    fields: [
      ...IDENTITY_FIELDS,
      { name: "catalog", label: "Catalog", type: "text", placeholder: ".*" },
      { name: "property", label: "Property", type: "text", placeholder: ".*" },
      { name: "allow", label: "İzin ver", type: "bool", defaultOn: true },
    ],
    columns: [
      identityColumn,
      { header: "Kaynak", cell: (r) => pathCell(r, ["catalog", "property"]) },
      { header: "İzin", cell: allowBoolCell },
    ],
  },
  {
    key: "authorization",
    label: "Authorization kuralları",
    minWidth: 620,
    fields: [
      { name: "original_user", label: "Original User", type: "text", placeholder: ".*" },
      { name: "original_role", label: "Original Role", type: "text", placeholder: "(ops.)" },
      { name: "original_group", label: "Original Group", type: "text", placeholder: "(ops.)" },
      { name: "new_user", label: "New User", type: "text", placeholder: "(ops.)" },
      { name: "new_role", label: "New Role", type: "text", placeholder: "(ops.)" },
      { name: "allow", label: "İzin ver", type: "bool", defaultOn: true },
    ],
    columns: [
      { header: "Original", cell: (r) => ({ kind: "mono", value: str(r.original_user) ?? str(r.original_group) ?? str(r.original_role) ?? ".*" }) },
      { header: "New", cell: (r) => ({ kind: "mono", value: str(r.new_user) ?? str(r.new_role) ?? "" }) },
      { header: "İzin", cell: allowBoolCell },
    ],
  },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);
