import { describe, it, expect } from "vitest";
import { parseResourceGroups } from "./schema";
import { flattenGroups, parseMemoryPercent, countGroups } from "./tree";

describe("parseResourceGroups", () => {
  it("parses a nested resource-groups document", () => {
    const result = parseResourceGroups(
      JSON.stringify({
        rootGroups: [
          { name: "global", softMemoryLimit: "80%", hardConcurrencyLimit: 100, subGroups: [{ name: "adhoc" }] },
        ],
        selectors: [{ user: "bob", group: "global.adhoc" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.rootGroups?.[0].subGroups?.[0].name).toBe("adhoc");
  });

  it("rejects invalid JSON", () => {
    expect(parseResourceGroups("{bad").ok).toBe(false);
  });
});

describe("flattenGroups", () => {
  it("DFS-flattens with depth + dotted path", () => {
    const flat = flattenGroups([
      { name: "global", subGroups: [{ name: "adhoc" }, { name: "etl", subGroups: [{ name: "nightly" }] }] },
    ]);
    expect(flat.map((f) => `${f.depth}:${f.path}`)).toEqual([
      "0:global",
      "1:global.adhoc",
      "1:global.etl",
      "2:global.etl.nightly",
    ]);
  });
});

describe("parseMemoryPercent", () => {
  it("reads percent strings and 0–1 fractions", () => {
    expect(parseMemoryPercent("80%")).toBe(80);
    expect(parseMemoryPercent(0.5)).toBe(50);
    expect(parseMemoryPercent("120%")).toBe(100);
    expect(parseMemoryPercent(undefined)).toBeNull();
    expect(parseMemoryPercent("5GB")).toBeNull();
  });
});

describe("countGroups", () => {
  it("counts the whole tree", () => {
    expect(countGroups([{ name: "a", subGroups: [{ name: "b" }, { name: "c" }] }])).toBe(3);
  });
});
