import { prisma } from "@/lib/db";
import { saveArtifactContent } from "@/lib/config-artifact";
import { toCatalogProperties, parseCatalogProperties } from "./connectors";

/**
 * Catalog `.properties` versioning (requirement 4.1). Each catalog is snapshotted
 * as its own ConfigVersion (type CATALOG_PROPERTIES, name "<catalog>.properties")
 * on every change, so catalog configs gain history + rollback like the other
 * config files. Secrets live in the property values exactly as Trino reads them.
 */

export const CATALOG_TYPE = "CATALOG_PROPERTIES" as const;

export function catalogArtifactName(catalogName: string): string {
  return `${catalogName}.properties`;
}

/** Snapshot one catalog's rendered `.properties` as a new version. */
export async function snapshotCatalog(
  environmentId: string,
  name: string,
  connector: string,
  properties: Record<string, string>,
): Promise<number> {
  const content = toCatalogProperties(connector, properties);
  // audit=false: the calling action already records a richer entity-level audit.
  return saveArtifactContent(
    environmentId,
    CATALOG_TYPE,
    catalogArtifactName(name),
    content,
    undefined,
    "UPDATE",
    false,
  );
}

/** Re-materialize a catalog row from a stored `.properties` snapshot (rollback). */
export async function restoreCatalog(environmentId: string, name: string, content: string): Promise<void> {
  const { connector, properties } = parseCatalogProperties(content);
  if (!connector) return;
  await prisma.catalogConfig.upsert({
    where: { environmentId_name: { environmentId, name } },
    create: { environmentId, name, connector, properties },
    update: { connector, properties },
  });
}
