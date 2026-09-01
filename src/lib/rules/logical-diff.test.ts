import { describe, it, expect } from "vitest";
import type { RulesDocument } from "./schema";
import { logicalDiff } from "./logical-diff";

describe("logicalDiff", () => {
  it("reports an outcome change for a same-scope rule (privileges)", () => {
    const before = { tables: [{ group: "a", privileges: ["SELECT"] }] } as RulesDocument;
    const after = { tables: [{ group: "a", privileges: ["SELECT", "INSERT"] }] } as RulesDocument;
    const changes = logicalDiff(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("modified");
    expect(changes[0].scope).toBe("group=a");
    expect(changes[0].details[0]).toContain("privileges");
    expect(changes[0].details[0]).toContain("INSERT");
  });

  it("detects an owner flip on a schema rule", () => {
    const before = { schemas: [{ schema: "s", owner: false }] } as RulesDocument;
    const after = { schemas: [{ schema: "s", owner: true }] } as RulesDocument;
    const changes = logicalDiff(before, after);
    expect(changes[0]).toMatchObject({ kind: "modified", section: "schemas" });
    expect(changes[0].details[0]).toContain("owner: false → true");
  });

  it("reports added and removed rules", () => {
    const empty = {} as RulesDocument;
    const one = { tables: [{ group: "a", privileges: ["SELECT"] }] } as RulesDocument;
    expect(logicalDiff(empty, one)[0]).toMatchObject({ kind: "added" });
    expect(logicalDiff(one, empty)[0]).toMatchObject({ kind: "removed" });
  });

  it("returns nothing when documents are semantically equal", () => {
    const doc = { tables: [{ group: "a", privileges: ["SELECT"] }] } as RulesDocument;
    expect(logicalDiff(doc, structuredClone(doc))).toEqual([]);
  });
});
