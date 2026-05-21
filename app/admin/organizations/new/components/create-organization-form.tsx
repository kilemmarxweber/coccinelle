"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createOrganizationFormSchema,
  type CreateOrganizationFormValues,
} from "@/app/admin/organizations/schema";

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationFormSchema),
    defaultValues: { name: "", slug: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: CreateOrganizationFormValues) {
    form.clearErrors("root");
    try {
      const { data, error } = await authClient.organization.create({
        name: values.name.trim(),
        slug: values.slug.trim(),
      });

      if (error) {
        form.setError("root", {
          type: "server",
          message: error.message ?? "Création impossible. Réessayez plus tard.",
        });
        toast.error(error.message ?? "Création impossible. Réessayez plus tard.");
        return;
      }

      const orgId = data?.id;
      if (orgId) {
        const { error: activeError } = await authClient.organization.setActive({
          organizationId: orgId,
        });
        if (activeError) {
          toast.message(
            "Organisation créée, mais l’activation par défaut a échoué. Choisissez-la dans les paramètres.",
            { description: activeError.message }
          );
        }
      }

      toast.success("Organisation créée.");
      if (orgId) {
        router.push(`/admin/organizations/${orgId}`);
      } else {
        router.push("/admin/organizations");
      }
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de joindre le serveur.";
      form.setError("root", {
        type: "server",
        message:
          "Connexion au serveur impossible. Vérifiez l’URL (localhost vs 127.0.0.1) et votre réseau.",
      });
      toast.error(message);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(onSubmit)(e);
        }}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de l’organisation</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoComplete="organization"
                  placeholder="Église locale"
                  className="h-11"
                  disabled={isSubmitting}
                  onBlur={(e) => {
                    field.onBlur();
                    const slug = form.getValues("slug");
                    if (!slug.trim()) {
                      const generated = slugifyName(e.target.value);
                      if (generated.length >= 2) {
                        form.setValue("slug", generated, {
                          shouldValidate: true,
                        });
                      }
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Identifiant URL (slug)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="mon-organisation"
                  className="h-11 font-mono text-sm"
                  disabled={isSubmitting}
                  onChange={(e) => {
                    field.onChange(e.target.value.toLowerCase());
                  }}
                />
              </FormControl>
              <FormDescription>
                Unique, en minuscules. Sert d’identifiant technique (ex. pour les invitations).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Création…" : "Créer l’organisation"}
        </Button>
      </form>
    </Form>
  );
}
