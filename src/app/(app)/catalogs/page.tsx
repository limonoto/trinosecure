import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { CatalogsClient, type CatalogItem } from "./catalogs-client";

export default async function CatalogsPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Kataloglar</h1>
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

  const rows = await prisma.catalogConfig.findMany({
    where: { environmentId: env.id },
    orderBy: { name: "asc" },
  });

  const catalogs: CatalogItem[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    connector: c.connector,
    properties: (c.properties as Record<string, string>) ?? {},
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name} · katalog konfigleri</p>
        <h1 className="text-2xl font-semibold tracking-tight">Kataloglar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Katalog bağlantılarını (JDBC bilgileri) yönetin; connector tipine göre önerilen parametreler listelenir.
        </p>
      </div>
      <CatalogsClient catalogs={catalogs} />
    </div>
  );
}
