import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "./components/sign-up-form";

export const metadata: Metadata = {
  title: "Créer un compte — Smart Church",
  description: "Inscription à EgliseManager.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      headline="Créer un compte"
      description="Un administrateur peut aussi créer votre compte ; cette page permet de s’inscrire tout seul si l’organisation l’autorise."
    >
      <SignUpForm />
    </AuthShell>
  );
}
