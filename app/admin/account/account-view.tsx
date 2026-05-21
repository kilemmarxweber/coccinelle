"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Camera, Globe, KeyRound, Lock, Mail, MessageCircleWarning, User } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  LOCALE_OPTIONS,
  readLocalePreference,
  writeLocalePreference,
  type LocalePreference,
} from "@/lib/locale-preference";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { Select } from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  changeEmailSchema,
  changePasswordSchema,
  updateProfileSchema,
  type ChangeEmailValues,
  type ChangePasswordValues,
  type UpdateProfileValues,
} from "./schema";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const SUPPORT_EMAIL = "support@coccinelle.cd";

type AccountViewProps = {
  memberSince: string | null;
  organizationName: string | null;
  organizationRole: string | null;
  userCreatedAt: string;
};

function getUserInitials(name?: string | null, email?: string | null) {
  const display = name?.trim() || email?.split("@")[0] || "U";
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return display.charAt(0).toUpperCase();
}

function formatDateFr(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function AccountView({
  memberSince,
  organizationName,
  organizationRole,
  userCreatedAt,
}: AccountViewProps) {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [locale, setLocale] = useState<LocalePreference>("fr");

  useEffect(() => {
    setLocale(readLocalePreference());
  }, []);

  const profileForm = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: "", image: "" },
  });

  const emailForm = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "" },
  });

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      name: user.name ?? "",
      image: user.image ?? "",
    });
    emailForm.reset({ newEmail: user.email ?? "" });
  }, [user, profileForm, emailForm]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:max-w-4xl md:px-6">
        <p className="text-sm text-muted-foreground">Chargement du compte…</p>
      </div>
    );
  }

  const initials = getUserInitials(user.name, user.email);
  const memberSinceLabel = memberSince ? formatDateFr(memberSince) : null;
  const accountSinceLabel = formatDateFr(userCreatedAt);

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > 512_000) {
      toast.error("Image trop volumineuse (max. 512 Ko).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Lecture impossible."));
      reader.readAsDataURL(file);
    });
    const { error } = await authClient.updateUser({ image: dataUrl });
    if (error) {
      toast.error(error.message ?? "Impossible de mettre à jour la photo.");
      return;
    }
    toast.success("Photo de profil mise à jour.");
    await refetch();
  }

  async function onProfileSubmit(values: UpdateProfileValues) {
    const { error } = await authClient.updateUser({
      name: values.name.trim(),
      image: values.image?.trim() || undefined,
    });
    if (error) {
      toast.error(error.message ?? "Mise à jour impossible.");
      return;
    }
    toast.success("Profil mis à jour.");
    setProfileOpen(false);
    await refetch();
  }

  async function onEmailSubmit(values: ChangeEmailValues) {
    const { error } = await authClient.changeEmail({
      newEmail: values.newEmail.trim(),
      callbackURL: "/admin/account",
    });
    if (error) {
      toast.error(error.message ?? "Changement d’email impossible.");
      return;
    }
    toast.success("Vérifiez votre boîte mail pour confirmer le nouvel email.");
    setEmailOpen(false);
  }

  async function onPasswordSubmit(values: ChangePasswordValues) {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      toast.error(error.message ?? "Mot de passe non modifié.");
      return;
    }
    toast.success("Mot de passe modifié.");
    passwordForm.reset();
    setPasswordOpen(false);
  }

  function handleLocaleChange(value: string) {
    const next = value === "en" ? "en" : "fr";
    setLocale(next);
    writeLocalePreference(next);
    toast.success(next === "fr" ? "Langue : français" : "Language: English");
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] md:max-w-4xl md:px-6">
      <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-6 text-center">
        <button
          type="button"
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Changer la photo de profil"
        >
          <Avatar className="size-20">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? "Profil"} /> : null}
            <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
            <Camera className="size-4" aria-hidden />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            e.target.value = "";
          }}
        />
        <div>
          <h2 className="text-lg font-semibold leading-tight">{user.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
          {organizationName ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {organizationRole ? `${orgRoleLabel(organizationRole)} · ` : ""}
              {organizationName}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {memberSince
              ? `Membre depuis le ${memberSinceLabel}`
              : `Compte créé le ${accountSinceLabel}`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
          Modifier le profil
        </Button>
      </section>

      <ListGroup title="Compte">
        <ListItem
          title="Nom et photo"
          subtitle={user.name}
          leading={<User className="size-5 text-muted-foreground" />}
          onClick={() => setProfileOpen(true)}
        />
        <ListItem
          title="Adresse email"
          subtitle={user.email}
          leading={<Mail className="size-5 text-muted-foreground" />}
          onClick={() => setEmailOpen(true)}
        />
        <ListItem
          title="Langue"
          subtitle={LOCALE_OPTIONS.find((o) => o.value === locale)?.label}
          leading={<Globe className="size-5 text-muted-foreground" />}
          trailing={
            <Select
              className="h-9 w-[7.5rem] shrink-0"
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              aria-label="Langue de l’interface"
            >
              {LOCALE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          }
          showChevron={false}
        />
        <ListItem
          title="Mot de passe"
          subtitle="Modifier votre mot de passe"
          leading={<KeyRound className="size-5 text-muted-foreground" />}
          onClick={() => setPasswordOpen(true)}
        />
      </ListGroup>

      <ListGroup title="Application">
        <ListItem
          title="Confidentialité"
          subtitle="Politique de protection des données"
          leading={<Lock className="size-5 text-muted-foreground" />}
          href="/admin/help"
        />
        <ListItem title="Version" subtitle={`Coccinelle v${APP_VERSION}`} showChevron={false} />
        <ListItem
          title="Signaler un souci"
          subtitle="Contactez le support"
          leading={<MessageCircleWarning className="size-5 text-muted-foreground" />}
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Signalement Coccinelle")}`}
        />
      </ListGroup>

      <ResponsiveDialog open={profileOpen} onOpenChange={setProfileOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Profil</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Nom affiché et URL de photo (optionnel).
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...profileForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
            >
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11" autoComplete="name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de la photo (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-11"
                        placeholder="https://…"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={profileForm.formState.isSubmitting}
                >
                  {profileForm.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={emailOpen} onOpenChange={setEmailOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Adresse email</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Un lien de confirmation sera envoyé à la nouvelle adresse.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...emailForm}>
            <form className="flex flex-col gap-4" onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
              <FormField
                control={emailForm.control}
                name="newEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouvel email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" className="h-11" autoComplete="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={emailForm.formState.isSubmitting}
                >
                  {emailForm.formState.isSubmitting ? "Envoi…" : "Confirmer"}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mot de passe</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Les autres sessions seront déconnectées après le changement.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...passwordForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe actuel</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-11"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-11"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-11"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ResponsiveDialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={passwordForm.formState.isSubmitting}
                >
                  {passwordForm.formState.isSubmitting ? "Mise à jour…" : "Changer le mot de passe"}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
