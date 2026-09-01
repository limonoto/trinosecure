import { describe, it, expect } from "vitest";
import { changedGroupPaths, isPathInScope } from "./tree";
import type { ResourceGroup } from "./schema";

const tree = (): ResourceGroup[] => [
  {
    name: "global",
    hardConcurrencyLimit: 100,
    subGroups: [
      { name: "etl", hardConcurrencyLimit: 10 },
      { name: "adhoc", hardConcurrencyLimit: 20 },
    ],
  },
];

describe("changedGroupPaths", () => {
  it("returns nothing for identical trees", () => {
    expect(changedGroupPaths(tree(), tree())).toEqual([]);
  });

  it("detects a modified group's own fields", () => {
    const after = tree();
    after[0].subGroups![0].hardConcurrencyLimit = 99;
    expect(changedGroupPaths(tree(), after)).toEqual(["global.etl"]);
  });

  it("detects added and removed groups", () => {
    const after = tree();
    after[0].subGroups!.push({ name: "reports", hardConcurrencyLimit: 5 });
    expect(changedGroupPaths(tree(), after)).toEqual(["global.reports"]);

    const removed = tree();
    removed[0].subGroups!.pop();
    expect(changedGroupPaths(tree(), removed)).toEqual(["global.adhoc"]);
  });
});

describe("isPathInScope", () => {
  it("matches full path or any segment", () => {
    expect(isPathInScope("global.etl", ["etl"])).toBe(true);
    expect(isPathInScope("global.etl", ["global.etl"])).toBe(true);
    expect(isPathInScope("global.etl", ["global"])).toBe(true);
    expect(isPathInScope("global.adhoc", ["etl"])).toBe(false);
  });
});
