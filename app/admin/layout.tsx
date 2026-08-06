import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) redirect("/auth/sign-in");

  return <AdminShell>{children}</AdminShell>;
}
