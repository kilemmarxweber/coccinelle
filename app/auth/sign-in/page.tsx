import type { Metadata } from "next";
import { appName } from "@/lib/app-name";
import { safeAuthCallbackUrl } from "@/lib/auth/safe-callback-url";
import prisma from "@/lib/prisma";
import { SignInScreen } from "./components/sign-in-screen";

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
  const fallback = appName();

  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      _count: { select: { branches: true } },
    },
  });
  const counts = new Map<string, number>();
  for (const org of organizations) {
    const name = org.name.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + org._count.branches);
  }
  const orgs = [...counts.entries()].map(([name, branchCount]) => ({
    name,
    branchCount,
  }));

  return (
    <SignInScreen
      orgs={orgs.length > 0 ? orgs : [{ name: fallback, branchCount: 0 }]}
      appName={fallback}
      callbackUrl={callbackUrl || undefined}
    />
  );
}
