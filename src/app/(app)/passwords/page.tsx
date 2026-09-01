import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEnvironment } from "@/lib/environment-context";
import { PasswordsClient } from "./passwords-client";

export default async function PasswordsPage() {
  const env = await getActiveEnvironment();

  if (!env) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Şifre Kullanıcıları</h1>
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

  const [entries, groups] = await Promise.all([
    prisma.passwordEntry.findMany({
      where: { environmentId: env.id },
      orderBy: { username: "asc" },
      select: { id: true, username: true, encoding: true, updatedAt: true },
    }),
    prisma.appGroup.findMany({
      where: { environmentId: env.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <div>
        <p className="eyebrow mb-1">{env.name} · password.db</p>
        <h1 className="text-2xl font-semibold tracking-tight">Şifre Kullanıcıları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trino password dosyası kullanıcıları — şifreler yalnızca hash olarak saklanır, asla düz metin gösterilmez.
        </p>
      </div>
      <PasswordsClient
        entries={entries.map((e) => ({
          id: e.id,
          username: e.username,
          encoding: e.encoding,
          updatedAt: e.updatedAt.toISOString(),
        }))}
        groups={groups}
      />
    </div>
  );
}
