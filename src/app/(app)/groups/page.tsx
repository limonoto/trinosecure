import Link from "next/link";
import { Server } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { GroupsClient, type GroupRow } from "./groups-client";

export default async function GroupsPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Gruplar</h1>
        <div className="card mt-6 flex flex-col items-center gap-3 p-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Server className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Gruplar bir ortama bağlıdır. Önce bir ortam oluşturun.
          </p>
          <Link href="/environments" className="btn btn-primary btn-sm">
            Ortamlara git
          </Link>
        </div>
      </div>
    );
  }

  const groups = await prisma.appGroup.findMany({
    where: { environmentId: env.id },
    orderBy: { name: "asc" },
    include: { members: { orderBy: { username: "asc" } } },
  });

  const rows: GroupRow[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    members: g.members.map((m) => ({ id: m.id, username: m.username })),
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gruplar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{env.name}</span> ortamındaki gruplar ve
          üyelikleri — <span className="mono">rules.json</span> kuralları bu gruplara yazılır.
        </p>
      </div>
      <GroupsClient groups={rows} />
    </div>
  );
}
