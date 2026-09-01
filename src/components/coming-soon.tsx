import { useTranslations } from "next-intl";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

type ComingSoonProps = Readonly<{
  title: string;
  description?: string;
}>;

/** Placeholder for routes whose UI has not been built yet (roadmap phases). */
export function ComingSoon({ title, description }: ComingSoonProps) {
  const t = useTranslations("comingSoon");
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <Card className="mt-6 flex flex-col items-center justify-center gap-3 p-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </Card>
    </div>
  );
}
