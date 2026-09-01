import { describe, it, expect } from "vitest";
import {
  environmentTone,
  resolveActiveEnvironment,
  type EnvironmentSummary,
} from "@/lib/environments-shared";

describe("environmentTone", () => {
  it("flags production red", () => {
    expect(environmentTone("production")).toBe("destructive");
    expect(environmentTone("PROD-eu")).toBe("destructive");
  });
  it("flags staging/test/preview amber", () => {
    expect(environmentTone("staging")).toBe("warning");
    expect(environmentTone("test-1")).toBe("warning");
    expect(environmentTone("preview")).toBe("warning");
  });
  it("defaults to info", () => {
    expect(environmentTone("dev")).toBe("info");
    expect(environmentTone("local")).toBe("info");
  });
});

const envs: EnvironmentSummary[] = [
  { id: "a", name: "A", configTarget: "x", deliveryMode: "HTTP" },
  { id: "b", name: "B", configTarget: "y", deliveryMode: "FILE" },
];

describe("resolveActiveEnvironment", () => {
  it("returns null for an empty list", () => {
    expect(resolveActiveEnvironment([], "a")).toBeNull();
  });
  it("returns the cookie match", () => {
    expect(resolveActiveEnvironment(envs, "b")?.id).toBe("b");
  });
  it("falls back to the first when the id is missing or unknown", () => {
    expect(resolveActiveEnvironment(envs, undefined)?.id).toBe("a");
    expect(resolveActiveEnvironment(envs, "zzz")?.id).toBe("a");
  });
});
