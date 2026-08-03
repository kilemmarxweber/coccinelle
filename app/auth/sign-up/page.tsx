import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "./components/sign-up-form";

export const metadata: Metadata = {
  title: "Créer un compte — Coccinelle",
  description: "Inscription à Coccinelle Voyage.",
};

export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <SignUpForm />
    </AuthShell>
  );
}
