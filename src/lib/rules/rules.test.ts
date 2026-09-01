import { describe, it, expect } from "vitest";
import {
  EMPTY_RULES,
  parseRulesJson,
  serializeRulesJson,
  isValidRegex,
  validateRulesDocument,
  ruleCounts,
} from "@/lib/rules/rules";

describe("parseRulesJson", () => {
  it("parses a valid document", () => {
    const result = parseRulesJson(
      JSON.stringify({ tables: [{ group: "analysts", privileges: ["SELECT"] }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.tables?.[0].group).toBe("analysts");
  });
  it("rejects invalid JSON", () => {
    expect(parseRulesJson("{not json").ok).toBe(false);
  });
  it("rejects an unknown privilege", () => {
    expect(parseRulesJson(JSON.stringify({ tables: [{ privileges: ["WRITE"] }] })).ok).toBe(false);
  });
  it("rejects a non-boolean schema owner", () => {
    expect(parseRulesJson(JSON.stringify({ schemas: [{ owner: "yes" }] })).ok).toBe(false);
  });
  it("preserves unknown top-level sections (passthrough)", () => {
    const result = parseRulesJson(
      JSON.stringify({ tables: [], queries: [{ allow: ["execute"] }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.doc as Record<string, unknown>).queries).toBeDefined();
  });
});

describe("serializeRulesJson", () => {
  it("round-trips through parse", () => {
    const parsed = parseRulesJson(
      JSON.stringify({ catalogs: [{ group: "admins", allow: "all" }], tables: [] }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const text = serializeRulesJson(parsed.doc);
      expect(parseRulesJson(text).ok).toBe(true);
    }
  });
});

describe("isValidRegex", () => {
  it("accepts valid patterns", () => {
    expect(isValidRegex(".*")).toBe(true);
    expect(isValidRegex("team_(.*)")).toBe(true);
  });
  it("rejects invalid patterns", () => {
    expect(isValidRegex("[a-z")).toBe(false);
  });
});

describe("validateRulesDocument", () => {
  it("flags an invalid regex as an error", () => {
    const parsed = parseRulesJson(
      JSON.stringify({ tables: [{ table: "[a-z", privileges: ["SELECT"] }] }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(validateRulesDocument(parsed.doc).some((i) => i.severity === "error")).toBe(true);
    }
  });
  it("warns on deny-all empty arrays", () => {
    expect(validateRulesDocument({ tables: [] }).some((i) => i.severity === "warning")).toBe(true);
  });
  it("is clean for a valid document", () => {
    const parsed = parseRulesJson(
      JSON.stringify({ tables: [{ group: "analysts", privileges: ["SELECT"] }] }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(validateRulesDocument(parsed.doc)).toHaveLength(0);
  });
});

describe("rulesDocumentSchema — all sections", () => {
  it("accepts every modeled section", () => {
    const doc = {
      catalogs: [{ group: "a", allow: "all" }],
      schemas: [{ catalog: "c", owner: true }],
      tables: [{ privileges: ["SELECT"], columns: [{ name: "ssn", mask: "'***'" }] }],
      functions: [{ privileges: ["EXECUTE"] }],
      procedures: [{ privileges: ["EXECUTE"] }],
      queries: [{ allow: ["execute", "view"] }],
      impersonation: [{ new_user: "svc_$1" }],
      authorization: [{ new_user: "owner" }],
      system_information: [{ allow: ["read"] }],
      system_session_properties: [{ property: "p", allow: true }],
      catalog_session_properties: [{ catalog: "c", property: "p", allow: false }],
    };
    expect(parseRulesJson(JSON.stringify(doc)).ok).toBe(true);
  });
  it("requires new_user on impersonation rules", () => {
    expect(parseRulesJson(JSON.stringify({ impersonation: [{ original_user: "a" }] })).ok).toBe(false);
  });
  it("requires allow on system_session_properties rules", () => {
    expect(parseRulesJson(JSON.stringify({ system_session_properties: [{ property: "p" }] })).ok).toBe(false);
  });
  it("rejects an unknown query access verb", () => {
    expect(parseRulesJson(JSON.stringify({ queries: [{ allow: ["destroy"] }] })).ok).toBe(false);
  });
});

describe("validateRulesDocument — all sections", () => {
  it("flags an invalid regex in new_user", () => {
    expect(validateRulesDocument({ impersonation: [{ new_user: "[a-z" }] }).some((i) => i.severity === "error")).toBe(
      true,
    );
  });
  it("warns deny-all on additional sections", () => {
    const warnings = validateRulesDocument({ functions: [], queries: [], system_information: [] }).filter(
      (i) => i.severity === "warning",
    );
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ruleCounts", () => {
  it("counts each section", () => {
    const parsed = parseRulesJson(
      JSON.stringify({ catalogs: [{ allow: "all" }], tables: [] }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(ruleCounts(parsed.doc)).toEqual({ catalogs: 1, schemas: 0, tables: 0 });
  });
  it("handles the empty document", () => {
    expect(ruleCounts(EMPTY_RULES)).toEqual({ catalogs: 0, schemas: 0, tables: 0 });
  });
});
