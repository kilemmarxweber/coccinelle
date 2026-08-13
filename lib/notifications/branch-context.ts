import prisma from "@/lib/prisma";

export type NotificationBranchContext = {
  id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  timezone: string;
};

const APP_NAME = () => process.env.APP_NAME?.trim() || "Coccinelle";

function fallbackBranch(): NotificationBranchContext {
  return {
    id: null,
    name: APP_NAME(),
    phone: null,
    email: null,
    address: null,
    city: null,
    timezone: "Africa/Kinshasa",
  };
}

function mapBranch(row: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  timezone: string;
}): NotificationBranchContext {
  return {
    id: row.id,
    name: row.name.trim() || APP_NAME(),
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    timezone: row.timezone || "Africa/Kinshasa",
  };
}

export async function resolveNotificationBranch(input: {
  branchId?: string | null;
}): Promise<NotificationBranchContext> {
  const id = input.branchId?.trim();
  if (!id) return fallbackBranch();
  const row = await prisma.branch.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      timezone: true,
    },
  });
  if (!row) return fallbackBranch();
  return mapBranch(row);
}

/** Branche primaire du membre org, sinon première ACTIVE. */
export async function resolveMemberPrimaryBranch(input: {
  memberId?: string | null;
  branchId?: string | null;
}): Promise<NotificationBranchContext> {
  if (input.branchId?.trim()) {
    return resolveNotificationBranch({ branchId: input.branchId });
  }
  const memberId = input.memberId?.trim();
  if (!memberId) return fallbackBranch();

  const primary = await prisma.branchMember.findFirst({
    where: { memberId, status: "ACTIVE", isPrimary: true },
    select: {
      branch: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          city: true,
          timezone: true,
        },
      },
    },
  });
  if (primary?.branch) return mapBranch(primary.branch);

  const first = await prisma.branchMember.findFirst({
    where: { memberId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      branch: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          city: true,
          timezone: true,
        },
      },
    },
  });
  if (first?.branch) return mapBranch(first.branch);
  return fallbackBranch();
}

export function branchSignature(branch: NotificationBranchContext): string {
  return `— ${branch.name}`;
}

export function branchContactLines(branch: NotificationBranchContext): string[] {
  const lines: string[] = [];
  if (branch.phone?.trim()) lines.push(`Tél. : ${branch.phone.trim()}`);
  if (branch.address?.trim() || branch.city?.trim()) {
    lines.push(
      [branch.address?.trim(), branch.city?.trim()].filter(Boolean).join(", "),
    );
  }
  return lines;
}
