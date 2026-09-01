import { describe, it, expect } from "vitest";
import { sha256Hex, nodeVersionConsistency, type NodeInfo } from "./consistency";

describe("sha256Hex", () => {
  it("is stable and content-sensitive", () => {
    expect(sha256Hex("a")).toBe(sha256Hex("a"));
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
    expect(sha256Hex("")).toHaveLength(64);
  });
});

describe("nodeVersionConsistency", () => {
  const node = (host: string, reachable: boolean, version: string | null, environment: string | null): NodeInfo => ({
    host,
    reachable,
    version,
    environment,
  });

  it("passes when all nodes share version + environment", () => {
    const r = nodeVersionConsistency([node("c", true, "481", "prod"), node("w1", true, "481", "prod")]);
    expect(r.allReachable).toBe(true);
    expect(r.versionConsistent).toBe(true);
    expect(r.environmentConsistent).toBe(true);
    expect(r.versions).toEqual(["481"]);
  });

  it("flags version drift and unreachable nodes", () => {
    const r = nodeVersionConsistency([node("c", true, "481", "prod"), node("w1", true, "470", "prod"), node("w2", false, null, null)]);
    expect(r.allReachable).toBe(false);
    expect(r.versionConsistent).toBe(false);
    expect(r.versions.sort()).toEqual(["470", "481"]);
    expect(r.unreachable).toEqual(["w2"]);
  });

  it("flags environment drift", () => {
    const r = nodeVersionConsistency([node("c", true, "481", "prod"), node("w1", true, "481", "test")]);
    expect(r.environmentConsistent).toBe(false);
  });
});
