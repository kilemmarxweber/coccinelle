import Link from "next/link";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { branchDashboardPath } from "@/lib/branch/paths";

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  title: string;
  description: string;
};

/** Page placeholder pour une sous-route module (migration progressive). */
export function BranchModulePlaceholder({
  organizationId,
  branchId,
  branchName,
  title,
  description,
}: Props) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Construction className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs text-muted-foreground">Branche · {branchName}</p>
      </div>
      <Button
        variant="outline"
        render={
          <Link href={branchDashboardPath(organizationId, branchId)} />
        }
      >
        Retour
      </Button>
    </div>
  );
}
