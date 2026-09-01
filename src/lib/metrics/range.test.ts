import { describe, it, expect } from "vitest";
import { resolveRange, bucketSizeMs, RANGES } from "./range";

describe("resolveRange", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  it("computes the since boundary from the range", () => {
    const r = resolveRange("1h", now);
    expect(r.key).toBe("1h");
    expect(r.since.toISOString()).toBe("2026-06-30T11:00:00.000Z");
  });

  it("defaults to 1h for unknown keys", () => {
    expect(resolveRange("nope", now).key).toBe("1h");
    expect(resolveRange(undefined, now).key).toBe("1h");
  });

  it("supports all defined ranges", () => {
    for (const range of RANGES) {
      expect(resolveRange(range.key, now).ms).toBe(range.ms);
    }
  });

  it("uses an explicit custom from/to range", () => {
    const r = resolveRange("1h", now, { from: "2026-06-30T08:00:00.000Z", to: "2026-06-30T10:00:00.000Z" });
    expect(r.key).toBe("custom");
    expect(r.since.toISOString()).toBe("2026-06-30T08:00:00.000Z");
    expect(r.until.toISOString()).toBe("2026-06-30T10:00:00.000Z");
    expect(r.ms).toBe(2 * 60 * 60_000);
  });

  it("ignores an invalid or inverted custom range", () => {
    expect(resolveRange("1h", now, { from: "bad", to: "2026-06-30T10:00:00.000Z" }).key).toBe("1h");
    expect(resolveRange("1h", now, { from: "2026-06-30T10:00:00.000Z", to: "2026-06-30T08:00:00.000Z" }).key).toBe("1h");
  });

  it("preset ranges end at now", () => {
    expect(resolveRange("1h", now).until.toISOString()).toBe(now.toISOString());
  });
});

describe("bucketSizeMs", () => {
  it("keeps a minimum of 1 minute and scales with the range", () => {
    expect(bucketSizeMs(15 * 60_000)).toBe(60_000);
    expect(bucketSizeMs(24 * 60 * 60_000)).toBeGreaterThan(60_000);
  });
});
