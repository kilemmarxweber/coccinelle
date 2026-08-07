import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateOrganizationForm } from "@/app/admin/organizations/new/components/create-organization-form";

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-8 relative overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
        <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
          Nouvelle organisation
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
          Créez la société, puis ajoutez des branches (Agence, Hôtel, Boutique).
        </p>
      </section>

      <Card className="mx-auto max-w-xl border-border shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Informations</CardTitle>
          <CardDescription>
            Slug unique pour votre organisation.{" "}
            <Link
              href="/admin/organizations"
              className="text-primary underline-offset-4 hover:underline"
            >
              Retour à la liste
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
