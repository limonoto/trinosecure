import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { getRunnerStatus, getDeploymentRuns } from "./actions";
import { getSshConfigStatus } from "./ssh-config-actions";
import { DeployClient, type NodeRow } from "./deploy-client";

export default async function DeployPage() {
  const active = await getActiveEnvironment();
  const env = active ? await prisma.trinoEnvironment.findUnique({ where: { id: active.id } }) : null;

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dağıtım & Drift</h1>
        <div className="card mt-6 flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-sm text-muted-foreground">Önce bir ortam seçin veya oluşturun.</p>
          <Link href="/environments" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            Ortam ekle
          </Link>
        </div>
      </div>
    );
  }

  const [nodes, runnerStatus, sshConfigStatus, deploymentRuns] = await Promise.all([
    prisma.trinoNode.findMany({
      where: { environmentId: env.id },
      orderBy: [{ type: "asc" }, { host: "asc" }],
    }),
    getRunnerStatus(),
    getSshConfigStatus(),
    getDeploymentRuns(),
  ]);

  const nodeRows: NodeRow[] = nodes.map((n) => ({
    id: n.id,
    host: n.host,
    type: n.type,
    lastSeen: n.lastSeen?.toISOString() ?? null,
  }));

  const sshState = sshConfigStatus.ok && sshConfigStatus.config
    ? { sshUser: sshConfigStatus.config.sshUser, hasPassword: sshConfigStatus.config.hasPassword, hasPrivateKey: sshConfigStatus.config.hasPrivateKey }
    : null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dağıtım & Drift</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Config dağıtım yönetimi, drift kontrolü ve otomatik Ansible dağıtımı.
        </p>
      </div>
      <DeployClient
        env={{
          name: env.name,
          deliveryMode: env.deliveryMode,
          configTarget: env.configTarget,
          refreshPeriod: env.refreshPeriod,
          hasTrinoApi: Boolean(env.trinoBaseUrl),
        }}
        nodes={nodeRows}
        sshState={sshState}
        runnerStatus={runnerStatus}
        recentRuns={deploymentRuns.ok ? deploymentRuns.runs : []}
      />
    </div>
  );
}
