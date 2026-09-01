import Link from "next/link";
import { BookOpen } from "lucide-react";
import { GuideClient } from "./guide-client";

/** Interactive in-app user guide (Turkish) — per-page how-to, searchable. */
export default function GuidePage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kullanım Kılavuzu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hangi sayfanın hangi dosyayla çalıştığını üstteki <span className="font-medium text-foreground">Sayfa ↔ Dosya Eşlemesi</span>{" "}
            tablosundan görün; her ekranda hangi işlemin nasıl yapıldığını adım adım okuyun. Bir başlığa
            tıklayıp genişletin ya da yukarıdan arayın. İlgili ekrana{" "}
            <Link href="/" className="text-primary hover:underline">Panel</Link>’den de geçebilirsiniz.
          </p>
        </div>
      </div>
      <GuideClient />
    </div>
  );
}
