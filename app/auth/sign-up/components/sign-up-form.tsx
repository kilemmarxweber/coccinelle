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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH, signUpSchema, type SignUpValues } from "@/app/auth/schema";

export function SignUpForm() {
  const router = useRouter();
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
          message: error.message ?? "Inscription impossible. Réessayez plus tard.",
        });
        toast.error(error.message ?? "Inscription impossible. Réessayez plus tard.");
        return;
      }

      toast.success("Compte créé. Connectez-vous avec votre email.");
      router.push("/auth/sign-in");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Impossible de joindre le serveur.";
      form.setError("root", {
        type: "server",
        message:
          "Connexion au serveur impossible. Utilisez la même adresse que dans la barre d’adresse (ex. ne mélangez pas localhost et 127.0.0.1), ou vérifiez votre réseau.",
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom affiché</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  autoComplete="name"
                  placeholder="Jean Dupont"
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
                  placeholder="vous@coccinelle.example"
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
                  autoComplete="new-password"
                  className="h-11"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>Au moins {MIN_PASSWORD_LENGTH} caractères.</FormDescription>
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
          {isSubmitting ? "Création…" : "Créer mon compte"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link
            href="/auth/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </form>
    </Form>
  );
}
