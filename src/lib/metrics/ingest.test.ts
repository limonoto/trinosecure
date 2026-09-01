import { describe, it, expect } from "vitest";
import { parseTrinoDuration, normalizeQuery, bucketStart, summarizeQueryStates } from "./ingest";

describe("parseTrinoDuration", () => {
  it("parses Trino duration strings to milliseconds", () => {
    expect(parseTrinoDuration("12.34ms")).toBe(12);
    expect(parseTrinoDuration("1.50s")).toBe(1500);
    expect(parseTrinoDuration("2.00m")).toBe(120000);
    expect(parseTrinoDuration("500us")).toBe(1);
    expect(parseTrinoDuration("0.00ns")).toBe(0);
  });

  it("returns null for non-durations", () => {
    expect(parseTrinoDuration("abc")).toBeNull();
    expect(parseTrinoDuration(42)).toBeNull();
    expect(parseTrinoDuration(undefined)).toBeNull();
  });
});

describe("normalizeQuery", () => {
  it("maps a /v1/query row, joining resourceGroupId segments", () => {
    const q = normalizeQuery({
      queryId: "20260630_1",
      state: "FAILED",
      errorType: "USER_ERROR",
      errorCode: { name: "SYNTAX_ERROR" },
      session: { user: "alice" },
      resourceGroupId: ["global", "adhoc"],
      queryStats: { elapsedTime: "2.00s", queuedTime: "100.00ms" },
    });
    expect(q).toMatchObject({
      queryId: "20260630_1",
      username: "alice",
      resourceGroup: "global.adhoc",
      state: "FAILED",
      errorType: "USER_ERROR",
      errorCode: "SYNTAX_ERROR",
      elapsedMs: 2000,
      queuedMs: 100,
    });
  });

  it("returns null without a queryId", () => {
    expect(normalizeQuery({ state: "RUNNING" })).toBeNull();
  });
});

describe("summarizeQueryStates", () => {
  it("counts running vs queued, ignoring finished/failed", () => {
    expect(
      summarizeQueryStates(["RUNNING", "PLANNING", "QUEUED", "WAITING_FOR_RESOURCES", "FINISHED", "FAILED"]),
    ).toEqual({ runningQueries: 2, queuedQueries: 2 });
  });
});

describe("bucketStart", () => {
  it("truncates to the bucket boundary", () => {
    const d = new Date("2026-06-30T10:07:35.000Z");
    expect(bucketStart(d, 60_000).toISOString()).toBe("2026-06-30T10:07:00.000Z");
    expect(bucketStart(d, 5 * 60_000).toISOString()).toBe("2026-06-30T10:05:00.000Z");
  });
});
