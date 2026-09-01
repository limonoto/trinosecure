import { describe, it, expect } from "vitest";
import { resourceGroupPerformance, isLimitError, type QueryRow } from "./aggregate";

const q = (over: Partial<QueryRow>): QueryRow => ({
  resourceGroup: "etl",
  state: "FINISHED",
  elapsedMs: 1000,
  errorType: null,
  errorCode: null,
  ...over,
});

describe("isLimitError", () => {
  it("flags resource/queue/time exhaustion", () => {
    expect(isLimitError("INSUFFICIENT_RESOURCES", null)).toBe(true);
    expect(isLimitError("USER_ERROR", "EXCEEDED_TIME_LIMIT")).toBe(true);
    expect(isLimitError(null, "CLUSTER_OUT_OF_MEMORY")).toBe(true);
    expect(isLimitError("USER_ERROR", "SYNTAX_ERROR")).toBe(false);
  });
});

describe("resourceGroupPerformance", () => {
  it("computes avg, concurrency, saturation and limit-exceeds per group", () => {
    const rows = resourceGroupPerformance(
      [
        q({ state: "FINISHED", elapsedMs: 1000 }),
        q({ state: "FINISHED", elapsedMs: 3000 }),
        q({ state: "RUNNING", elapsedMs: null }),
        q({ state: "QUEUED", elapsedMs: null }),
        q({ state: "FAILED", errorType: "INSUFFICIENT_RESOURCES" }),
      ],
      new Map([["etl", 4]]),
    );
    const etl = rows.find((r) => r.group === "etl")!;
    expect(etl.avgMs).toBe(2000);
    expect(etl.running).toBe(1);
    expect(etl.queued).toBe(1);
    expect(etl.limit).toBe(4);
    expect(etl.saturationPct).toBe(25); // 1 running / 4 limit
    expect(etl.exceeded).toBe(1);
    expect(etl.total).toBe(5);
  });

  it("matches a limit by leaf name when the full path is used", () => {
    const rows = resourceGroupPerformance([q({ resourceGroup: "global.etl", state: "RUNNING", elapsedMs: null })], new Map([["etl", 2]]));
    expect(rows[0].limit).toBe(2);
    expect(rows[0].saturationPct).toBe(50);
  });

  it("leaves saturation null without a limit", () => {
    const rows = resourceGroupPerformance([q({ resourceGroup: "adhoc", state: "RUNNING", elapsedMs: null })], new Map());
    expect(rows[0].saturationPct).toBeNull();
  });
});
