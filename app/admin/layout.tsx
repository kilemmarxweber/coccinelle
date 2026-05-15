import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminTopBar } from "@/components/layout/admin-top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) redirect("/auth/sign-in");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AdminTopBar />
      <main className="flex-1 pb-[76px] md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
