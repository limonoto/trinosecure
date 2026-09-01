import { describe, it, expect } from "vitest";
import { formString } from "@/lib/form";

describe("formString", () => {
  it("returns strings unchanged", () => {
    expect(formString("hello")).toBe("hello");
  });
  it("returns empty string for null", () => {
    expect(formString(null)).toBe("");
  });
  it("returns empty string for a File", () => {
    expect(formString(new File([], "f.txt"))).toBe("");
  });
});
