"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail, Plane, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  MIN_PASSWORD_LENGTH,
  signUpSchema,
  type SignUpValues,
} from "@/app/auth/schema";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-xl border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-primary/25";

type SignUpFormProps = {
  callbackUrl?: string;
};

export function SignUpForm({ callbackUrl }: SignUpFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: SignUpValues) {
    form.clearErrors("root");
    try {
      const { error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
        callbackURL: "/auth/sign-in",
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
      const signInHref = callbackUrl
        ? `/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "/auth/sign-in";
      router.push(signInHref);
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

  function notifySocialSoon() {
    toast.message("Connexion sociale bientôt disponible.");
  }

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="mb-8 inline-flex items-center gap-2.5 self-start">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Plane className="size-4" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-[0.12em] text-foreground uppercase">
            Coccinelle
          </span>
          <span className="block text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            v 0.1
          </span>
        </span>
      </Link>

      <div className="mb-7 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Créer un compte
        </h1>
        <p className="text-sm text-muted-foreground">
          Rejoignez la console Coccinelle pour gérer vos commandes, réservations et demandes de service.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={notifySocialSoon}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-input text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <GoogleIcon />
          Google
        </button>
        <button
          type="button"
          onClick={notifySocialSoon}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-input text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <GitHubIcon />
          GitHub
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou continuer avec l&apos;email</span>
        <div className="h-px flex-1 bg-border" />
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
                <FormLabel className="text-muted-foreground">Nom affiché</FormLabel>
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
                      placeholder="vous@coccinelle.cd"
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
                <FormLabel className="text-muted-foreground">Mot de passe</FormLabel>
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
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-muted-foreground"
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
              href={
                callbackUrl
                  ? `/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : "/auth/sign-in"
              }
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.7.5-2.4 1.9C5.2 19.4 8.4 21.4 12 21.4c2.4 0 4.4-.8 5.9-2.2l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.4z"
      />
      <path
        fill="#4A90E2"
        d="M3.5 7.3C2.7 8.9 2.3 10.6 2.3 12.4s.4 3.5 1.2 5.1l3.1-2.4c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3.5 7.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.3c1.3 0 2.5.5 3.4 1.3l2.5-2.5C16.4 2.6 14.4 1.8 12 1.8 8.4 1.8 5.2 3.8 3.5 7.3l3.1 2.4C7.3 7.7 9.1 5.3 12 5.3z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-white" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.85 0 1.7.12 2.5.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.48A10.05 10.05 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
