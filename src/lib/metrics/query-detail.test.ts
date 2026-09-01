import { describe, it, expect } from "vitest";
import { normalizeQueryDetail, countTasksByNode } from "./ingest";

describe("normalizeQueryDetail", () => {
  it("extracts related nodes and task counts from the stage tree", () => {
    const json = {
      queryId: "20260630_1",
      state: "FAILED",
      errorType: "USER_ERROR",
      session: { user: "ali" },
      queryStats: { elapsedTime: "1.50s" },
      failureInfo: { message: "boom" },
      outputStage: {
        tasks: [
          { taskStatus: { nodeId: "w1", state: "FINISHED" } },
          { taskStatus: { self: "http://w2:8080/v1/task/x", state: "FAILED" } },
        ],
        subStages: [{ tasks: [{ taskStatus: { nodeId: "w1", state: "RUNNING" } }] }],
      },
    };
    const d = normalizeQueryDetail(json);
    expect(d).not.toBeNull();
    expect(d!.nodes.sort()).toEqual(["w1", "w2:8080"]);
    expect(d!.totalTasks).toBe(3);
    expect(d!.failedTasks).toBe(1);
    expect(d!.errorMessage).toBe("boom");
    expect(d!.elapsedMs).toBe(1500);
  });

  it("returns null without a queryId", () => {
    expect(normalizeQueryDetail({})).toBeNull();
  });
});

describe("countTasksByNode", () => {
  it("counts active vs failed per node, ignoring terminal states", () => {
    const tasks = [
      { taskStatus: { nodeId: "w1", state: "RUNNING" } },
      { taskStatus: { nodeId: "w1", state: "FINISHED" } },
      { taskStatus: { nodeId: "w1", state: "FAILED" } },
      { taskStatus: { self: "http://w2:9000/v1/task/y", state: "RUNNING" } },
    ];
    const m = countTasksByNode(tasks);
    expect(m.get("w1")).toEqual({ active: 1, failed: 1 });
    expect(m.get("w2:9000")).toEqual({ active: 1, failed: 0 });
  });

  it("returns an empty map for non-arrays", () => {
    expect(countTasksByNode(null).size).toBe(0);
  });
});
