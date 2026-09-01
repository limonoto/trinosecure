"use server";

import { revalidatePath } from "next/cache";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureConfigWrite } from "@/lib/authz";
import { getActiveArtifactContent, saveArtifactContent } from "@/lib/config-artifact";
import {
  parseAccessControl, serializeAccessControl, DEFAULT_ACCESS_CONTROL,
  parseAuth, serializeAuth, DEFAULT_AUTH,
  parseRgProps, serializeRgProps, DEFAULT_RG_PROPS,
  parseGpProps, serializeGpProps, DEFAULT_GP_PROPS,
} from "@/lib/properties/configs";

export type SaveResult = { ok: true; version: number } | { ok: false; error: string };

// ─── Loaders ─────────────────────────────────────────────────────────────────

export async function getPropertiesContent(environmentId: string) {
  const [ac, auth, rg, gp] = await Promise.all([
    getActiveArtifactContent(environmentId, "ACCESS_CONTROL_PROPERTIES", "access-control.properties"),
    getActiveArtifactContent(environmentId, "AUTH_PROPERTIES", "password-authenticator.properties"),
    getActiveArtifactContent(environmentId, "RESOURCE_GROUPS_PROPERTIES", "resource-groups.properties"),
    getActiveArtifactContent(environmentId, "GROUP_PROVIDER_PROPERTIES", "group-provider.properties"),
  ]);
  return {
    accessControl: ac ?? serializeAccessControl(DEFAULT_ACCESS_CONTROL),
    auth: auth ?? serializeAuth(DEFAULT_AUTH),
    resourceGroupsProps: rg ?? serializeRgProps(DEFAULT_RG_PROPS),
    groupProviderProps: gp ?? serializeGpProps(DEFAULT_GP_PROPS),
  };
}

// ─── Savers ──────────────────────────────────────────────────────────────────

export async function saveAccessControl(content: string): Promise<SaveResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin." };
  const denied = await ensureConfigWrite("ACCESS_CONTROL_PROPERTIES", env.id);
  if (denied) return denied;
  try {
    parseAccessControl(content); // validate parseable
  } catch {
    return { ok: false, error: "Geçersiz .properties formatı" };
  }
  const version = await saveArtifactContent(env.id, "ACCESS_CONTROL_PROPERTIES", "access-control.properties", content);
  revalidatePath("/properties");
  return { ok: true, version };
}

export async function saveAuth(content: string): Promise<SaveResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin." };
  const denied = await ensureConfigWrite("AUTH_PROPERTIES", env.id);
  if (denied) return denied;
  try {
    parseAuth(content);
  } catch {
    return { ok: false, error: "Geçersiz .properties formatı" };
  }
  const version = await saveArtifactContent(env.id, "AUTH_PROPERTIES", "password-authenticator.properties", content);
  revalidatePath("/properties");
  return { ok: true, version };
}

export async function saveResourceGroupsProps(content: string): Promise<SaveResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin." };
  const denied = await ensureConfigWrite("RESOURCE_GROUPS_PROPERTIES", env.id);
  if (denied) return denied;
  try {
    parseRgProps(content);
  } catch {
    return { ok: false, error: "Geçersiz .properties formatı" };
  }
  const version = await saveArtifactContent(env.id, "RESOURCE_GROUPS_PROPERTIES", "resource-groups.properties", content);
  revalidatePath("/properties");
  return { ok: true, version };
}

export async function saveGroupProviderProps(content: string): Promise<SaveResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin." };
  const denied = await ensureConfigWrite("GROUP_PROVIDER_PROPERTIES", env.id);
  if (denied) return denied;
  try {
    parseGpProps(content);
  } catch {
    return { ok: false, error: "Geçersiz .properties formatı" };
  }
  const version = await saveArtifactContent(env.id, "GROUP_PROVIDER_PROPERTIES", "group-provider.properties", content);
  revalidatePath("/properties");
  return { ok: true, version };
}
