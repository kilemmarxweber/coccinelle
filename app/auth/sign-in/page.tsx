import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { appName } from "@/lib/app-name";
import { safeAuthCallbackUrl } from "@/lib/auth/safe-callback-url";
import { SignInForm } from "./components/sign-in-form";

export const metadata: Metadata = {
  title: `Connexion — ${appName()}`,
  description: `Connectez-vous à ${appName()}.`,
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeAuthCallbackUrl(params.callbackUrl, "");

  const name = appName();

  return (
    <AuthShell mode="sign-in" appName={name}>
      <SignInForm
        callbackUrl={callbackUrl || undefined}
        appName={name}
      />
    </AuthShell>
  );
}
