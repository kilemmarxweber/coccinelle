"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createOrganizationMemberAction } from "../actions";
import { createOrgMemberSchema, type CreateOrgMemberInput } from "../schema";

type Props = { organizationId: string };

export function CreateMemberForm({ organizationId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateOrgMemberInput>({
    resolver: zodResolver(createOrgMemberSchema),
    defaultValues: {
      organizationId,
      email: "",
      name: "",
      orgRole: ALL_ORG_ROLE_SLUGS[2],
    },
    mode: "onSubmit",
  });

  function onSubmit(values: CreateOrgMemberInput) {
    startTransition(async () => {
      const res = await createOrganizationMemberAction({
        ...values,
        organizationId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre créé. Un email avec le mot de passe temporaire a été envoyé.");
      router.push(`/admin/organizations/${organizationId}/members`);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom complet</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  className="h-12 min-h-[48px] text-base sm:h-11 sm:min-h-0 sm:text-sm"
                  disabled={pending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  className="h-12 min-h-[48px] text-base sm:h-11 sm:min-h-0 sm:text-sm"
                  disabled={pending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="orgRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rôle dans l’organisation</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  className="h-12 min-h-[48px] w-full text-base touch-manipulation sm:h-11 sm:min-h-0 sm:text-sm"
                  disabled={pending}
                >
                  {[...ALL_ORG_ROLE_SLUGS].map((slug) => (
                    <option key={slug} value={slug}>
                      {orgRoleLabel(slug)}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button type="submit" disabled={pending} className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0">
            {pending ? "Création…" : "Créer le membre"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
            disabled={pending}
            render={<Link href={`/admin/organizations/${organizationId}/members`} />}
          >
            Annuler
          </Button>
        </div>
      </form>
    </Form>
  );
}
