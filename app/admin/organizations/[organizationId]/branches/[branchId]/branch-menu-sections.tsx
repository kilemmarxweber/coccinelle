import Link from "next/link";
import type { BranchMenuSection } from "@/lib/branch/branch-menus";
import { cn } from "@/lib/utils";

type BranchMenuSectionsProps = {
  sections: BranchMenuSection[];
  emptyMessage?: string;
  columnsClassName?: string;
};

/**
 * Rendu serveur des cartes menu (icônes Lucide non sérialisables vers Client).
 */
export function BranchMenuSections({
  sections,
  emptyMessage,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-4",
}: BranchMenuSectionsProps) {
  if (sections.length === 0) {
    if (!emptyMessage) return null;
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      {sections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <section key={section.title} className="space-y-4">
            <div className="flex items-center gap-2">
              <SectionIcon className={`size-5 ${section.iconColor}`} />
              <h3
                className={`text-sm font-bold tracking-wide uppercase ${section.titleColor}`}
              >
                {section.title}
              </h3>
            </div>

            <div
              className={cn(
                "grid grid-cols-1 gap-4",
                columnsClassName,
              )}
            >
              {section.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={cn(
                      "group flex items-start gap-3.5 rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                      item.primary
                        ? "border-primary/50 hover:border-primary hover:shadow-primary/15"
                        : "border-border hover:border-primary/40 hover:shadow-primary/10",
                    )}
                  >
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
                    >
                      <ItemIcon className={`size-5 ${item.iconColor}`} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-semibold text-foreground group-hover:text-primary">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
