"use server";

import { revalidatePath } from "next/cache";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureRole } from "@/lib/authz";
import { parseRulesJson } from "@/lib/rules/rules";
import { saveRulesContent } from "@/lib/rules/service";

export type ImportResult = { ok: true; version: number } | { ok: false; error: string };

export async function importRules(content: string): Promise<ImportResult> {
  const env = await getActiveEnvironment();
  if (!env) return { ok: false, error: "Önce bir ortam seçin/oluşturun." };
  const denied = await ensureRole("CONFIG_EDITOR", env.id);
  if (denied) return denied;

  const parsed = parseRulesJson(content);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const version = await saveRulesContent(env.id, content, "İçe aktarıldı", "IMPORT");
  revalidatePath("/rules");
  revalidatePath("/history");
  return { ok: true, version };
}
