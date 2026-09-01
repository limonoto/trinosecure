import { describe, it, expect } from "vitest";
import { bootCheckCatalog } from "./boot-check";

describe("bootCheckCatalog", () => {
  it("rejects an unknown connector", () => {
    const r = bootCheckCatalog("nope", {});
    expect(r.ready).toBe(false);
    expect(r.errors[0]).toMatch(/Bilinmeyen/);
  });

  it("errors when a required param is missing", () => {
    const r = bootCheckCatalog("postgresql", { "connection-user": "u" });
    expect(r.ready).toBe(false);
    expect(r.errors.some((e) => e.includes("connection-url"))).toBe(true);
  });

  it("passes when required params are present", () => {
    const r = bootCheckCatalog("postgresql", {
      "connection-url": "jdbc:postgresql://h:5432/db",
      "connection-user": "u",
    });
    expect(r.ready).toBe(true);
  });

  it("passes for a param-less connector (memory)", () => {
    expect(bootCheckCatalog("memory", {}).ready).toBe(true);
  });
});
