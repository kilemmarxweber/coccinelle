import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignInForm } from "./components/sign-in-form";

export const metadata: Metadata = {
  title: "Connexion — Coccinelle",
  description: "Connectez-vous à Coccinelle.",
};

export default function SignInPage() {
  return (
    <AuthShell
      headline="Connexion"
      description="Saisissez vos identifiants pour accéder à l’espace d’administration."
    >
      <SignInForm />
    </AuthShell>
  );
}
