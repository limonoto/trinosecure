import { describe, it, expect } from "vitest";
import { toEditorDoc, toDocument, moveItem } from "@/app/(app)/rules/rule-types";
import type { RulesDocument } from "@/lib/rules/schema";

describe("toEditorDoc / toDocument", () => {
  it("round-trips a multi-section document (columns preserved)", () => {
    const doc: RulesDocument = {
      catalogs: [{ group: "a", allow: "all" }],
      schemas: [],
      tables: [{ privileges: ["SELECT"], columns: [{ name: "ssn", mask: "'***'" }] }],
      functions: [{ privileges: ["EXECUTE"] }],
    };
    expect(toDocument(toEditorDoc(doc))).toEqual(doc);
  });

  it("preserves intentional empty arrays (deny-all) but drops absent sections", () => {
    const back = toDocument(toEditorDoc({ catalogs: [], schemas: [], tables: [] })) as Record<string, unknown>;
    expect(back.catalogs).toEqual([]);
    expect(back.functions).toBeUndefined();
  });

  it("strips client keys and preserves unknown sections verbatim", () => {
    const doc = { tables: [{ privileges: ["SELECT"] }], group_provider: { kind: "file" } } as unknown as RulesDocument;
    const back = toDocument(toEditorDoc(doc)) as Record<string, unknown>;
    expect(back.group_provider).toEqual({ kind: "file" });
    const tables = back.tables as Array<Record<string, unknown>>;
    expect(tables.every((row) => !("__key" in row))).toBe(true);
  });
});

describe("moveItem", () => {
  it("moves an element to a new index immutably", () => {
    const source = [1, 2, 3, 4];
    expect(moveItem(source, 0, 2)).toEqual([2, 3, 1, 4]);
    expect(source).toEqual([1, 2, 3, 4]);
  });
});
