import { describe, it, expect } from "vitest";
import { bucketCounts, topCounts, average } from "./aggregate";

describe("bucketCounts", () => {
  it("buckets timestamps into fixed windows", () => {
    const since = 0;
    const until = 200;
    const out = bucketCounts([10, 20, 150], since, until, 100);
    expect(out.map((b) => b.value)).toEqual([2, 1, 0]); // [0-100): 10,20 ; [100-200): 150 ; [200]: 0
  });
});

describe("topCounts", () => {
  it("counts and sorts descending, mapping null to (bilinmiyor)", () => {
    expect(topCounts(["a", "a", "b", null], 2)).toEqual([
      { name: "a", value: 2 },
      { name: "b", value: 1 },
    ]);
  });
});

describe("average", () => {
  it("averages defined numbers and ignores null/undefined", () => {
    expect(average([10, 20, null, undefined, 30])).toBe(20);
    expect(average([null])).toBeNull();
  });
});
