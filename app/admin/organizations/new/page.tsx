import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrganizationForm } from "@/app/admin/organizations/new/components/create-organization-form";

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:max-w-4xl md:px-6">
      <Card>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-lg">Informations</CardTitle>
          <CardDescription>
            Slug unique pour votre organisation.{" "}
            <Link href="/admin/organizations" className="text-primary underline-offset-4 hover:underline">
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
