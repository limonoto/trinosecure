import Link from "next/link";
import { Server } from "lucide-react";
import { getActiveEnvironment } from "@/lib/environment-context";
import { listVersionedArtifacts } from "@/lib/versioning";
import { HistoryClient } from "./history-client";

export default async function HistoryPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sürüm Geçmişi</h1>
        <div className="card mt-6 flex flex-col items-center gap-3 p-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Server className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">Önce bir ortam oluşturun.</p>
          <Link href="/environments" className="btn btn-primary btn-sm">
            Ortamlara git
          </Link>
        </div>
      </div>
    );
  }

  const artifacts = await listVersionedArtifacts(env.id);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sürüm Geçmişi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{env.name}</span> · tüm config dosyalarının
          sürümleri — eski bir sürüme tek tıkla dönebilir, otomatik yeniden dağıtabilirsiniz.
        </p>
      </div>
      <HistoryClient artifacts={artifacts} />
    </div>
  );
}
