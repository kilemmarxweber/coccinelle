"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath, moduleForBranchType } from "@/lib/branch/paths";
import { prisma } from "@/lib/prisma";
import {
  type BranchPartnerDTO,
  type PartnerPayTiming,
} from "@/lib/partners/types";

async function partnerCtx(organizationId: string, branchId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    throw new Error("Branche inaccessible.");
  }
  return { user: session.user, branch };
}

function revalidatePartners(organizationId: string, branchId: string, type: string) {
  const base = branchBasePath(organizationId, branchId);
  const mod = moduleForBranchType(type);
  revalidatePath(`${base}/hotel/partenaires`);
  revalidatePath(`${base}/agence/clients`);
  revalidatePath(`${base}/hotel/sejours`);
  revalidatePath(base);
  if (mod === "hotel") revalidatePath(`${base}/hotel`);
  if (mod === "agence") revalidatePath(`${base}/agence`);
}

function toDto(p: {
  id: string;
  branchId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  taxId: string | null;
  notes: string | null;
  status: string;
  defaultUnitPriceHint: number | null;
  defaultDiscountPctHint: number | null;
  createdAt: Date;
  updatedAt: Date;
}): BranchPartnerDTO {
  return {
    ...p,
    status: p.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

function assertPartnerInput(input: {
  name: string;
  address: string;
  city: string;
}) {
  const name = input.name.trim();
  const address = input.address.trim();
  const city = input.city.trim();
  if (!name) throw new Error("Nom / raison sociale obligatoire.");
  if (!address) throw new Error("Adresse obligatoire.");
  if (!city) throw new Error("Ville obligatoire.");
  return { name, address, city };
}

export async function listBranchPartnersAction(
  organizationId: string,
  branchId: string,
  opts?: { q?: string; includeInactive?: boolean },
): Promise<BranchPartnerDTO[]> {
  await partnerCtx(organizationId, branchId);
  const q = opts?.q?.trim();
  const rows = await prisma.branchPartner.findMany({
    where: {
      branchId,
      ...(opts?.includeInactive ? {} : { status: "ACTIVE" }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
  });
  return rows.map(toDto);
}

export async function getBranchPartnerAction(
  organizationId: string,
  branchId: string,
  partnerId: string,
): Promise<BranchPartnerDTO | null> {
  await partnerCtx(organizationId, branchId);
  const row = await prisma.branchPartner.findFirst({
    where: { id: partnerId, branchId },
  });
  return row ? toDto(row) : null;
}

export async function createBranchPartnerAction(input: {
  organizationId: string;
  branchId: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address: string;
  city: string;
  taxId?: string | null;
  notes?: string | null;
  defaultUnitPriceHint?: number | null;
  defaultDiscountPctHint?: number | null;
}): Promise<BranchPartnerDTO> {
  const { branch } = await partnerCtx(input.organizationId, input.branchId);
  const core = assertPartnerInput(input);
  const row = await prisma.branchPartner.create({
    data: {
      branchId: input.branchId,
      ...core,
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      taxId: input.taxId?.trim() || null,
      notes: input.notes?.trim() || null,
      defaultUnitPriceHint:
        input.defaultUnitPriceHint != null &&
        Number.isFinite(input.defaultUnitPriceHint)
          ? Number(input.defaultUnitPriceHint)
          : null,
      defaultDiscountPctHint:
        input.defaultDiscountPctHint != null &&
        Number.isFinite(input.defaultDiscountPctHint)
          ? Number(input.defaultDiscountPctHint)
          : null,
    },
  });
  revalidatePartners(input.organizationId, input.branchId, branch.type);
  return toDto(row);
}

export async function updateBranchPartnerAction(input: {
  organizationId: string;
  branchId: string;
  partnerId: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address: string;
  city: string;
  taxId?: string | null;
  notes?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  defaultUnitPriceHint?: number | null;
  defaultDiscountPctHint?: number | null;
}): Promise<BranchPartnerDTO> {
  const { branch } = await partnerCtx(input.organizationId, input.branchId);
  const existing = await prisma.branchPartner.findFirst({
    where: { id: input.partnerId, branchId: input.branchId },
  });
  if (!existing) throw new Error("Partenaire introuvable.");
  const core = assertPartnerInput(input);
  const row = await prisma.branchPartner.update({
    where: { id: existing.id },
    data: {
      ...core,
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      taxId: input.taxId?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      defaultUnitPriceHint:
        input.defaultUnitPriceHint != null &&
        Number.isFinite(input.defaultUnitPriceHint)
          ? Number(input.defaultUnitPriceHint)
          : null,
      defaultDiscountPctHint:
        input.defaultDiscountPctHint != null &&
        Number.isFinite(input.defaultDiscountPctHint)
          ? Number(input.defaultDiscountPctHint)
          : null,
    },
  });
  revalidatePartners(input.organizationId, input.branchId, branch.type);
  return toDto(row);
}

export async function setBranchPartnerStatusAction(input: {
  organizationId: string;
  branchId: string;
  partnerId: string;
  status: "ACTIVE" | "INACTIVE";
}): Promise<void> {
  const { branch } = await partnerCtx(input.organizationId, input.branchId);
  const existing = await prisma.branchPartner.findFirst({
    where: { id: input.partnerId, branchId: input.branchId },
  });
  if (!existing) throw new Error("Partenaire introuvable.");
  await prisma.branchPartner.update({
    where: { id: existing.id },
    data: { status: input.status },
  });
  revalidatePartners(input.organizationId, input.branchId, branch.type);
}

export async function assertPartnerReadyForCredit(
  branchId: string,
  partnerId: string,
) {
  const p = await prisma.branchPartner.findFirst({
    where: { id: partnerId, branchId, status: "ACTIVE" },
  });
  if (!p) throw new Error("Partenaire introuvable ou inactif.");
  if (!p.address?.trim() || !p.city?.trim()) {
    throw new Error("Adresse partenaire incomplète.");
  }
  return p;
}

export async function nextPartnerBookingCode(branchId: string): Promise<string> {
  const count = await prisma.partnerBooking.count({ where: { branchId } });
  return `PRT-${String(count + 1).padStart(5, "0")}`;
}

export async function createPartnerBookingAction(input: {
  organizationId: string;
  branchId: string;
  partnerId: string;
  label?: string | null;
  payTiming?: PartnerPayTiming;
  notes?: string | null;
}): Promise<{ id: string; code: string }> {
  const { user, branch } = await partnerCtx(
    input.organizationId,
    input.branchId,
  );
  await assertPartnerReadyForCredit(input.branchId, input.partnerId);
  const code = await nextPartnerBookingCode(input.branchId);
  const booking = await prisma.partnerBooking.create({
    data: {
      branchId: input.branchId,
      partnerId: input.partnerId,
      code,
      label: input.label?.trim() || null,
      payTiming:
        input.payTiming === "PREPAID" ? "PREPAID" : "AT_CHECKOUT",
      notes: input.notes?.trim() || null,
      createdByUserId: user.id,
      status: "CONFIRMED",
    },
  });
  revalidatePartners(input.organizationId, input.branchId, branch.type);
  return { id: booking.id, code: booking.code };
}

export async function listPartnerBookingsAction(
  organizationId: string,
  branchId: string,
  partnerId?: string,
) {
  await partnerCtx(organizationId, branchId);
  return prisma.partnerBooking.findMany({
    where: {
      branchId,
      ...(partnerId ? { partnerId } : {}),
    },
    include: {
      partner: { select: { id: true, name: true } },
      stays: {
        select: {
          id: true,
          guestName: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          room: { select: { number: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
