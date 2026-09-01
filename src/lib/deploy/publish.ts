import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ConfigArtifactType } from "@/generated/prisma/enums";

/**
 * File delivery of a managed config to the path Trino reads (requirement 5.1 Mode
 * B + 4.3 re-deploy on rollback). The environment's `configTarget` is the rules.json
 * path; sibling files live in the same directory by Trino convention.
 */

export type PublishEnv = {
  deliveryMode: "HTTP" | "FILE";
  configTarget: string;
};

/** Compute the on-disk destination for an artifact, relative to `configTarget`. */
export function destinationFor(configTarget: string, type: ConfigArtifactType, name: string): string {
  const dir = dirname(configTarget);
  switch (type) {
    case "RULES_JSON":
      return configTarget;
    case "RESOURCE_GROUPS_JSON":
      return join(dir, "resource-groups.json");
    case "GROUP_PROVIDER":
      return join(dir, "group-provider.txt");
    case "PASSWORD_DB":
      return join(dir, "password.db");
    case "ACCESS_CONTROL_PROPERTIES":
      return join(dir, "access-control.properties");
    case "AUTH_PROPERTIES":
      return join(dir, "password-authenticator.properties");
    case "RESOURCE_GROUPS_PROPERTIES":
      return join(dir, "resource-groups.properties");
    case "GROUP_PROVIDER_PROPERTIES":
      return join(dir, "group-provider.properties");
    case "CATALOG_PROPERTIES":
      return join(dir, "catalog", name.endsWith(".properties") ? name : `${name}.properties`);
    default:
      return join(dir, name);
  }
}

export type RedeployResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Re-deploy a single artifact's content to the cluster. HTTP mode auto-serves
 * rules.json (Trino re-polls the endpoint); everything else is written to its
 * file destination so the change reaches the nodes.
 */
export async function redeployArtifact(
  env: PublishEnv,
  type: ConfigArtifactType,
  name: string,
  content: string,
): Promise<RedeployResult> {
  if (env.deliveryMode === "HTTP" && type === "RULES_JSON") {
    return { ok: true, message: "HTTP modu: Trino, yayınlanan sürümü endpoint'ten otomatik çeker." };
  }
  const dest = destinationFor(env.configTarget, type, name);
  try {
    await writeFile(dest, content, "utf8");
    return { ok: true, message: `Dosya yazıldı: ${dest}` };
  } catch {
    return { ok: false, error: `Dosyaya yazılamadı: ${dest}` };
  }
}
