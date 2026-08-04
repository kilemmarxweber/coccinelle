import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { safeAuthCallbackUrl } from "@/lib/auth/safe-callback-url";
import { SignInForm } from "./components/sign-in-form";

export const metadata: Metadata = {
  title: "Connexion — Coccinelle",
  description: "Connectez-vous à Coccinelle Voyage.",
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeAuthCallbackUrl(params.callbackUrl, "");

  return (
    <AuthShell mode="sign-in">
      <SignInForm callbackUrl={callbackUrl || undefined} />
    </AuthShell>
  );
}
