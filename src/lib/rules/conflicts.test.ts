import { describe, it, expect } from "vitest";
import type { RulesDocument } from "./schema";
import { detectConflicts, describeScope } from "./conflicts";

describe("detectConflicts", () => {
  it("flags a later rule with an identical scope as a duplicate shadow", () => {
    const doc = {
      tables: [
        { group: "a", privileges: ["SELECT"] },
        { group: "a", privileges: ["INSERT"] },
      ],
    } as RulesDocument;
    const issues = detectConflicts(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ section: "tables", index: 1, shadowedBy: 0, kind: "duplicate-scope" });
  });

  it("flags rules that follow a catch-all rule as unreachable", () => {
    const doc = {
      tables: [
        { privileges: ["SELECT"] }, // no matchers => catch-all
        { group: "a", privileges: ["INSERT"] },
      ],
    } as RulesDocument;
    const issues = detectConflicts(doc);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ index: 1, shadowedBy: 0, kind: "catch-all" });
  });

  it("treats wildcard patterns (.*) as catch-all", () => {
    const doc = {
      catalogs: [
        { user: ".*", catalog: ".*", allow: "all" },
        { user: "admin", catalog: "prod", allow: "all" },
      ],
    } as RulesDocument;
    expect(detectConflicts(doc)[0]).toMatchObject({ kind: "catch-all", index: 1 });
  });

  it("reports nothing for distinct, reachable rules", () => {
    const doc = {
      tables: [
        { group: "a", privileges: ["SELECT"] },
        { group: "b", privileges: ["SELECT"] },
      ],
    } as RulesDocument;
    expect(detectConflicts(doc)).toEqual([]);
  });
});

describe("describeScope", () => {
  it("summarizes matcher fields and calls a no-matcher rule a catch-all", () => {
    expect(describeScope({ group: "analysts", catalog: "prod", privileges: ["SELECT"] })).toBe(
      "catalog=prod, group=analysts",
    );
    expect(describeScope({ privileges: ["SELECT"] })).toBe("herkes / her şey");
  });
});
