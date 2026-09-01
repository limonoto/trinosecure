/**
 * Typed config interfaces + serialize/parse for the 4 Trino `.properties` files
 * that NİZAM manages: access-control, password-authenticator, resource-groups,
 * group-provider.
 */

import { parseProperties, serializeProperties } from "./parse";

// ─── access-control.properties ───────────────────────────────────────────────

export type AccessControlName = "file" | "opa" | "ranger" | "allow-all" | "read-only";

export type AccessControlConfig = {
  name: AccessControlName;
  /** Path or HTTP URL to rules.json (file/http modes). */
  configFile: string;
  /** How often Trino re-reads the config (e.g. "30s"). */
  refreshPeriod: string;
  /** OPA policy URI (OPA mode). */
  opaUri: string;
  /** Extra raw key=value pairs not modelled above. */
  extra: Record<string, string>;
};

export const DEFAULT_ACCESS_CONTROL: AccessControlConfig = {
  name: "file",
  configFile: "/etc/trino/rules.json",
  refreshPeriod: "30s",
  opaUri: "",
  extra: {},
};

export function parseAccessControl(text: string): AccessControlConfig {
  const p = parseProperties(text);
  const { "access-control.name": name, "security.config-file": cf, "security.refresh-period": rp,
    "opa.policy.uri": opaUri, ...rest } = p;
  return {
    name: (name as AccessControlName) ?? "file",
    configFile: cf ?? "/etc/trino/rules.json",
    refreshPeriod: rp ?? "30s",
    opaUri: opaUri ?? "",
    extra: rest,
  };
}

export function serializeAccessControl(cfg: AccessControlConfig): string {
  const props: Record<string, string> = { "access-control.name": cfg.name };
  if (cfg.name === "file" || cfg.name === "ranger") {
    if (cfg.configFile) props["security.config-file"] = cfg.configFile;
    if (cfg.refreshPeriod) props["security.refresh-period"] = cfg.refreshPeriod;
  }
  if (cfg.name === "opa" && cfg.opaUri) props["opa.policy.uri"] = cfg.opaUri;
  Object.assign(props, cfg.extra);
  return serializeProperties(props, "Trino access-control configuration — managed by NİZAM");
}

// ─── password-authenticator.properties ───────────────────────────────────────

export type AuthName = "file" | "ldap" | "salesforce";

export type AuthConfig = {
  name: AuthName;
  /** FILE mode */
  passwordFile: string;
  fileRefreshPeriod: string;
  tokenCacheMaxSize: string;
  /** LDAP mode */
  ldapUrl: string;
  ldapUserBindPattern: string;
  ldapGroupAuthorizationFilter: string;
  ldapCacheTtl: string;
  /** Extra raw key=value pairs. */
  extra: Record<string, string>;
};

export const DEFAULT_AUTH: AuthConfig = {
  name: "file",
  passwordFile: "/etc/trino/password.db",
  fileRefreshPeriod: "5s",
  tokenCacheMaxSize: "1000",
  ldapUrl: "",
  ldapUserBindPattern: "",
  ldapGroupAuthorizationFilter: "",
  ldapCacheTtl: "1h",
  extra: {},
};

export function parseAuth(text: string): AuthConfig {
  const p = parseProperties(text);
  const {
    "password-authenticator.name": name,
    "file.password-file": pf, "file.refresh-period": rp, "file.auth-token-cache.max-size": cs,
    "ldap.url": lu, "ldap.user-bind-pattern": ubp,
    "ldap.group-authorization-filter": gaf, "ldap.cache-ttl": cttl,
    ...rest
  } = p;
  return {
    name: (name as AuthName) ?? "file",
    passwordFile: pf ?? "/etc/trino/password.db",
    fileRefreshPeriod: rp ?? "5s",
    tokenCacheMaxSize: cs ?? "1000",
    ldapUrl: lu ?? "",
    ldapUserBindPattern: ubp ?? "",
    ldapGroupAuthorizationFilter: gaf ?? "",
    ldapCacheTtl: cttl ?? "1h",
    extra: rest,
  };
}

export function serializeAuth(cfg: AuthConfig): string {
  const props: Record<string, string> = { "password-authenticator.name": cfg.name };
  if (cfg.name === "file") {
    if (cfg.passwordFile) props["file.password-file"] = cfg.passwordFile;
    if (cfg.fileRefreshPeriod) props["file.refresh-period"] = cfg.fileRefreshPeriod;
    if (cfg.tokenCacheMaxSize) props["file.auth-token-cache.max-size"] = cfg.tokenCacheMaxSize;
  }
  if (cfg.name === "ldap") {
    if (cfg.ldapUrl) props["ldap.url"] = cfg.ldapUrl;
    if (cfg.ldapUserBindPattern) props["ldap.user-bind-pattern"] = cfg.ldapUserBindPattern;
    if (cfg.ldapGroupAuthorizationFilter) props["ldap.group-authorization-filter"] = cfg.ldapGroupAuthorizationFilter;
    if (cfg.ldapCacheTtl) props["ldap.cache-ttl"] = cfg.ldapCacheTtl;
  }
  Object.assign(props, cfg.extra);
  return serializeProperties(props, "Trino password-authenticator configuration — managed by NİZAM");
}

// ─── resource-groups.properties ──────────────────────────────────────────────

export type RgManagerMode = "file" | "db";

export type RgPropsConfig = {
  mode: RgManagerMode;
  /** FILE mode */
  configFile: string;
  /** DB mode */
  dbUrl: string;
  dbUser: string;
  dbPassword: string;
  dbEnvironment: string;
  dbRefreshIntervalMs: string;
  /** Extra raw key=value pairs. */
  extra: Record<string, string>;
};

export const DEFAULT_RG_PROPS: RgPropsConfig = {
  mode: "file",
  configFile: "/etc/trino/resource-groups.json",
  dbUrl: "",
  dbUser: "",
  dbPassword: "",
  dbEnvironment: "production",
  dbRefreshIntervalMs: "2000",
  extra: {},
};

export function parseRgProps(text: string): RgPropsConfig {
  const p = parseProperties(text);
  const {
    "resource-groups.configuration-manager": mode,
    "resource-groups.config-file": cf,
    "resource-groups.config-db-url": dbUrl,
    "resource-groups.config-db-user": dbUser,
    "resource-groups.config-db-password": dbPw,
    "resource-groups.config-db-environment": dbEnv,
    "resource-groups.config-db-refresh-interval": dbRi,
    ...rest
  } = p;
  return {
    mode: (mode as RgManagerMode) ?? "file",
    configFile: cf ?? "/etc/trino/resource-groups.json",
    dbUrl: dbUrl ?? "",
    dbUser: dbUser ?? "",
    dbPassword: dbPw ?? "",
    dbEnvironment: dbEnv ?? "production",
    dbRefreshIntervalMs: dbRi ?? "2000",
    extra: rest,
  };
}

export function serializeRgProps(cfg: RgPropsConfig): string {
  const props: Record<string, string> = {
    "resource-groups.configuration-manager": cfg.mode,
  };
  if (cfg.mode === "file") {
    if (cfg.configFile) props["resource-groups.config-file"] = cfg.configFile;
  }
  if (cfg.mode === "db") {
    if (cfg.dbUrl) props["resource-groups.config-db-url"] = cfg.dbUrl;
    if (cfg.dbUser) props["resource-groups.config-db-user"] = cfg.dbUser;
    if (cfg.dbPassword) props["resource-groups.config-db-password"] = cfg.dbPassword;
    if (cfg.dbEnvironment) props["resource-groups.config-db-environment"] = cfg.dbEnvironment;
    if (cfg.dbRefreshIntervalMs) props["resource-groups.config-db-refresh-interval"] = cfg.dbRefreshIntervalMs;
  }
  Object.assign(props, cfg.extra);
  return serializeProperties(props, "Trino resource-groups configuration — managed by NİZAM");
}

// ─── group-provider.properties ───────────────────────────────────────────────

export type GpProviderName = "file" | "ldap";

export type GpPropsConfig = {
  name: GpProviderName;
  /** FILE mode */
  groupFile: string;
  fileRefreshPeriod: string;
  /** LDAP mode */
  ldapUrl: string;
  ldapUserBaseDn: string;
  ldapGroupBaseDn: string;
  ldapGroupNameAttribute: string;
  ldapGroupMemberAttribute: string;
  ldapUserMemberAttribute: string;
  ldapCacheTtl: string;
  /** Extra raw key=value pairs. */
  extra: Record<string, string>;
};

export const DEFAULT_GP_PROPS: GpPropsConfig = {
  name: "file",
  groupFile: "/etc/trino/group-provider.txt",
  fileRefreshPeriod: "30s",
  ldapUrl: "",
  ldapUserBaseDn: "",
  ldapGroupBaseDn: "",
  ldapGroupNameAttribute: "cn",
  ldapGroupMemberAttribute: "member",
  ldapUserMemberAttribute: "uid",
  ldapCacheTtl: "1h",
  extra: {},
};

export function parseGpProps(text: string): GpPropsConfig {
  const p = parseProperties(text);
  const {
    "group-provider.name": name,
    "file.group-file": gf, "file.refresh-period": rp,
    "ldap.url": lu, "ldap.user-base-dn": ubd, "ldap.group-base-dn": gbd,
    "ldap.group-name-attribute": gna, "ldap.group-member-attribute": gma,
    "ldap.user-member-attribute": uma, "ldap.cache-ttl": cttl,
    ...rest
  } = p;
  return {
    name: (name as GpProviderName) ?? "file",
    groupFile: gf ?? "/etc/trino/group-provider.txt",
    fileRefreshPeriod: rp ?? "30s",
    ldapUrl: lu ?? "",
    ldapUserBaseDn: ubd ?? "",
    ldapGroupBaseDn: gbd ?? "",
    ldapGroupNameAttribute: gna ?? "cn",
    ldapGroupMemberAttribute: gma ?? "member",
    ldapUserMemberAttribute: uma ?? "uid",
    ldapCacheTtl: cttl ?? "1h",
    extra: rest,
  };
}

export function serializeGpProps(cfg: GpPropsConfig): string {
  const props: Record<string, string> = { "group-provider.name": cfg.name };
  if (cfg.name === "file") {
    if (cfg.groupFile) props["file.group-file"] = cfg.groupFile;
    if (cfg.fileRefreshPeriod) props["file.refresh-period"] = cfg.fileRefreshPeriod;
  }
  if (cfg.name === "ldap") {
    if (cfg.ldapUrl) props["ldap.url"] = cfg.ldapUrl;
    if (cfg.ldapUserBaseDn) props["ldap.user-base-dn"] = cfg.ldapUserBaseDn;
    if (cfg.ldapGroupBaseDn) props["ldap.group-base-dn"] = cfg.ldapGroupBaseDn;
    if (cfg.ldapGroupNameAttribute) props["ldap.group-name-attribute"] = cfg.ldapGroupNameAttribute;
    if (cfg.ldapGroupMemberAttribute) props["ldap.group-member-attribute"] = cfg.ldapGroupMemberAttribute;
    if (cfg.ldapUserMemberAttribute) props["ldap.user-member-attribute"] = cfg.ldapUserMemberAttribute;
    if (cfg.ldapCacheTtl) props["ldap.cache-ttl"] = cfg.ldapCacheTtl;
  }
  Object.assign(props, cfg.extra);
  return serializeProperties(props, "Trino group-provider configuration — managed by NİZAM");
}
