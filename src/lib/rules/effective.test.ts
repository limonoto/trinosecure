import { describe, it, expect } from "vitest";
import type { RulesDocument } from "./schema";
import {
  fullMatch,
  evaluateTableAccess,
  evaluateCatalogAccess,
  evaluateAllTablePrivileges,
} from "./effective";

describe("fullMatch", () => {
  it("anchors patterns (full match, not substring)", () => {
    expect(fullMatch("ana", "analytics")).toBe(false);
    expect(fullMatch("ana.*", "analytics")).toBe(true);
    expect(fullMatch("analytics", "analytics")).toBe(true);
  });

  it("treats an absent pattern as match-any", () => {
    expect(fullMatch(undefined, "anything")).toBe(true);
  });

  it("never matches on an invalid regex", () => {
    expect(fullMatch("(", "x")).toBe(false);
  });
});

describe("evaluateTableAccess", () => {
  const doc = {
    tables: [
      { group: "analysts", catalog: "prod", privileges: ["SELECT"] },
    ],
  } as RulesDocument;

  it("allows a privilege listed in the first matching rule", () => {
    const r = evaluateTableAccess(
      doc,
      { user: "u", groups: ["analysts"] },
      { catalog: "prod", schema: "s", table: "t", privilege: "SELECT" },
    );
    expect(r).toMatchObject({ allowed: true, matchedIndex: 0, reason: "matched-allow" });
  });

  it("denies a privilege absent from the matched rule (no fall-through)", () => {
    const r = evaluateTableAccess(
      doc,
      { user: "u", groups: ["analysts"] },
      { catalog: "prod", schema: "s", table: "t", privilege: "INSERT" },
    );
    expect(r).toMatchObject({ allowed: false, reason: "matched-deny" });
  });

  it("denies by default when nothing matches", () => {
    const r = evaluateTableAccess(
      doc,
      { user: "u", groups: ["other"] },
      { catalog: "prod", schema: "s", table: "t", privilege: "SELECT" },
    );
    expect(r).toMatchObject({ allowed: false, matchedIndex: -1, reason: "no-match" });
  });

  it("respects first-match-wins (an earlier broad deny shadows a later grant)", () => {
    const shadowed = {
      tables: [
        { user: ".*", catalog: "prod", privileges: [] },
        { group: "analysts", privileges: ["SELECT"] },
      ],
    } as RulesDocument;
    const r = evaluateTableAccess(
      shadowed,
      { user: "u", groups: ["analysts"] },
      { catalog: "prod", schema: "s", table: "t", privilege: "SELECT" },
    );
    expect(r).toMatchObject({ allowed: false, matchedIndex: 0, reason: "matched-deny" });
  });
});

describe("evaluateCatalogAccess", () => {
  it("defaults to 'all' when the catalogs key is absent", () => {
    expect(evaluateCatalogAccess({} as RulesDocument, { user: "u" }, { catalog: "x" }).access).toBe("all");
  });

  it("denies ('none') when a present catalogs list has no matching rule", () => {
    expect(
      evaluateCatalogAccess({ catalogs: [] } as RulesDocument, { user: "u" }, { catalog: "x" }).access,
    ).toBe("none");
  });

  it("returns the matched rule's access and 'none' when rules exist but none match", () => {
    const doc = { catalogs: [{ user: "admin", catalog: ".*", allow: "all" }] } as RulesDocument;
    expect(evaluateCatalogAccess(doc, { user: "admin" }, { catalog: "x" }).access).toBe("all");
    expect(evaluateCatalogAccess(doc, { user: "guest" }, { catalog: "x" }).access).toBe("none");
  });
});

describe("evaluateAllTablePrivileges", () => {
  it("evaluates every privilege at a location at once", () => {
    const doc = { tables: [{ group: "a", privileges: ["SELECT", "UPDATE"] }] } as RulesDocument;
    const result = evaluateAllTablePrivileges(
      doc,
      { user: "u", groups: ["a"] },
      { catalog: "c", schema: "s", table: "t" },
    );
    expect(result.SELECT.allowed).toBe(true);
    expect(result.UPDATE.allowed).toBe(true);
    expect(result.DELETE.allowed).toBe(false);
  });
});
