"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { provisionDemoTrajetsAction } from "../../trajets/actions";

type Props = {
  organizationId: string;
  listHref: string;
  trajetsHref: string;
};

export function GuichetEmpty({ organizationId, listHref, trajetsHref }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleProvisionDemo() {
    startTransition(async () => {
      const res = await provisionDemoTrajetsAction(organizationId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`${res.data.count} trajets de démonstration créés.`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 md:max-w-4xl md:px-6">
      <p className="text-sm text-muted-foreground">
        Aucun trajet avec départ à venir n’est configuré pour cette agence. Créez des trajets
        et des dates de départ, ou utilisez le jeu de démo pour tester le guichet.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          className="gap-2"
          onClick={handleProvisionDemo}
          disabled={pending}
        >
          <Sparkles className="size-4" />
          {pending ? "Création…" : "Créer trajets de démo"}
        </Button>
        <Button variant="outline" className="gap-2" render={<Link href={trajetsHref} />}>
          <MapPin className="size-4" />
          Gérer les trajets
        </Button>
        <Button variant="ghost" render={<Link href={listHref} />}>
          Retour aux réservations
        </Button>
      </div>
    </div>
  );
}
