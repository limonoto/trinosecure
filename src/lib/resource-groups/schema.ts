import { z } from "zod";

/**
 * Zod schema for Trino's `resource-groups.json` — requirement 2.1. Resource
 * groups are hierarchical (rootGroups → subGroups), each with soft/hard limits;
 * selectors route queries to a group. Unmodeled keys survive via looseObject.
 */

export const resourceGroupSchema = z.looseObject({
  name: z.string(),
  softMemoryLimit: z.union([z.string(), z.number()]).optional(),
  hardConcurrencyLimit: z.number().optional(),
  softConcurrencyLimit: z.number().optional(),
  maxQueued: z.number().optional(),
  schedulingPolicy: z.string().optional(),
  schedulingWeight: z.number().optional(),
  jmxExport: z.boolean().optional(),
  get subGroups() {
    return z.array(resourceGroupSchema).optional();
  },
});

export const selectorSchema = z.looseObject({
  user: z.string().optional(),
  source: z.string().optional(),
  group: z.string().optional(),
  clientTags: z.array(z.string()).optional(),
});

export const resourceGroupsDocSchema = z.looseObject({
  rootGroups: z.array(resourceGroupSchema).optional(),
  selectors: z.array(selectorSchema).optional(),
  cpuQuotaPeriod: z.string().optional(),
});

export type ResourceGroup = z.infer<typeof resourceGroupSchema>;
export type Selector = z.infer<typeof selectorSchema>;
export type ResourceGroupsDoc = z.infer<typeof resourceGroupsDocSchema>;

export const EMPTY_RESOURCE_GROUPS: ResourceGroupsDoc = { rootGroups: [], selectors: [] };

export type ParseResult =
  | { ok: true; doc: ResourceGroupsDoc }
  | { ok: false; error: string };

export function parseResourceGroups(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Geçersiz JSON" };
  }
  const result = resourceGroupsDocSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    return { ok: false, error: `Geçersiz yapı${path ? ` (${path})` : ""}: ${issue?.message ?? ""}` };
  }
  return { ok: true, doc: result.data };
}

export function serializeResourceGroups(doc: ResourceGroupsDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
