/**
 * Minimal client for Trino's REST API (requirement 6.1) — used by node discovery
 * and drift checks (Phase 4) and the observability collector (Phase 5). The pure
 * `normalize*` functions are unit-tested; the network `get` is a thin wrapper.
 */

export type TrinoInfo = {
  version: string;
  environment: string;
  coordinator: boolean;
  starting: boolean;
  uptime: string | null;
};

export type TrinoNodeStatus = {
  uri: string;
  coordinator: boolean;
  active: boolean;
  recentFailures: number;
  recentSuccesses: number;
  recentFailureRatio: number;
  lastResponseTime: string | null;
};

export type TrinoStatus = {
  cpuPercent: number | null;
  heapUsedBytes: number | null;
  heapMaxBytes: number | null;
  nonHeapBytes: number | null;
};

/** Full per-node detail from /v1/status — used for the node detail cards in the UI. */
export type TrinoNodeDetail = {
  nodeId: string;
  coordinator: boolean;
  uptime: string | null;
  processors: number;
  cpuPercent: number;
  systemCpuPercent: number;
  heapUsedBytes: number;
  heapMaxBytes: number;
  nonHeapBytes: number;
  memPoolMaxBytes: number;
  memPoolReservedBytes: number;
  memPoolFreeBytes: number;
};

/** Live cluster aggregates derived from /v1/query (running queries only). */
export type ClusterLiveStats = {
  runningQueries: number;
  queuedQueries: number;
  blockedQueries: number;
  runningDrivers: number;
  blockedDrivers: number;
  processedInputRows: number;
  physicalInputBytes: number;
  reservedMemoryBytes: number;
};

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeInfo(json: unknown): TrinoInfo {
  const o = (json ?? {}) as Record<string, unknown>;
  const nodeVersion = (o.nodeVersion ?? {}) as Record<string, unknown>;
  return {
    version: typeof nodeVersion.version === "string" ? nodeVersion.version : "unknown",
    environment: typeof o.environment === "string" ? o.environment : "unknown",
    coordinator: o.coordinator === true,
    starting: o.starting === true,
    uptime: typeof o.uptime === "string" ? o.uptime : null,
  };
}

export function normalizeNodes(json: unknown): TrinoNodeStatus[] {
  if (!Array.isArray(json)) return [];
  return json.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      uri: typeof o.uri === "string" ? o.uri : "",
      coordinator: o.coordinator === true,
      active: o.active !== false,
      recentFailures: num(o.recentFailures),
      recentSuccesses: num(o.recentSuccesses),
      recentFailureRatio: num(o.recentFailureRatio),
      lastResponseTime: typeof o.lastResponseTime === "string" ? o.lastResponseTime : null,
    };
  });
}

function optNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeStatus(json: unknown): TrinoStatus {
  const o = (json ?? {}) as Record<string, unknown>;
  const heapUsed = optNum(o.heapUsed);
  const heapAvailable = optNum(o.heapAvailable);
  const cpu = optNum(o.processCpuLoad);
  return {
    cpuPercent: cpu === null ? null : Math.round(cpu * 100),
    heapUsedBytes: heapUsed,
    heapMaxBytes: heapUsed !== null && heapAvailable !== null ? heapUsed + heapAvailable : null,
    nonHeapBytes: optNum(o.nonHeapUsed),
  };
}

export type TrinoCredentials = { username: string; password: string };

function serviceAuthHeader(): Record<string, string> {
  const user = process.env.TRINO_SERVICE_USER;
  const pass = process.env.TRINO_SERVICE_PASSWORD;
  if (user && pass) {
    return { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` };
  }
  return {};
}

function buildAuthHeader(token?: string, credentials?: TrinoCredentials): Record<string, string> {
  if (token) return { authorization: `Bearer ${token}` };
  if (credentials) {
    return { authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}` };
  }
  return serviceAuthHeader();
}

async function get(
  baseUrl: string,
  path: string,
  token?: string,
  timeoutMs = 5000,
  credentials?: TrinoCredentials,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      headers: {
        accept: "application/json",
        ...buildAuthHeader(token, credentials),
        "X-Trino-User": credentials?.username ?? process.env.TRINO_SERVICE_USER ?? "nizam",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Trino ${path} → HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchInfo(
  baseUrl: string,
  token?: string,
  credentials?: TrinoCredentials,
): Promise<TrinoInfo> {
  return normalizeInfo(await get(baseUrl, "/v1/info", token, 5000, credentials));
}

/** Execute a SQL query via /v1/statement, polling until results are ready. */
async function runStatement(
  baseUrl: string,
  sql: string,
  token?: string,
  credentials?: TrinoCredentials,
): Promise<unknown[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = {
      "content-type": "text/plain",
      accept: "application/json",
      ...buildAuthHeader(token, credentials),
      "X-Trino-User": credentials?.username ?? process.env.TRINO_SERVICE_USER ?? "nizam",
    };
    const initRes = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/statement`, {
      method: "POST",
      headers,
      body: sql,
      signal: controller.signal,
    });
    if (!initRes.ok) throw new Error(`Trino /v1/statement → HTTP ${initRes.status}`);
    let current = (await initRes.json()) as Record<string, unknown>;
    const rows: unknown[][] = [];
    while (current.nextUri) {
      const pollRes = await fetch(current.nextUri as string, { headers });
      current = (await pollRes.json()) as Record<string, unknown>;
      if (Array.isArray(current.data)) rows.push(...(current.data as unknown[][]));
    }
    if (current.error) {
      const err = current.error as Record<string, unknown>;
      throw new Error(typeof err.message === "string" ? err.message : "Query failed");
    }
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch cluster nodes via system.runtime.nodes (works in Trino 411+; /v1/node was removed).
 *  Columns: node_id(0), http_uri(1), coordinator(2), state(3) — state is 'active'|'inactive'.
 */
export async function fetchNodes(
  baseUrl: string,
  token?: string,
  credentials?: TrinoCredentials,
): Promise<TrinoNodeStatus[]> {
  const rows = await runStatement(
    baseUrl,
    "SELECT node_id, http_uri, coordinator, state FROM system.runtime.nodes",
    token,
    credentials,
  );
  return rows
    .filter((r) => !r[2]) // exclude coordinator
    .map((r) => ({
      uri: typeof r[1] === "string" ? r[1] : "",
      coordinator: r[2] === true,
      active: r[3] === "active",
      recentFailures: 0,
      recentSuccesses: 0,
      recentFailureRatio: 0,
      lastResponseTime: null,
    }));
}

/** Raw query list from /v1/query (used by the Phase 5 collector). */
export async function fetchQueries(baseUrl: string, token?: string): Promise<unknown[]> {
  const json = await get(baseUrl, "/v1/query", token);
  return Array.isArray(json) ? json : [];
}

/** Full detail of a single query from /v1/query/{queryId} (requirement 6.1 + 6.2.3 drill-down). */
export async function fetchQueryDetail(baseUrl: string, queryId: string, token?: string): Promise<unknown> {
  return get(baseUrl, `/v1/query/${encodeURIComponent(queryId)}`, token);
}

/** Raw task list from /v1/task (requirement 6.1) — internal endpoint; may be unavailable. */
export async function fetchTasks(baseUrl: string, token?: string): Promise<unknown[]> {
  const json = await get(baseUrl, "/v1/task", token);
  return Array.isArray(json) ? json : [];
}

export async function fetchStatus(baseUrl: string, token?: string): Promise<TrinoStatus> {
  return normalizeStatus(await get(baseUrl, "/v1/status", token));
}

export async function fetchStatusFor(nodeUrl: string, token?: string): Promise<TrinoStatus | null> {
  return get(nodeUrl, "/v1/status", token).then(normalizeStatus).catch(() => null);
}

function normalizeNodeDetail(json: unknown): TrinoNodeDetail {
  const o = (json ?? {}) as Record<string, unknown>;
  const pool = ((o.memoryInfo as Record<string, unknown>)?.pool ?? {}) as Record<string, unknown>;
  const heapUsed = num(o.heapUsed);
  const heapAvailable = num(o.heapAvailable);
  return {
    nodeId: typeof o.nodeId === "string" ? o.nodeId : "",
    coordinator: o.coordinator === true,
    uptime: typeof o.uptime === "string" ? o.uptime : null,
    processors: num(o.processors),
    cpuPercent: Math.round(num(o.processCpuLoad) * 100),
    systemCpuPercent: Math.round(num(o.systemCpuLoad) * 100),
    heapUsedBytes: heapUsed,
    heapMaxBytes: heapUsed + heapAvailable,
    nonHeapBytes: num(o.nonHeapUsed),
    memPoolMaxBytes: num(pool.maxBytes),
    memPoolReservedBytes: num(pool.reservedBytes),
    memPoolFreeBytes: num(pool.freeBytes),
  };
}

/** Fetch full node detail from /v1/status. Workers use their internal HTTP URL. */
export async function fetchNodeDetail(nodeUrl: string, token?: string): Promise<TrinoNodeDetail | null> {
  return get(nodeUrl, "/v1/status", token).then(normalizeNodeDetail).catch(() => null);
}

function parseSizeStr(s: unknown): number {
  if (typeof s !== "string") return 0;
  const m = s.match(/^([0-9.]+)\s*([KMGTP]?B)$/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const units: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15 };
  return Math.round(v * (units[m[2].toUpperCase()] ?? 1));
}

export type TrinoWorkerSummary = {
  nodeId: string;
  /** Worker's own HTTP URI (used to call its /v1/status). */
  uri: string;
  /** Total bytes input to this worker across all tasks (from /ui/api/worker). */
  inputDataBytes: number;
  /** Total bytes output from this worker across all tasks. */
  outputDataBytes: number;
};

/**
 * Fetch per-worker I/O stats from the coordinator's internal UI API at
 * /ui/api/worker — the same endpoint powering the Trino web UI worker page.
 * Falls back to an empty array when the endpoint is unavailable (older
 * Trino versions or non-coordinator nodes).
 */
export async function fetchWorkerList(baseUrl: string, token?: string): Promise<TrinoWorkerSummary[]> {
  try {
    const raw = await get(baseUrl, "/ui/api/worker", token);
    if (!Array.isArray(raw)) return [];
    return raw.map((w) => {
      const o = (w ?? {}) as Record<string, unknown>;
      const stats = (o.stats ?? {}) as Record<string, unknown>;
      return {
        nodeId: typeof o.nodeId === "string" ? o.nodeId : "",
        uri: typeof o.uri === "string" ? o.uri : "",
        inputDataBytes: parseSizeStr((stats.inputDataSize ?? stats.totalInputDataSize) as unknown),
        outputDataBytes: parseSizeStr((stats.outputDataSize ?? stats.totalOutputDataSize) as unknown),
      };
    }).filter((w) => w.nodeId);
  } catch {
    return [];
  }
}

/** Aggregate live stats from /v1/query for the cluster dashboard. */
export async function fetchClusterLiveStats(baseUrl: string, token?: string): Promise<ClusterLiveStats> {
  const queries = await fetchQueries(baseUrl, token);
  const stats: ClusterLiveStats = {
    runningQueries: 0, queuedQueries: 0, blockedQueries: 0,
    runningDrivers: 0, blockedDrivers: 0,
    processedInputRows: 0, physicalInputBytes: 0, reservedMemoryBytes: 0,
  };
  for (const q of queries) {
    const o = (q ?? {}) as Record<string, unknown>;
    const qs = (o.queryStats ?? {}) as Record<string, unknown>;
    const state = typeof o.state === "string" ? o.state : "";
    if (state === "RUNNING") stats.runningQueries++;
    else if (state === "QUEUED") stats.queuedQueries++;
    else if (state === "BLOCKED") stats.blockedQueries++;
    if (state === "RUNNING" || state === "BLOCKED") {
      stats.runningDrivers += num(qs.runningDrivers);
      stats.blockedDrivers += num(qs.blockedDrivers);
      stats.processedInputRows += num(qs.processedInputPositions);
      stats.physicalInputBytes += parseSizeStr(qs.physicalInputDataSize);
      stats.reservedMemoryBytes += parseSizeStr(qs.totalMemoryReservation);
    }
  }
  return stats;
}
