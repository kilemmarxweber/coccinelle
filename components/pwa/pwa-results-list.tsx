import { DepartResultCard } from "@/components/funnel";
import type { SearchDepartResult } from "@/lib/search-departs/types";

export type PwaResultsListProps = {
  orgSlug: string;
  results: SearchDepartResult[];
};

export function PwaResultsList({ orgSlug, results }: PwaResultsListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((depart) => (
        <li key={depart.departId}>
          <DepartResultCard
            depart={depart}
            ctaLabel="Voir le départ"
            href={`/${orgSlug}/departs/${depart.departId}`}
          />
        </li>
      ))}
    </ul>
  );
}
