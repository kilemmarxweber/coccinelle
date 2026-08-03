import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignInForm } from "./components/sign-in-form";

export const metadata: Metadata = {
  title: "Connexion — Coccinelle",
  description: "Connectez-vous à Coccinelle Voyage.",
};

export default function SignInPage() {
  return (
    <AuthShell mode="sign-in">
      <SignInForm />
    </AuthShell>
  );
}
