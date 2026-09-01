import { describe, it, expect } from "vitest";
import { compareThreshold, zScore, isAnomaly } from "./evaluate";

describe("compareThreshold", () => {
  it("evaluates each comparator", () => {
    expect(compareThreshold(10, "GT", 5)).toBe(true);
    expect(compareThreshold(5, "GTE", 5)).toBe(true);
    expect(compareThreshold(3, "LT", 5)).toBe(true);
    expect(compareThreshold(6, "LTE", 5)).toBe(false);
  });
});

describe("zScore", () => {
  it("returns null with fewer than 3 points", () => {
    expect(zScore([1, 2], 5)).toBeNull();
  });

  it("scores deviation from the mean", () => {
    expect(zScore([10, 10, 10, 10], 10)).toBe(0);
    expect(zScore([10, 10, 10, 10], 20)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isAnomaly", () => {
  const history = [10, 11, 9, 10, 10, 11, 9]; // mean ~10, small std

  it("flags a large spike", () => {
    expect(isAnomaly(history, 100, 3)).toBe(true);
  });

  it("ignores values within the norm", () => {
    expect(isAnomaly(history, 11, 3)).toBe(false);
  });

  it("respects direction", () => {
    expect(isAnomaly(history, 0, 3, "up")).toBe(false);
    expect(isAnomaly(history, 0, 3, "down")).toBe(true);
  });
});
