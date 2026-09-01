import { prisma } from "@/lib/db";
import { EnvironmentsClient, type EnvironmentRow } from "./environments-client";

export default async function EnvironmentsPage() {
  const rows = await prisma.trinoEnvironment.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
  const environments: EnvironmentRow[] = rows.map((e) => ({
    id: e.id,
    name: e.name,
    deliveryMode: e.deliveryMode,
    configTarget: e.configTarget,
    refreshPeriod: e.refreshPeriod,
    trinoBaseUrl: e.trinoBaseUrl,
    trinoUsername: e.trinoUsername,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ortamlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trino ortamları — teslim modu (HTTP/dosya), hedef ve yenileme periyodu.
        </p>
      </div>
      <EnvironmentsClient environments={environments} />
    </div>
  );
}
