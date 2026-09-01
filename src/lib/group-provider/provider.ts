/**
 * Group provider configuration — requirement 2.1 ("LDAP / statik kullanıcı ayrımı").
 * The provider is either the static file (`group-provider.txt`) or LDAP. This
 * module holds the LDAP field registry and renders `group-provider.properties`.
 */

export type GroupProviderType = "FILE" | "LDAP";

export type GroupProviderConfig = {
  type: GroupProviderType;
  ldap: Record<string, string>;
};

export const DEFAULT_GROUP_PROVIDER_CONFIG: GroupProviderConfig = { type: "FILE", ldap: {} };

export type LdapField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
};

export const LDAP_FIELDS: LdapField[] = [
  { key: "ldap.url", label: "LDAP URL", placeholder: "ldaps://host:636", required: true },
  { key: "ldap.admin-user", label: "Admin DN", placeholder: "cn=admin,dc=example,dc=com" },
  { key: "ldap.admin-password", label: "Admin şifre", placeholder: "••••••", secret: true },
  { key: "ldap.user-base-dn", label: "Kullanıcı base DN", placeholder: "ou=users,dc=example,dc=com", required: true },
  { key: "ldap.group-base-dn", label: "Grup base DN", placeholder: "ou=groups,dc=example,dc=com", required: true },
  { key: "ldap.group-name-attribute", label: "Grup ad attribute", placeholder: "cn" },
];

/** Render `group-provider.properties` for LDAP. */
export function toLdapProviderProperties(values: Record<string, string>): string {
  const lines = ["group-provider.name=ldap"];
  for (const key of Object.keys(values).sort((a, b) => a.localeCompare(b))) {
    const value = values[key];
    if (value !== undefined && value !== "") lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Render `group-provider.properties` for the static file provider. */
export function toFileProviderProperties(groupFilePath: string): string {
  return `group-provider.name=file\nfile.group-file=${groupFilePath}\n`;
}

export function parseGroupProviderConfig(json: string | null): GroupProviderConfig {
  if (!json) return DEFAULT_GROUP_PROVIDER_CONFIG;
  try {
    const parsed = JSON.parse(json) as Partial<GroupProviderConfig>;
    return {
      type: parsed.type === "LDAP" ? "LDAP" : "FILE",
      ldap: parsed.ldap && typeof parsed.ldap === "object" ? (parsed.ldap as Record<string, string>) : {},
    };
  } catch {
    return DEFAULT_GROUP_PROVIDER_CONFIG;
  }
}
