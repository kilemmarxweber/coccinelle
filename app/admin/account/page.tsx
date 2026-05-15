import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AccountView } from "./account-view";

export default async function AdminAccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/sign-in?callbackUrl=/admin/account");
  }

  const orgId = session.organization?.id;
  let memberSince: string | null = null;

  if (orgId) {
    const member = await prisma.member.findFirst({
      where: { userId: session.user.id, organizationId: orgId },
      select: { createdAt: true },
    });
    memberSince = member?.createdAt.toISOString() ?? null;
  }

  const userCreatedAt =
    session.user.createdAt instanceof Date
      ? session.user.createdAt.toISOString()
      : String(session.user.createdAt ?? new Date().toISOString());

  return (
    <AccountView
      memberSince={memberSince}
      organizationName={session.organization?.name ?? null}
      organizationRole={session.organization?.role ?? null}
      userCreatedAt={userCreatedAt}
    />
  );
}
