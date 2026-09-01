import { prisma } from "@/lib/db";
import { getEffectiveRole } from "@/lib/authz";
import { SettingsClient, type RoleRow, type EnvOption } from "./settings-client";

export default async function SettingsPage() {
  const [roles, environments, myRole, roleCount] = await Promise.all([
    prisma.appUserRole.findMany({
      orderBy: [{ username: "asc" }],
      include: { environment: { select: { name: true } } },
    }),
    prisma.trinoEnvironment.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getEffectiveRole(),
    prisma.appUserRole.count(),
  ]);

  const rows: RoleRow[] = roles.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    scope: r.environment?.name ?? "global",
    scopeConfigTypes: r.scopeConfigTypes,
    scopeResourceGroups: r.scopeResourceGroups,
  }));
  const envOptions: EnvOption[] = environments.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">Erişim Kontrolü</p>
        <h1 className="text-2xl font-semibold tracking-tight">Roller & Erişim</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kullanıcılara rol atayın (Viewer / Config Editör / Platform Admin) — global ya da ortam bazlı.
        </p>
      </div>
      <SettingsClient rows={rows} envOptions={envOptions} myRole={myRole} unconfigured={roleCount === 0} />
    </div>
  );
}
