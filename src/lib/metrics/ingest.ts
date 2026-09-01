/**
 * Pure ingestion helpers for the observability collector (requirement 6.1/6.2/6.4):
 * normalize Trino `/v1/query` rows into QueryStat shapes and parse Trino's
 * human-readable durations into milliseconds. Kept pure for unit testing.
 */

export type NormalizedQuery = {
  queryId: string;
  username: string | null;
  resourceGroup: string | null;
  state: string;
  errorType: string | null;
  errorCode: string | null;
  elapsedMs: number | null;
  queuedMs: number | null;
  analysisMs: number | null;
  planningMs: number | null;
  executionMs: number | null;
  createTime: Date | null;
  /** Bytes moved between workers over the network (Trino shuffle). */
  shuffledBytes: bigint | null;
  /** Bytes read from external connectors (storage I/O). */
  physicalInputBytes: bigint | null;
  /** Bytes written to external connectors. */
  physicalWrittenBytes: bigint | null;
};

/** Parse Trino human-readable byte sizes ("1.23GB", "456MB") into bytes. */
function parseSizeBytes(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  const m = /^([\d.]+)\s*([KMGTP]?B)$/i.exec(value.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  const units: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15 };
  const factor = units[m[2].toUpperCase()];
  if (!Number.isFinite(v) || factor === undefined) return null;
  return BigInt(Math.round(v * factor));
}

const UNIT_MS: Record<string, number> = {
  ns: 1 / 1_000_000,
  us: 1 / 1000,
  µs: 1 / 1000,
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parse a Trino duration string ("12.34ms", "1.50s", "2.00m") into milliseconds. */
export function parseTrinoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^([\d.]+)\s*(ns|us|µs|ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return null;
  const amount = parseFloat(match[1]);
  const unit = UNIT_MS[match[2]];
  if (!Number.isFinite(amount) || unit === undefined) return null;
  return Math.round(amount * unit);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Normalize one `/v1/query` row; returns null when there is no queryId. */
export function normalizeQuery(json: unknown): NormalizedQuery | null {
  const o = (json ?? {}) as Record<string, unknown>;
  const queryId = typeof o.queryId === "string" ? o.queryId : null;
  if (!queryId) return null;

  const session = (o.session ?? {}) as Record<string, unknown>;
  const errorCode = (o.errorCode ?? {}) as Record<string, unknown>;
  const qs = (o.queryStats ?? {}) as Record<string, unknown>;

  let resourceGroup: string | null = null;
  if (Array.isArray(o.resourceGroupId)) resourceGroup = o.resourceGroupId.join(".");
  else if (typeof o.resourceGroupId === "string") resourceGroup = o.resourceGroupId;

  return {
    queryId,
    username: typeof session.user === "string" ? session.user : null,
    resourceGroup,
    state: typeof o.state === "string" ? o.state : "UNKNOWN",
    errorType: typeof o.errorType === "string" ? o.errorType : null,
    errorCode: typeof errorCode.name === "string" ? errorCode.name : null,
    elapsedMs: parseTrinoDuration(qs.elapsedTime),
    queuedMs: parseTrinoDuration(qs.queuedTime),
    analysisMs: parseTrinoDuration(qs.analysisTime),
    planningMs: parseTrinoDuration(qs.planningTime),
    executionMs: parseTrinoDuration(qs.executionTime),
    createTime: parseDate(qs.createTime ?? o.createTime),
    shuffledBytes: parseSizeBytes(qs.shuffledDataSize),
    physicalInputBytes: parseSizeBytes(qs.physicalInputDataSize),
    physicalWrittenBytes: parseSizeBytes(qs.physicalWrittenDataSize),
  };
}

export type QueryDetail = NormalizedQuery & {
  /** Distinct node identifiers/hosts that ran tasks for this query (6.2.3 drill-down). */
  nodes: string[];
  totalTasks: number;
  failedTasks: number;
  errorMessage: string | null;
};

/** Host portion of a task's `self` URI, e.g. "http://w1:8080/v1/task/..." → "w1:8080". */
function hostOf(uri: unknown): string | null {
  if (typeof uri !== "string") return null;
  const match = /^https?:\/\/([^/]+)/.exec(uri);
  return match ? match[1] : null;
}

/** Walk a stage tree, collecting node ids and task counts from every task. */
function walkStage(stage: unknown, nodes: Set<string>, counts: { total: number; failed: number }): void {
  if (!stage || typeof stage !== "object") return;
  const s = stage as Record<string, unknown>;
  const tasks = Array.isArray(s.tasks) ? s.tasks : [];
  for (const task of tasks) {
    const status = ((task as Record<string, unknown>)?.taskStatus ?? {}) as Record<string, unknown>;
    const node = (typeof status.nodeId === "string" && status.nodeId) || hostOf(status.self);
    if (node) nodes.add(node);
    counts.total += 1;
    if (status.state === "FAILED") counts.failed += 1;
  }
  const subStages = Array.isArray(s.subStages) ? s.subStages : [];
  for (const sub of subStages) walkStage(sub, nodes, counts);
}

/** Normalize a `/v1/query/{queryId}` detail payload, including the nodes that ran it. */
export function normalizeQueryDetail(json: unknown): QueryDetail | null {
  const base = normalizeQuery(json);
  if (!base) return null;
  const o = (json ?? {}) as Record<string, unknown>;
  const failureInfo = (o.failureInfo ?? {}) as Record<string, unknown>;
  const nodes = new Set<string>();
  const counts = { total: 0, failed: 0 };
  walkStage(o.outputStage, nodes, counts);
  return {
    ...base,
    nodes: [...nodes],
    totalTasks: counts.total,
    failedTasks: counts.failed,
    errorMessage: typeof failureInfo.message === "string" ? failureInfo.message : null,
  };
}

const TERMINAL_TASK_STATES = new Set(["FINISHED", "CANCELED", "ABORTED", "FAILED"]);

/**
 * Count active vs failed tasks per node from a `/v1/task` payload (requirement
 * 6.1 + 6.3.2). The endpoint is internal and may be unavailable; callers treat a
 * failure as "no task data" and fall back to the failure detector.
 */
export function countTasksByNode(json: unknown): Map<string, { active: number; failed: number }> {
  const out = new Map<string, { active: number; failed: number }>();
  if (!Array.isArray(json)) return out;
  for (const task of json) {
    const status = ((task as Record<string, unknown>)?.taskStatus ?? {}) as Record<string, unknown>;
    const node = (typeof status.nodeId === "string" && status.nodeId) || hostOf(status.self);
    if (!node) continue;
    const entry = out.get(node) ?? { active: 0, failed: 0 };
    const state = typeof status.state === "string" ? status.state : "";
    if (state === "FAILED") entry.failed += 1;
    else if (!TERMINAL_TASK_STATES.has(state)) entry.active += 1;
    out.set(node, entry);
  }
  return out;
}

/** Truncate a timestamp to a bucket boundary (ms) for ErrorBucket aggregation. */
export function bucketStart(date: Date, bucketMs: number): Date {
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

export const QUEUED_STATES = new Set(["QUEUED", "WAITING_FOR_RESOURCES"]);
export const RUNNING_STATES = new Set(["PLANNING", "STARTING", "RUNNING", "FINISHING", "DISPATCHING"]);

/**
 * Derive cluster query counts from the `/v1/query` state list. Trino removed the
 * public `/v1/cluster` endpoint, so we summarize states ourselves (auth-free).
 */
export function summarizeQueryStates(states: readonly string[]): {
  runningQueries: number;
  queuedQueries: number;
} {
  let running = 0;
  let queued = 0;
  for (const state of states) {
    if (QUEUED_STATES.has(state)) queued += 1;
    else if (RUNNING_STATES.has(state)) running += 1;
  }
  return { runningQueries: running, queuedQueries: queued };
}
