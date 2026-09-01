/**
 * Authorization stub — RBAC is disabled until a login strategy is decided.
 * Every check passes as PLATFORM_ADMIN; swap with the real implementation
 * (see git history) when authentication is introduced.
 */

import type { ConfigArtifactType } from "@/generated/prisma/enums";
import type { AppRole } from "@/lib/rbac";

export type Denied = { ok: false; error: string };
export type Access = {
  role: AppRole;
  scopeConfigTypes: ConfigArtifactType[] | null;
  scopeResourceGroups: string[] | null;
  bootstrap: boolean;
};

const OPEN_ACCESS: Access = {
  role: "PLATFORM_ADMIN",
  scopeConfigTypes: null,
  scopeResourceGroups: null,
  bootstrap: true,
};

export async function getAccess(_environmentId?: string): Promise<Access> {
  return OPEN_ACCESS;
}

export async function getEffectiveRole(_environmentId?: string): Promise<AppRole> {
  return "PLATFORM_ADMIN";
}

export async function getSessionIdentity() {
  return { username: "system", email: null, roles: [] as AppRole[] };
}

/** Always passes — auth is disabled. */
export async function ensureRole(_min: AppRole, _environmentId?: string): Promise<Denied | null> {
  return null;
}

export async function ensureConfigWrite(
  _configType: ConfigArtifactType,
  _environmentId?: string,
): Promise<Denied | null> {
  return null;
}

export async function ensureResourceGroupWrite(
  _resourceGroup: string,
  _environmentId?: string,
): Promise<Denied | null> {
  return null;
}
