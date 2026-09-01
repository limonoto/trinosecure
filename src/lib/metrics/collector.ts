import { prisma } from "@/lib/db";
import { fetchNodes, fetchQueries, fetchStatus, fetchStatusFor, fetchTasks, fetchWorkerList } from "@/lib/trino-api/client";
import { evaluateRulesForEnv } from "@/lib/alerts/service";
import { normalizeQuery, summarizeQueryStates, countTasksByNode } from "./ingest";

/**
 * Collect one round of metrics for an environment (requirement 6.1/6.3/6.4):
 * cluster stats (derived from /v1/query), per-node CPU/heap/non-heap (/v1/status
 * per node) + task/failure counts (/v1/node failure detector), and per-query
 * stats (/v1/query, upserted by queryId so re-polling does not double count).
 * Each source is independent — a failing one does not abort the others.
 */

export type CollectResult = {
  ok: boolean;
  clusterMetric: boolean;
  nodeMetrics: number;
  queries: number;
  errors: string[];
};

export async function collectOnce(env: { id: string; trinoBaseUrl: string }): Promise<CollectResult> {
  const result: CollectResult = { ok: false, clusterMetric: false, nodeMetrics: 0, queries: 0, errors: [] };
  const now = new Date();

  // Fetch the query list once; reuse it for cluster stats + per-query stats.
  let normalized: NonNullable<ReturnType<typeof normalizeQuery>>[] = [];
  try {
    normalized = (await fetchQueries(env.trinoBaseUrl))
      .map(normalizeQuery)
      .filter((q): q is NonNullable<typeof q> => q !== null);
  } catch (e) {
    result.errors.push(`queries: ${e instanceof Error ? e.message : "hata"}`);
  }

  // Node list via system.runtime.nodes (workers only; coordinator is env.trinoBaseUrl).
  const nodes = await fetchNodes(env.trinoBaseUrl).catch(() => []);
  // Best-effort live task counts from /v1/task (internal endpoint; may be denied).
  const taskCounts = await fetchTasks(env.trinoBaseUrl).then(countTasksByNode).catch(() => null);

  // Keep trinoNode inventory in sync — upsert coordinator + workers on every collect.
  try {
    await prisma.trinoNode.upsert({
      where: { environmentId_nodeId: { environmentId: env.id, nodeId: env.trinoBaseUrl } },
      create: { environmentId: env.id, nodeId: env.trinoBaseUrl, host: env.trinoBaseUrl, type: "COORDINATOR", lastSeen: now },
      update: { type: "COORDINATOR", lastSeen: now },
    });
    for (const n of nodes) {
      if (!n.uri) continue;
      await prisma.trinoNode.upsert({
        where: { environmentId_nodeId: { environmentId: env.id, nodeId: n.uri } },
        create: { environmentId: env.id, nodeId: n.uri, host: n.uri, type: "WORKER", lastSeen: now },
        update: { lastSeen: now },
      });
    }
  } catch {
    // Non-fatal — inventory sync failure does not block metric collection.
  }

  // Cluster stats are derived from query states + node count (Trino has no public
  // /v1/cluster endpoint).
  try {
    const { runningQueries, queuedQueries } = summarizeQueryStates(normalized.map((q) => q.state));
    const totalShuffledBytes = normalized.reduce(
      (sum, q) => (q.shuffledBytes != null ? sum + q.shuffledBytes : sum),
      BigInt(0),
    );
    const totalInputBytes = normalized.reduce(
      (sum, q) => (q.physicalInputBytes != null ? sum + q.physicalInputBytes : sum),
      BigInt(0),
    );
    await prisma.clusterMetric.create({
      data: {
        environmentId: env.id,
        ts: now,
        runningQueries,
        queuedQueries,
        blockedQueries: 0,
        activeWorkers: nodes.filter((n) => n.active).length,
        runningDrivers: 0,
        totalShuffledBytes: totalShuffledBytes > BigInt(0) ? totalShuffledBytes : null,
        totalInputBytes: totalInputBytes > BigInt(0) ? totalInputBytes : null,
      },
    });
    result.clusterMetric = true;
  } catch (e) {
    result.errors.push(`cluster: ${e instanceof Error ? e.message : "hata"}`);
  }

  // Per-node metrics (6.3.2): coordinator + each worker. CPU/heap/non-heap come
  // from that node's /v1/status; task/failure counts from the failure detector.
  // Prefer live /v1/task counts (by node) when available; else the failure-detector proxy.
  const tasksFor = (nodeKey: string, fallbackActive: number | null, fallbackFailed: number | null) => {
    const live = taskCounts?.get(nodeKey);
    return live
      ? { activeTasks: live.active, failedTasks: live.failed }
      : { activeTasks: fallbackActive, failedTasks: fallbackFailed };
  };
  const targets: { nodeId: string; statusUrl: string; activeTasks: number | null; failedTasks: number | null }[] = [
    { nodeId: env.trinoBaseUrl, statusUrl: env.trinoBaseUrl, ...tasksFor(env.trinoBaseUrl, null, null) },
    ...nodes
      .filter((n) => n.uri)
      .map((n) => ({
        nodeId: n.uri,
        statusUrl: n.uri,
        ...tasksFor(n.uri, Math.round(n.recentSuccesses), Math.round(n.recentFailures)),
      })),
  ];
  for (const target of targets) {
    try {
      const status =
        target.statusUrl === env.trinoBaseUrl
          ? await fetchStatus(env.trinoBaseUrl)
          : await fetchStatusFor(target.statusUrl);
      await prisma.nodeMetric.create({
        data: {
          environmentId: env.id,
          nodeId: target.nodeId,
          ts: now,
          cpuPercent: status?.cpuPercent ?? null,
          heapUsedBytes: status?.heapUsedBytes ?? null,
          heapMaxBytes: status?.heapMaxBytes ?? null,
          nonHeapBytes: status?.nonHeapBytes ?? null,
          activeTasks: target.activeTasks,
          failedTasks: target.failedTasks,
        },
      });
      result.nodeMetrics += 1;
    } catch (e) {
      result.errors.push(`node ${target.nodeId}: ${e instanceof Error ? e.message : "hata"}`);
    }
  }

  // Best-effort per-worker I/O from /ui/api/worker (same host, same port as Trino UI).
  try {
    const workers = await fetchWorkerList(env.trinoBaseUrl);
    for (const w of workers) {
      if (!w.nodeId) continue;
      await prisma.trinoNode.upsert({
        where: { environmentId_nodeId: { environmentId: env.id, nodeId: w.nodeId } },
        create: { environmentId: env.id, nodeId: w.nodeId, host: w.uri || w.nodeId, type: "WORKER", lastSeen: now },
        update: { lastSeen: now },
      });
    }
  } catch {
    // Non-fatal — /ui/api/worker may not be available on all Trino versions.
  }

  try {
    for (const q of normalized) {
      const data = {
        username: q.username,
        resourceGroup: q.resourceGroup,
        state: q.state,
        errorType: q.errorType,
        errorCode: q.errorCode,
        queuedMs: q.queuedMs,
        analysisMs: q.analysisMs,
        planningMs: q.planningMs,
        executionMs: q.executionMs,
        elapsedMs: q.elapsedMs,
        createTime: q.createTime ?? now,
        shuffledBytes: q.shuffledBytes,
        physicalInputBytes: q.physicalInputBytes,
        physicalWrittenBytes: q.physicalWrittenBytes,
      };
      await prisma.queryStat.upsert({
        where: { environmentId_queryId: { environmentId: env.id, queryId: q.queryId } },
        create: { environmentId: env.id, queryId: q.queryId, ...data },
        update: data,
      });
      result.queries += 1;
    }
  } catch (e) {
    result.errors.push(`queries: ${e instanceof Error ? e.message : "hata"}`);
  }

  result.ok = result.clusterMetric || result.nodeMetrics > 0 || result.queries > 0;
  return result;
}

/** Collect for every environment that has a Trino API URL configured. */
export async function collectAll(): Promise<{ environmentId: string; result: CollectResult }[]> {
  const envs = await prisma.trinoEnvironment.findMany({
    where: { NOT: { trinoBaseUrl: null }, deletedAt: null },
    select: { id: true, trinoBaseUrl: true },
  });
  const out: { environmentId: string; result: CollectResult }[] = [];
  for (const env of envs) {
    if (!env.trinoBaseUrl) continue;
    const result = await collectOnce({ id: env.id, trinoBaseUrl: env.trinoBaseUrl });
    // Evaluate alert rules against the freshly collected data.
    try {
      await evaluateRulesForEnv(env.id, new Date());
    } catch {
      result.errors.push("alerts: değerlendirme hatası");
    }
    out.push({ environmentId: env.id, result });
  }
  return out;
}
