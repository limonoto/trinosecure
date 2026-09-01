import Link from "next/link";
import { Plus } from "lucide-react";
import { getActiveEnvironment } from "@/lib/environment-context";
import { getResourceGroupsContent } from "./actions";
import { ResourceGroupsClient } from "./resource-groups-client";

export default async function ResourceGroupsPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Kaynak Grupları</h1>
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

  const content = await getResourceGroupsContent(env.id);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name} · resource-groups.json</p>
        <h1 className="text-2xl font-semibold tracking-tight">Kaynak Grupları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kaynak grubu hiyerarşisi, soft/hard limitler ve seçiciler. Limitler görsel olarak gösterilir.
        </p>
      </div>
      <ResourceGroupsClient initialContent={content} />
    </div>
  );
}
