import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <EmptyState
        icon={Search}
        title="Page introuvable"
        description="Cette page n’existe pas, ou le lien est incorrect."
        action={
          <Button type="button" render={<Link href="/" />}>
            Retour à l’accueil
          </Button>
        }
      />
    </div>
  );
}
