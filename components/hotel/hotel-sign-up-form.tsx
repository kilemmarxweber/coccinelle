"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { BedDouble, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  MIN_PASSWORD_LENGTH,
  signUpSchema,
  type SignUpValues,
} from "@/app/auth/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-xl border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-primary/25";

type HotelSignUpFormProps = {
  orgSlug: string;
  hotelName?: string;
  callbackUrl?: string;
};

export function HotelSignUpForm({
  orgSlug,
  hotelName,
  callbackUrl,
}: HotelSignUpFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  const connexionHref = callbackUrl
    ? clientHotelRoutes.connexionWithCallback(orgSlug, callbackUrl)
    : clientHotelRoutes.connexion(orgSlug);

  async function onSubmit(values: SignUpValues) {
    form.clearErrors("root");
    try {
      const { error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
        callbackURL: clientHotelRoutes.connexion(orgSlug),
      });

      if (error) {
        form.setError("root", {
          type: "server",
          message:
            error.message ??
            "Inscription impossible. Réessayez plus tard.",
        });
        toast.error(
          error.message ?? "Inscription impossible. Réessayez plus tard.",
        );
        return;
      }

      toast.success("Compte créé. Connectez-vous avec votre email.");
      router.push(connexionHref);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Impossible de joindre le serveur.";
      form.setError("root", {
        type: "server",
        message:
          "Connexion au serveur impossible. Utilisez la même adresse que dans la barre d’adresse (ex. ne mélangez pas localhost et 127.0.0.1), ou vérifiez votre réseau.",
      });
      toast.error(message);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Link
        href={clientHotelRoutes.root(orgSlug)}
        className="mb-8 inline-flex items-center gap-2.5 self-start"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BedDouble className="size-4" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-[0.12em] text-foreground uppercase">
            {hotelName ?? "Coccinelle"}
          </span>
          <span className="block text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Espace hôtel
          </span>
        </span>
      </Link>

      <div className="mb-7 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Créer un compte
        </h1>
        <p className="text-sm text-muted-foreground">
          Réservez une chambre, suivez vos séjours et commandez en room service.
        </p>
      </div>

      <Form {...form}>
        <form
          method="post"
          className="flex flex-col gap-5"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">
                  Nom affiché
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...field}
                      type="text"
                      autoComplete="name"
                      placeholder="Jean Dupont"
                      className={fieldClass}
                      disabled={isSubmitting}
                    />
                  </div>
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
                <FormLabel className="text-muted-foreground">Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...field}
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="vous@email.com"
                      className={fieldClass}
                      disabled={isSubmitting}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">
                  Mot de passe
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder={`Au moins ${MIN_PASSWORD_LENGTH} caractères`}
                      className={cn(fieldClass, "pr-10")}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root?.message ? (
            <p className="text-xs text-rose-400" role="alert">
              {String(form.formState.errors.root.message)}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Création…" : "Créer mon compte"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link
              href={connexionHref}
              className="font-semibold text-primary transition hover:text-primary/80"
            >
              Se connecter
            </Link>
          </p>
        </form>
      </Form>
    </div>
  );
}
