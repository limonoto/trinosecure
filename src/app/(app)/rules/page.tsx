import Link from "next/link";
import { Server } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { getRulesContent } from "@/lib/rules/service";
import { RulesClient } from "./rules-client";

export default async function RulesPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Kural Çalışma Alanı</h1>
        <div className="card mt-6 flex flex-col items-center gap-3 p-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Server className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Kurallar bir ortama bağlıdır. Önce bir ortam oluşturun.
          </p>
          <Link href="/environments" className="btn btn-primary btn-sm">
            Ortamlara git
          </Link>
        </div>
      </div>
    );
  }

  const content = await getRulesContent(env.id);
  const tokenRow = await prisma.trinoEnvironment.findUnique({
    where: { id: env.id },
    select: { httpToken: true },
  });

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kural Çalışma Alanı</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{env.name}</span> ·{" "}
          <span className="mono">rules.json</span> — yukarıdan aşağı değerlendirilir,{" "}
          <span className="font-medium text-foreground">ilk eşleşen kazanır</span>.
        </p>
      </div>
      <RulesClient
        initialContent={content}
        env={{
          id: env.id,
          deliveryMode: env.deliveryMode,
          configTarget: env.configTarget,
          httpToken: tokenRow?.httpToken ?? null,
        }}
      />
    </div>
  );
}
