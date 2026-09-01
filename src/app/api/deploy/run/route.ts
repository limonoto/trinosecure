/**
 * POST /api/deploy/run
 *
 * SSE streaming endpoint that executes an Ansible playbook via the ansible-runner
 * sidecar and relays real-time output to the browser. Each Server-Sent Event
 * carries one of:
 *   {"line": "..."}                        — one line of Ansible stdout
 *   {"done": true, "returnCode": N}        — playbook process exited
 *   {"meta": true, "runId": "...", "status": "SUCCESS"|"FAILED"}  — DB record saved
 *
 * The DeploymentRun record is created before streaming starts (RUNNING) and updated
 * to SUCCESS/FAILED after the ansible-runner stream closes — even if the browser
 * disconnects mid-run.
 */

import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { ensureRole } from "@/lib/authz";
import { getSshCredentials } from "@/lib/deploy/ssh-config";
import { buildFileMap, fileMapToAnsibleFiles, fileMapToExpectedFiles } from "@/lib/deploy/file-map";
import { generateInventory, generatePlaybook, generateVerifyPlaybook } from "@/lib/deploy/ansible";
import { recordAudit, getSessionActor } from "@/lib/audit";

const RUNNER_URL = (process.env.ANSIBLE_RUNNER_URL ?? "http://ansible-runner:8000").replace(/\/$/, "");

type RunPayload = { type: "DISTRIBUTE" | "VERIFY"; restart: boolean };

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(request: NextRequest) {
  const denied = await ensureRole("PLATFORM_ADMIN");
  if (denied) return jsonErr(denied.error, 403);

  const { type, restart } = (await request.json()) as RunPayload;

  const active = await getActiveEnvironment();
  if (!active) return jsonErr("Ortam yok", 400);

  const env = await prisma.trinoEnvironment.findUnique({ where: { id: active.id } });
  if (!env) return jsonErr("Ortam bulunamadı", 400);

  if (type === "VERIFY" && env.deliveryMode !== "FILE") {
    return jsonErr("Doğrulama yalnızca FILE modunda geçerlidir.", 400);
  }

  const sshCreds = await getSshCredentials(env.id);
  if (!sshCreds) return jsonErr("SSH kimlik bilgisi tanımlı değil.", 400);

  const nodes = await prisma.trinoNode.findMany({ where: { environmentId: env.id }, select: { host: true } });
  if (nodes.length === 0) return jsonErr("Düğüm envanteri boş.", 400);

  const hosts = nodes.map((n) => n.host.replace(/^https?:\/\//, "").replace(/:\d+.*$/, ""));
  const fileMap = await buildFileMap(env.id);

  const inventory = generateInventory(hosts);
  const playbook =
    type === "VERIFY"
      ? generateVerifyPlaybook(fileMapToExpectedFiles(fileMap, env.configTarget))
      : generatePlaybook(fileMapToAnsibleFiles(fileMap, env.configTarget), { restart });

  const actor = await getSessionActor();
  const run = await prisma.deploymentRun.create({
    data: { environmentId: env.id, type, status: "RUNNING", triggeredBy: actor.username },
  });

  let runnerRes: Response;
  try {
    runnerRes = await fetch(`${RUNNER_URL}/run/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventory,
        playbook,
        files: type === "VERIFY" ? {} : fileMap,
        ssh_user: sshCreds.sshUser,
        ssh_password: sshCreds.sshPassword,
        ssh_private_key: sshCreds.sshPrivateKey,
      }),
      signal: AbortSignal.timeout(660_000),
    });
  } catch (e) {
    const msg = `ansible-runner'a ulaşılamadı: ${e instanceof Error ? e.message : "hata"}`;
    await prisma.deploymentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", stdout: msg, returnCode: -1, completedAt: new Date() },
    });
    return jsonErr(msg, 502);
  }

  if (!runnerRes.ok || !runnerRes.body) {
    const msg = `Runner HTTP ${runnerRes.status}`;
    await prisma.deploymentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", stdout: msg, returnCode: -1, completedAt: new Date() },
    });
    return jsonErr(msg, 502);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const runId = run.id;
  const envId = env.id;
  let fullOutput = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = runnerRes.body!.getReader();

      // Relay every chunk from ansible-runner; capture full output for DB.
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          fullOutput += decoder.decode(value, { stream: true });
          try {
            controller.enqueue(value);
          } catch {
            // Browser disconnected — continue reading to ensure DB is updated.
          }
        }
      } catch {
        // Runner connection dropped.
      }

      // Parse return code from the final SSE event.
      const doneMatch = fullOutput.match(/"returnCode"\s*:\s*(-?\d+)/);
      const returnCode = doneMatch ? parseInt(doneMatch[1], 10) : -1;
      const status = returnCode === 0 ? ("SUCCESS" as const) : ("FAILED" as const);

      await prisma.deploymentRun.update({
        where: { id: runId },
        data: { status, stdout: fullOutput, returnCode, completedAt: new Date() },
      });

      await recordAudit({
        action: "DEPLOY",
        entityType: "DeploymentRun",
        entityId: runId,
        actorUsername: actor.username,
        actorEmail: actor.email,
        environmentId: envId,
        trinoEnvName: env.name,
        trinoBaseUrl: env.trinoBaseUrl,
        after: { type, status, restart, triggeredBy: actor.username },
      });

      // Final meta event so the client knows the run ID and can refresh history.
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ meta: true, runId, status })}\n\n`),
        );
        controller.close();
      } catch {
        // Client already gone.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Run-Id": runId,
    },
  });
}
