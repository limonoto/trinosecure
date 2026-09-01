"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit, getSessionActor } from "@/lib/audit";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureConfigWrite } from "@/lib/authz";
import { catalogConfigSchema } from "@/lib/validation";
import { toCatalogProperties, getConnector } from "@/lib/catalogs/connectors";
import { bootCheckCatalog } from "@/lib/catalogs/boot-check";
import { snapshotCatalog } from "@/lib/catalogs/service";
import { formString } from "@/lib/form";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ExportResult = { ok: true; content: string; name: string } | { ok: false; error: string };

function parseInput(formData: FormData) {
  let properties: Record<string, string> = {};
  try {
    const raw = JSON.parse(formString(formData.get("properties")) || "{}");
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string" && k.trim() !== "") properties[k.trim()] = v;
      }
    }
  } catch {
    properties = {};
  }
  return catalogConfigSchema.safeParse({
    name: formData.get("name"),
    connector: formData.get("connector"),
    properties,
  });
}

export async function createCatalog(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam oluşturun/seçin." };
  const denied = await ensureConfigWrite("CATALOG_PROPERTIES", env.id);
  if (denied) return denied;
  const parsed = parseInput(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  if (!getConnector(parsed.data.connector)) return { ok: false, error: "Bilinmeyen connector." };
  const bootCreate = bootCheckCatalog(parsed.data.connector, parsed.data.properties);
  if (!bootCreate.ready) return { ok: false, error: bootCreate.errors[0] ?? "Katalog geçersiz." };

  try {
    const catalog = await prisma.catalogConfig.create({
      data: {
        environmentId: env.id,
        name: parsed.data.name,
        connector: parsed.data.connector,
        properties: parsed.data.properties,
      },
    });
    const actor = await getSessionActor();
    await recordAudit({
      action: "CREATE",
      entityType: "CatalogConfig",
      entityId: catalog.id,
      environmentId: env.id,
      actorUsername: actor.username, actorEmail: actor.email,
      after: { name: catalog.name, connector: catalog.connector },
    });
    await snapshotCatalog(env.id, catalog.name, catalog.connector, parsed.data.properties); // version (4.1)
    revalidatePath("/catalogs");
    return { ok: true };
  } catch {
    return { ok: false, error: "Kaydedilemedi — bu adda bir katalog olabilir." };
  }
}

export async function updateCatalog(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureConfigWrite("CATALOG_PROPERTIES", env.id);
  if (denied) return denied;
  const id = formString(formData.get("id"));
  const before = await prisma.catalogConfig.findUnique({ where: { id } });
  if (!before || before.environmentId !== env.id) return { ok: false, error: "Katalog bulunamadı" };
  const parsed = parseInput(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş" };
  const bootUpdate = bootCheckCatalog(parsed.data.connector, parsed.data.properties);
  if (!bootUpdate.ready) return { ok: false, error: bootUpdate.errors[0] ?? "Katalog geçersiz." };

  try {
    const catalog = await prisma.catalogConfig.update({
      where: { id },
      data: {
        name: parsed.data.name,
        connector: parsed.data.connector,
        properties: parsed.data.properties,
      },
    });
    const actor = await getSessionActor();
    await recordAudit({
      action: "UPDATE",
      entityType: "CatalogConfig",
      entityId: id,
      environmentId: env.id,
      actorUsername: actor.username, actorEmail: actor.email,
      before: { name: before.name, connector: before.connector },
      after: { name: catalog.name, connector: catalog.connector },
    });
    await snapshotCatalog(env.id, catalog.name, catalog.connector, parsed.data.properties); // version (4.1)
    revalidatePath("/catalogs");
    return { ok: true };
  } catch {
    return { ok: false, error: "Güncellenemedi — bu adda bir katalog olabilir." };
  }
}

export async function deleteCatalog(id: string): Promise<ActionResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const denied = await ensureConfigWrite("CATALOG_PROPERTIES", env.id);
  if (denied) return denied;
  const before = await prisma.catalogConfig.findUnique({ where: { id } });
  if (!before || before.environmentId !== env.id) return { ok: false, error: "Katalog bulunamadı" };
  await prisma.catalogConfig.delete({ where: { id } });
  const actor = await getSessionActor();
  await recordAudit({
    action: "DELETE",
    entityType: "CatalogConfig",
    entityId: id,
    environmentId: env.id,
    actorUsername: actor.username, actorEmail: actor.email,
    before: { name: before.name },
  });
  revalidatePath("/catalogs");
  return { ok: true };
}

/** Build the `<name>.properties` file for a catalog. */
export async function exportCatalog(id: string): Promise<ExportResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Ortam yok" };
  const catalog = await prisma.catalogConfig.findUnique({ where: { id } });
  if (!catalog || catalog.environmentId !== env.id) return { ok: false, error: "Katalog bulunamadı" };
  const props = (catalog.properties as Record<string, string>) ?? {};
  return { ok: true, content: toCatalogProperties(catalog.connector, props), name: catalog.name };
}
