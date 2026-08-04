import { PageHeader } from "@/components/layout/page-header";

type GerantPlaceholderProps = {
  title: string;
  description: string;
  unitHint?: string;
};

/** Placeholder contrôlé pour modules gérant pas encore livrés (U10–U12…). */
export function GerantPlaceholder({
  title,
  description,
  unitHint,
}: GerantPlaceholderProps) {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={title} subtitle="Espace gérant — Coccinelle" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-8 md:px-6">
        <p className="text-muted-foreground">{description}</p>
        {unitHint ? (
          <p className="text-sm text-muted-foreground">{unitHint}</p>
        ) : null}
      </div>
    </div>
  );
}
