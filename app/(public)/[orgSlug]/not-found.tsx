import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";

export default function OrgNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <EmptyState
        icon={Search}
        title="Page introuvable"
        description="Cette organisation ou ce départ n’existe pas, ou le lien est incorrect."
        action={
          <Button type="button" render={<Link href="/" />}>
            Retour à l’accueil
          </Button>
        }
      />
    </div>
  );
}
