/**
 * Role-based access control primitives (requirement 3.1 / 3.2).
 *
 * This module is intentionally dependency-free (no Prisma client, no Node-only
 * APIs) so it can be imported from edge middleware and `src/auth.ts`. The values
 * mirror the Prisma `AppRole` enum; the DB-backed per-environment scoping and
 * enforcement land in Phase 3.
 */

export const APP_ROLES = ["VIEWER", "CONFIG_EDITOR", "PLATFORM_ADMIN"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Higher number = more privilege. Used for "at least" comparisons. */
const ROLE_RANK: Record<AppRole, number> = {
  VIEWER: 1,
  CONFIG_EDITOR: 2,
  PLATFORM_ADMIN: 3,
};

/** Maps Keycloak realm-role names (any common spelling) onto an AppRole. */
const KEYCLOAK_ROLE_MAP: Record<string, AppRole> = {
  "platform-admin": "PLATFORM_ADMIN",
  platform_admin: "PLATFORM_ADMIN",
  "nizam-admin": "PLATFORM_ADMIN",
  admin: "PLATFORM_ADMIN",
  "config-editor": "CONFIG_EDITOR",
  config_editor: "CONFIG_EDITOR",
  editor: "CONFIG_EDITOR",
  viewer: "VIEWER",
  "nizam-viewer": "VIEWER",
};

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/** Translate raw Keycloak role strings into the app's roles (deduped). */
export function mapKeycloakRoles(roles: readonly string[]): AppRole[] {
  const mapped = new Set<AppRole>();
  for (const raw of roles) {
    const key = raw.toLowerCase();
    if (KEYCLOAK_ROLE_MAP[key]) mapped.add(KEYCLOAK_ROLE_MAP[key]);
    else if (isAppRole(raw)) mapped.add(raw);
  }
  return [...mapped];
}

/** The most privileged role in the set, or VIEWER when empty. */
export function highestRole(roles: readonly AppRole[]): AppRole {
  return roles.reduce<AppRole>(
    (best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best),
    "VIEWER",
  );
}

/** True when `roles` includes a role at least as privileged as `min`. */
export function roleAtLeast(roles: readonly AppRole[], min: AppRole): boolean {
  return roles.some((r) => ROLE_RANK[r] >= ROLE_RANK[min]);
}

/**
 * Decode the `realm_access.roles` claim from a Keycloak access token without any
 * Node-only API (edge-safe). Returns [] on any malformed input.
 */
export function extractKeycloakRealmRoles(accessToken: string): string[] {
  const parts = accessToken.split(".");
  if (parts.length < 2) return [];
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const bytes = Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      realm_access?: { roles?: unknown };
    };
    const roles = payload.realm_access?.roles;
    return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
}
