import { describe, it, expect } from "vitest";
import { bootCheckResourceGroups } from "./boot-check";

describe("bootCheckResourceGroups", () => {
  it("rejects invalid JSON", () => {
    expect(bootCheckResourceGroups("{bad").ready).toBe(false);
  });

  it("errors when a selector routes to a non-existent group", () => {
    const doc = JSON.stringify({
      rootGroups: [{ name: "global", hardConcurrencyLimit: 10, maxQueued: 100 }],
      selectors: [{ group: "nope" }],
    });
    const r = bootCheckResourceGroups(doc);
    expect(r.ready).toBe(false);
    expect(r.errors[0]).toMatch(/nope/);
  });

  it("accepts a valid doc and warns on missing leaf limits", () => {
    const doc = JSON.stringify({
      rootGroups: [{ name: "global" }],
      selectors: [{ group: "global" }],
    });
    const r = bootCheckResourceGroups(doc);
    expect(r.ready).toBe(true);
    expect(r.warnings.some((w) => w.includes("hardConcurrencyLimit"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("maxQueued"))).toBe(true);
  });
});
