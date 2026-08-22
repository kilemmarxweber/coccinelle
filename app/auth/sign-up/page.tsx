import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { appName } from "@/lib/app-name";
import { safeAuthCallbackUrl } from "@/lib/auth/safe-callback-url";
import { SignUpForm } from "./components/sign-up-form";

export const metadata: Metadata = {
  title: `Créer un compte — ${appName()}`,
  description: `Inscription à ${appName()}.`,
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeAuthCallbackUrl(params.callbackUrl, "");
  const name = appName();

  return (
    <AuthShell mode="sign-up" appName={name}>
      <SignUpForm callbackUrl={callbackUrl || undefined} appName={name} />
    </AuthShell>
  );
}
