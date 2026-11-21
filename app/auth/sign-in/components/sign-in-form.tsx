"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { sessionMustChangePassword } from "@/lib/auth/must-change-password";
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
import {
  firstLoginPasswordSchema,
  signInSchema,
  type FirstLoginPasswordValues,
  type SignInValues,
} from "@/app/auth/schema";
import { completeFirstLoginPasswordAction, confirmTurnstileAction } from "@/app/auth/sign-in/actions";
import { TurnstileWidget } from "./turnstile-widget";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-12 rounded-2xl border-transparent bg-[#f3f6f4] pl-11 text-[#10231a] shadow-none placeholder:text-[#8a978f] focus-visible:border-[#1b9a4b] focus-visible:ring-[#1b9a4b]/20";

type SignInFormProps = {
  /** Retour PWA (checkout / confirmation) — chemin relatif validé côté page. */
  callbackUrl?: string;
  /** Nom affiché : l'unique organisation, ou le produit s'il n'y en a pas. */
  brandName: string;
  /** `APP_NAME` / `NEXT_PUBLIC_APP_NAME` depuis `.env`. */
  appName: string;
};

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SignInForm({ callbackUrl, brandName, appName }: SignInFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"sign-in" | "first-login">("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const firstLoginForm = useForm<FirstLoginPasswordValues>({
    resolver: zodResolver(firstLoginPasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const { isSubmitting } = form.formState;
  const hydrated = useHydrated();
  const loginBlocked = !hydrated || isSubmitting || !turnstileToken;
  const firstLoginSubmitting = firstLoginForm.formState.isSubmitting;

  useEffect(() => {
    let cancelled = false;
    void authClient.getSession().then((res) => {
      if (cancelled) return;
      if (sessionMustChangePassword(res.data)) {
        setStep("first-login");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function goAfterLogin() {
    let destination = callbackUrl;
    if (!destination) {
      const redirectRes = await fetch("/api/auth/post-login-redirect", {
        credentials: "include",
      });
      const redirectBody = (await redirectRes.json()) as { path?: string };
      destination =
        redirectRes.ok && redirectBody.path ? redirectBody.path : "/admin";
    }
    router.refresh();
    router.push(destination);
  }

  async function onSubmit(values: SignInValues) {
    form.clearErrors("root");
    if (!turnstileToken) {
      form.setError("root", {
        type: "server",
        message: "Confirmez que vous êtes humain.",
      });
      return;
    }
    const gate = await confirmTurnstileAction(turnstileToken);
    if (!gate.ok) {
      setTurnstileToken(null);
      setTurnstileKey((value) => value + 1);
      form.setError("root", { type: "server", message: gate.message });
      toast.error(gate.message);
      return;
    }
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        rememberMe,
      });

      if (error) {
        setTurnstileToken(null);
        setTurnstileKey((value) => value + 1);
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

      const sessionRes = await authClient.getSession();
      if (sessionMustChangePassword(sessionRes.data)) {
        firstLoginForm.reset({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setShowPassword(false);
        setStep("first-login");
        toast.message("Première connexion : choisissez votre mot de passe.");
        return;
      }

      toast.success("Bienvenue !");
      await goAfterLogin();
    } catch (cause) {
      setTurnstileToken(null);
      setTurnstileKey((value) => value + 1);
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

  async function onFirstLoginSubmit(values: FirstLoginPasswordValues) {
    firstLoginForm.clearErrors("root");
    const result = await completeFirstLoginPasswordAction(values);
    if (!result.ok) {
      firstLoginForm.setError("root", {
        type: "server",
        message: result.message,
      });
      toast.error(result.message);
      return;
    }
    toast.success("Mot de passe enregistré. Bienvenue !");
    await goAfterLogin();
  }

  return (
    <div className="flex w-full max-w-md flex-col" data-org={brandName}>
      <Link href="/" className="mb-5 inline-flex items-center gap-2 self-start">
        <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg">
          <img src="/favicon.ico" alt="" className="size-8" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-[0.12em] text-[#10231a]">
            {appName}
          </span>
          <span className="block text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {appName}
          </span>
        </span>
      </Link>
      {step === "first-login" ? (
        <>
          <div className="mb-4 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#10231a]">
              Première connexion
            </h1>
            <p className="text-sm text-muted-foreground">
              Saisissez l’ancien mot de passe, le nouveau, puis confirmez-le.
              Tous les caractères sont acceptés.
            </p>
          </div>

          <Form {...firstLoginForm}>
            <form
              method="post"
              className="flex flex-col gap-3.5"
              noValidate
              onSubmit={firstLoginForm.handleSubmit(onFirstLoginSubmit)}
            >
              <PasswordField
                control={firstLoginForm.control}
                name="currentPassword"
                label="Ancien mot de passe"
                autoComplete="current-password"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                disabled={firstLoginSubmitting}
              />
              <PasswordField
                control={firstLoginForm.control}
                name="newPassword"
                label="Nouveau mot de passe"
                autoComplete="new-password"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                disabled={firstLoginSubmitting}
              />
              <PasswordField
                control={firstLoginForm.control}
                name="confirmPassword"
                label="Confirmation"
                autoComplete="new-password"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                disabled={firstLoginSubmitting}
              />

              {firstLoginForm.formState.errors.root?.message ? (
                <p className="text-xs text-rose-400" role="alert">
                  {String(firstLoginForm.formState.errors.root.message)}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={firstLoginSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {firstLoginSubmitting
                  ? "Enregistrement…"
                  : "Enregistrer et continuer"}
              </button>
            </form>
          </Form>
        </>
      ) : (
        <>
          <div className="mb-7 space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-medium text-[#157a3c]">
              <span className="size-1.5 rounded-full bg-[#1b9a4b]" />
              Connexion sécurisée
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#10231a]">
              Bon retour
            </h1>
            <p className="text-center text-sm text-muted-foreground lg:text-left">
              Connectez-vous pour gérer réservations, caisse et équipes.
            </p>
          </div>

          <Form {...form}>
            <form
              method="post"
              className="flex flex-col gap-3.5"
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

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="border-[#1b9a4b]/40 data-checked:border-[#1b9a4b] data-checked:bg-[#1b9a4b]"
                  />
                  Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() =>
                    toast.message(
                      "Réinitialisation du mot de passe bientôt disponible.",
                    )
                  }
                  className="text-sm font-medium text-[#157a3c] transition hover:text-[#0e6b3c]"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <TurnstileWidget
                key={turnstileKey}
                onToken={setTurnstileToken}
              />

              {form.formState.errors.root?.message ? (
                <p className="text-center text-xs text-rose-500 lg:text-left" role="alert">
                  {String(form.formState.errors.root.message)}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loginBlocked}
                suppressHydrationWarning
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#1b9a4b] text-sm font-semibold text-white transition hover:bg-[#157a3c] disabled:opacity-60"
              >
                {isSubmitting ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}

function PasswordField({
  control,
  name,
  label,
  autoComplete,
  showPassword,
  onToggleShow,
  disabled,
}: {
  control: ReturnType<typeof useForm<FirstLoginPasswordValues>>["control"];
  name: keyof FirstLoginPasswordValues;
  label: string;
  autoComplete: string;
  showPassword: boolean;
  onToggleShow: () => void;
  disabled: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-muted-foreground">{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                {...field}
                type={showPassword ? "text" : "password"}
                autoComplete={autoComplete}
                className={cn(fieldClass, "pr-10")}
                disabled={disabled}
              />
              <button
                type="button"
                onClick={onToggleShow}
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
  );
}


