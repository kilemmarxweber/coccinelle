import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { safeAuthCallbackUrl } from "@/lib/auth/safe-callback-url";
import { SignUpForm } from "./components/sign-up-form";

export const metadata: Metadata = {
  title: "Créer un compte — Coccinelle",
  description: "Inscription à Coccinelle.",
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeAuthCallbackUrl(params.callbackUrl, "");

  return (
    <AuthShell mode="sign-up">
      <SignUpForm callbackUrl={callbackUrl || undefined} />
    </AuthShell>
  );
}
