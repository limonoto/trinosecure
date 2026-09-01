import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { getActiveArtifactContent } from "@/lib/config-artifact";
import { buildUserGroups } from "@/lib/group-provider/format";
import { parseGroupProviderConfig } from "@/lib/group-provider/provider";
import { MappingClient } from "./mapping-client";

export default async function MappingPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Kullanıcı Eşleme</h1>
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

  const [groups, configJson] = await Promise.all([
    prisma.appGroup.findMany({
      where: { environmentId: env.id },
      include: { members: { select: { username: true } } },
    }),
    getActiveArtifactContent(env.id, "GROUP_PROVIDER", "group-provider"),
  ]);

  const userGroups = buildUserGroups(
    groups.map((g) => ({ name: g.name, members: g.members.map((m) => m.username) })),
  );
  const config = parseGroupProviderConfig(configJson);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name} · group-provider</p>
        <h1 className="text-2xl font-semibold tracking-tight">Kullanıcı Eşleme</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kullanıcı → grup ilişkisini görüntüleyin, statik (dosya) ya da LDAP grup sağlayıcısını yapılandırın.
        </p>
      </div>
      <MappingClient userGroups={userGroups} groupCount={groups.length} config={config} />
    </div>
  );
}
