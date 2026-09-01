/**
 * HTTP client for the ansible-runner sidecar service.
 *
 * The runner service accepts a playbook + inventory + managed files + SSH
 * credentials, executes ansible-playbook in a temporary workspace, and returns
 * the combined output. The service URL is configured via ANSIBLE_RUNNER_URL
 * (default: http://ansible-runner:8000 for Docker Compose).
 */

export type RunnerRequest = {
  inventory: string;
  playbook: string;
  files: Record<string, string>;
  ssh_user: string;
  ssh_password?: string;
  ssh_private_key?: string;
};

export type RunnerResult =
  | { ok: true; stdout: string; returnCode: number }
  | { ok: false; error: string };

function runnerUrl(): string {
  return (process.env.ANSIBLE_RUNNER_URL ?? "http://ansible-runner:8000").replace(/\/$/, "");
}

export async function executePlaybook(req: RunnerRequest): Promise<RunnerResult> {
  const url = `${runnerUrl()}/run`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      // Playbooks against a real cluster can take several minutes.
      signal: AbortSignal.timeout(660_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Runner HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { success: boolean; return_code: number; stdout: string; stderr: string };
    const combined = [data.stdout, data.stderr].filter(Boolean).join("\n");

    if (!data.success) {
      return { ok: false, error: combined };
    }

    return { ok: true, stdout: combined, returnCode: data.return_code };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    return { ok: false, error: `ansible-runner'a ulaşılamadı: ${msg}` };
  }
}

export type ProbeResult = { ok: true } | { ok: false; error: string };

export async function probeHost(params: {
  host: string;
  ssh_user: string;
  ssh_password?: string;
  ssh_private_key?: string;
  ssh_port?: number;
}): Promise<ProbeResult> {
  try {
    const res = await fetch(`${runnerUrl()}/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(35_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Runner HTTP ${res.status}: ${text}` };
    }
    const data = (await res.json()) as { ok: boolean; message: string };
    return data.ok ? { ok: true } : { ok: false, error: data.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ansible-runner'a ulaşılamadı" };
  }
}

export async function isRunnerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${runnerUrl()}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
