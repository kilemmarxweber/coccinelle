"use client";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const name = session?.user?.name ?? "…";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:max-w-4xl md:px-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {isPending ? "Chargement…" : `Connecté en tant que ${name}.`}
        </p>
        <p className="text-base text-foreground">
          Gérez vos organisations depuis l’onglet dédié.
        </p>
      </div>
      <Button render={<Link href="/admin/organizations" />} className="w-full sm:w-auto">
        Mes organisations
      </Button>
    </div>
  );
}
