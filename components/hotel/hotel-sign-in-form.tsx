"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { BedDouble, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { signInSchema, type SignInValues } from "@/app/auth/schema";
import { Checkbox } from "@/components/ui/checkbox";
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

type HotelSignInFormProps = {
  orgSlug: string;
  hotelName?: string;
  /** Retour funnel hôtel — chemin relatif déjà validé côté page. */
  callbackUrl?: string;
};

export function HotelSignInForm({
  orgSlug,
  hotelName,
  callbackUrl,
}: HotelSignInFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: SignInValues) {
    form.clearErrors("root");
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        rememberMe,
      });

      if (error) {
        form.setError("root", {
          type: "server",
          message:
            error.message ??
            "Connexion impossible. Vérifiez vos identifiants.",
        });
        toast.error(
          error.message ??
            "Connexion impossible. Vérifiez vos identifiants.",
        );
        return;
      }

      toast.success("Bienvenue !");

      let destination = callbackUrl;
      if (!destination) {
        const redirectRes = await fetch(
          `/api/auth/hotel-post-login-redirect?orgSlug=${encodeURIComponent(orgSlug)}`,
          { credentials: "include" },
        );
        const redirectBody = (await redirectRes.json()) as { path?: string };
        destination =
          redirectRes.ok && redirectBody.path
            ? redirectBody.path
            : clientHotelRoutes.mesSejours(orgSlug);
      }

      router.refresh();
      router.push(destination);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Erreur réseau.";
      form.setError("root", {
        type: "server",
        message:
          "Connexion au serveur impossible. Même origine que la page (localhost vs 127.0.0.1) ou réseau à vérifier.",
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
          Connexion
        </h1>
        <p className="text-sm text-muted-foreground">
          Accédez à vos séjours, réservations et commandes room service.
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
                      spellCheck={false}
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
                      autoComplete="current-password"
                      placeholder="Votre mot de passe"
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

          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-white/20 data-checked:border-primary data-checked:bg-primary"
              />
              Se souvenir de moi
            </label>
          </div>

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
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Nouveau client ?{" "}
            <Link
              href={
                callbackUrl
                  ? clientHotelRoutes.inscriptionWithCallback(
                      orgSlug,
                      callbackUrl,
                    )
                  : clientHotelRoutes.inscription(orgSlug)
              }
              className="font-semibold text-primary transition hover:text-primary/80"
            >
              Créer un compte
            </Link>
          </p>
        </form>
      </Form>
    </div>
  );
}
