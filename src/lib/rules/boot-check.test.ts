import { describe, it, expect } from "vitest";
import { bootCheck } from "./boot-check";

describe("bootCheck", () => {
  it("is not ready on invalid JSON", () => {
    const r = bootCheck("{ not json");
    expect(r.ready).toBe(false);
    expect(r.errors).toHaveLength(1);
  });

  it("is not ready when a rule has an uncompilable regex", () => {
    const r = bootCheck(JSON.stringify({ tables: [{ table: "(", privileges: ["SELECT"] }] }));
    expect(r.ready).toBe(false);
    expect(r.errors.join(" ")).toMatch(/regex/i);
  });

  it("is ready for a clean, valid document", () => {
    const r = bootCheck(JSON.stringify({ tables: [{ group: "a", privileges: ["SELECT"] }] }));
    expect(r.ready).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("stays ready but warns about unreachable (shadowed) rules", () => {
    const r = bootCheck(
      JSON.stringify({
        tables: [{ privileges: ["SELECT"] }, { group: "a", privileges: ["INSERT"] }],
      }),
    );
    expect(r.ready).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/ulaşılamaz/);
  });
});
