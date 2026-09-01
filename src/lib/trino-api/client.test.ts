import { describe, it, expect } from "vitest";
import { normalizeInfo, normalizeNodes } from "./client";

describe("normalizeInfo", () => {
  it("reads nodeVersion.version + coordinator flag, defaults safely", () => {
    expect(normalizeInfo({ nodeVersion: { version: "481" }, environment: "prod", coordinator: true })).toEqual({
      version: "481",
      environment: "prod",
      coordinator: true,
      starting: false,
      uptime: null,
    });
    expect(normalizeInfo(null).version).toBe("unknown");
  });
});

describe("normalizeNodes", () => {
  it("maps the node array and tolerates non-arrays", () => {
    expect(normalizeNodes([{ uri: "http://w1:8080", recentFailures: 1 }])).toEqual([
      { uri: "http://w1:8080", recentFailures: 1, recentSuccesses: 0, recentFailureRatio: 0, lastResponseTime: null },
    ]);
    expect(normalizeNodes(null)).toEqual([]);
  });
});
