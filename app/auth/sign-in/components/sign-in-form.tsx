"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
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
import { signInSchema, type SignInValues } from "@/app/auth/schema";

export function SignInForm() {
  const router = useRouter();

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

      const redirectRes = await fetch("/api/auth/post-login-redirect", {
        credentials: "include",
      });
      const redirectBody = (await redirectRes.json()) as { path?: string };
      const destination =
        redirectRes.ok && redirectBody.path ? redirectBody.path : "/admin";

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
    <Form {...form}>
      <form
        method="post"
        className="flex flex-col gap-5 p-5 md:p-7"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
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
                  autoCapitalize="none"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="vous@eglise.example"
                  className="h-11"
                  disabled={isSubmitting}
                />
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
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  className="h-11"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root?.message ? (
          <p className="text-xs text-destructive" role="alert">
            {String(form.formState.errors.root.message)}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/auth/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Créer un compte
          </Link>
        </p>

       
      </form>
    </Form>
  );
}
