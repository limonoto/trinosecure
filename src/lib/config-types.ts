/**
 * The managed config files a CONFIG_EDITOR's authority can be scoped to
 * (requirement 3.2). Dependency-free so it can be imported from both client and
 * server. Values mirror the Prisma `ConfigArtifactType` enum.
 */

export const SCOPABLE_CONFIG_TYPES = [
  "RULES_JSON",
  "RESOURCE_GROUPS_JSON",
  "GROUP_PROVIDER",
  "CATALOG_PROPERTIES",
  "PASSWORD_DB",
] as const;

export type ScopableConfigType = (typeof SCOPABLE_CONFIG_TYPES)[number];

/** Human-readable Turkish labels for the scopable config types. */
export const CONFIG_TYPE_LABEL: Record<ScopableConfigType, string> = {
  RULES_JSON: "rules.json (yetkilendirme)",
  RESOURCE_GROUPS_JSON: "resource-groups.json",
  GROUP_PROVIDER: "group-provider (kullanıcı/grup)",
  CATALOG_PROPERTIES: "Katalog konfigleri",
  PASSWORD_DB: "password.db",
};
