"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  OPS_ROLE,
  opsRoleLabel,
} from "@/lib/branch/ops-roles";
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
import { suggestMemberEmail } from "@/lib/slug";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createOrganizationMemberAction } from "../actions";
import { BranchPicker, type MemberBranchOption } from "../branch-picker";
import { createOrgMemberSchema, type CreateOrgMemberInput } from "../schema";

type OpsRoleOption = { slug: string; label: string };

type Props = {
  organizationId: string;
  organizationSlug: string;
  branches: MemberBranchOption[];
  opsRoleOptions: OpsRoleOption[];
};

export function CreateMemberForm({
  organizationId,
  organizationSlug,
  branches,
  opsRoleOptions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const roleOptions =
    opsRoleOptions.length > 0
      ? opsRoleOptions
      : [{ slug: OPS_ROLE.CAISSIER, label: opsRoleLabel(OPS_ROLE.CAISSIER) }];

  const form = useForm<CreateOrgMemberInput>({
    resolver: zodResolver(createOrgMemberSchema),
    defaultValues: {
      organizationId,
      email: "",
      name: "",
      phone: "",
      orgRole: ORG_ROLE.USER,
      opsRole: roleOptions[0]?.slug ?? OPS_ROLE.CAISSIER,
      branchIds: branches.length === 1 ? [branches[0]!.id] : [],
    },
    mode: "onSubmit",
  });

  function fillEmailIfEmpty(name: string) {
    if (form.getValues("email").trim()) return;
    const generated = suggestMemberEmail(name, organizationSlug);
    if (generated) {
      form.setValue("email", generated, { shouldValidate: true });
    }
  }

  function onSubmit(values: CreateOrgMemberInput) {
    fillEmailIfEmpty(values.name);
    const email = form.getValues("email").trim() || values.email;
    startTransition(async () => {
      const res = await createOrganizationMemberAction({
        ...values,
        email,
        organizationId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        "Membre créé. Mot de passe envoyé par email et WhatsApp (si numéro renseigné).",
      );
      router.push(`/admin/organizations/${organizationId}/members`);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form className="flex max-w-2xl flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                  onBlur={(e) => {
                    field.onBlur();
                    fillEmailIfEmpty(e.target.value);
                  }}
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
                  placeholder="Généré à partir du nom si vide"
                  className="h-12 min-h-[48px] text-base sm:h-11 sm:min-h-0 sm:text-sm"
                  disabled={pending}
                />
              </FormControl>
              <FormDescription>
                Obligatoire. Si vide, généré automatiquement à partir du nom (comme un slug).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone WhatsApp</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="tel"
                  inputMode="tel"
                  placeholder="+243…"
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
        <FormField
          control={form.control}
          name="opsRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Métier sur la / les branche(s)</FormLabel>
              <p className="text-xs text-muted-foreground">
                Détermine le dashboard (serveur, caissier séjours / resto,
                réception, gérant…).
              </p>
              <FormControl>
                <Select
                  {...field}
                  className="h-12 min-h-[48px] w-full text-base touch-manipulation sm:h-11 sm:min-h-0 sm:text-sm"
                  disabled={pending}
                >
                  {[...roleOptions].map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="branchIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Branche(s)</FormLabel>
              <p className="text-xs text-muted-foreground">
                Indique où ce membre travaille dans l’organisation. La première cochée devient la
                branche principale.
              </p>
              <FormControl>
                <BranchPicker
                  branches={branches}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  error={form.formState.errors.branchIds?.message}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="submit"
            disabled={pending || branches.length === 0}
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
          >
            {pending ? "Création…" : "Créer le membre"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-[48px] gap-1.5 touch-manipulation sm:h-11 sm:min-h-0"
            disabled={pending}
            render={<Link href={`/admin/organizations/${organizationId}/members`} />}
          >
            <ArrowLeft className="size-4" />
            Retour
          </Button>
        </div>
      </form>
    </Form>
  );
}
