import { describe, it, expect } from "vitest";
import { diffLines, diffStats } from "@/lib/rules/diff";

describe("diffLines", () => {
  it("returns all context for identical text", () => {
    const lines = diffLines("a\nb\nc", "a\nb\nc");
    expect(lines.every((l) => l.type === "ctx")).toBe(true);
    expect(diffStats(lines)).toEqual({ added: 0, removed: 0 });
  });

  it("detects an added line", () => {
    const lines = diffLines("a\nc", "a\nb\nc");
    expect(diffStats(lines)).toEqual({ added: 1, removed: 0 });
    expect(lines.find((l) => l.type === "add")?.text).toBe("b");
  });

  it("detects a removed line", () => {
    const lines = diffLines("a\nb\nc", "a\nc");
    expect(diffStats(lines)).toEqual({ added: 0, removed: 1 });
    expect(lines.find((l) => l.type === "del")?.text).toBe("b");
  });

  it("treats a changed line as remove + add", () => {
    const stats = diffStats(diffLines("a\nx\nc", "a\ny\nc"));
    expect(stats).toEqual({ added: 1, removed: 1 });
  });
});
