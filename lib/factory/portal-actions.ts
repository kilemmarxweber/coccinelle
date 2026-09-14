"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { usineRoutes } from "@/lib/branch/paths";
import { notifyFactoryOrderRequestCreated } from "@/lib/factory/notifications";
import type { FactoryFinishedFamily } from "@/prisma/generated/prisma/client";

export type FactoryNotifyPrefs = {
  families?: FactoryFinishedFamily[];
  waPromo?: boolean;
  waStock?: boolean;
};

async function requireAffiliateCustomer(orgSlug: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug.trim() },
    select: { id: true, slug: true, name: true },
  });
  if (!org) throw new Error("Organisation introuvable.");

  const customer = await prisma.factoryCustomer.findFirst({
    where: {
      userId: session.user.id,
      active: true,
      branch: { organizationId: org.id, type: "USINE", status: "ACTIVE" },
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          customerUiPrimary: true,
          customerUiBackground: true,
          customerUiCard: true,
        },
      },
    },
  });
  if (!customer) {
    throw new Error("Aucun compte affilié lié à cette usine.");
  }
  return { session, org, customer };
}

function portalBase(orgSlug: string) {
  return `/${orgSlug}/usine-affilie`;
}

export async function getAffiliatePortalContextAction(orgSlug: string) {
  try {
    const { org, customer, session } = await requireAffiliateCustomer(orgSlug);
    return {
      ok: true as const,
      org,
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
      customer: {
        id: customer.id,
        name: customer.name,
        companyName: customer.companyName,
        contactName: customer.contactName,
        phone: customer.phone,
        email: customer.email,
        deliveryAddress: customer.deliveryAddress,
        deliveryCity: customer.deliveryCity,
        notifyPrefs: (customer.notifyPrefs as FactoryNotifyPrefs | null) ?? null,
        branchId: customer.branchId,
        branchName: customer.branch.name,
        organizationId: customer.branch.organizationId,
      },
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Accès refusé.",
    };
  }
}

export async function getAffiliateDashboardAction(orgSlug: string) {
  const { customer } = await requireAffiliateCustomer(orgSlug);
  const [credits, reservations, requests] = await Promise.all([
    prisma.factoryCredit.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { lines: true },
    }),
    prisma.factoryReservation.findMany({
      where: { customerId: customer.id, status: "HOLD" },
      orderBy: { holdUntil: "asc" },
      include: { lines: { include: { shopProduct: { select: { name: true } } } } },
    }),
    prisma.factoryOrderRequest.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { lines: true },
    }),
  ]);

  return {
    credits: credits.map((c) => ({
      id: c.id,
      number: c.number,
      status: c.status,
      totalUsd: c.totalUsd,
      paidUsd: c.paidUsd,
      remainingUsd: Math.round((c.totalUsd - c.paidUsd) * 100) / 100,
      dueAt: c.dueAt,
      requestedDeliveryAt: c.requestedDeliveryAt,
      deliveryAddress: c.deliveryAddress,
      lines: c.lines.map((l) => ({
        name: l.nameSnapshot,
        qty: l.qty,
      })),
    })),
    reservations: reservations.map((r) => ({
      id: r.id,
      holdUntil: r.holdUntil,
      lines: r.lines.map((l) => ({
        name: l.shopProduct.name,
        qty: l.qty,
      })),
    })),
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      requestedDeliveryAt: r.requestedDeliveryAt,
      rejectReason: r.rejectReason,
      lines: r.lines.map((l) => ({
        name: l.nameSnapshot,
        qty: l.qty,
      })),
    })),
  };
}

export async function listAffiliateCatalogAction(orgSlug: string) {
  const { customer } = await requireAffiliateCustomer(orgSlug);
  return prisma.shopProduct.findMany({
    where: {
      branchId: customer.branchId,
      active: true,
      productKind: "FINISHED",
    },
    select: {
      id: true,
      name: true,
      price: true,
      finishedFamily: true,
      sku: true,
    },
    orderBy: [{ finishedFamily: "asc" }, { name: "asc" }],
  });
}

export async function createAffiliateOrderRequestAction(input: {
  orgSlug: string;
  lines: { shopProductId: string; qty: number }[];
  requestedDeliveryAt?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  notes?: string;
}) {
  const { customer, org } = await requireAffiliateCustomer(input.orgSlug);
  if (!input.lines.length) throw new Error("Ajoutez au moins un produit.");

  const products = await prisma.shopProduct.findMany({
    where: {
      branchId: customer.branchId,
      productKind: "FINISHED",
      active: true,
      id: { in: input.lines.map((l) => l.shopProductId) },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = input.lines.map((l) => {
    const p = byId.get(l.shopProductId);
    if (!p) throw new Error("Produit introuvable.");
    const qty = Math.max(1, Math.floor(l.qty));
    return {
      shopProductId: p.id,
      nameSnapshot: p.name,
      qty,
      unitPriceUsd: p.price,
    };
  });

  let requestedDeliveryAt: Date | null = null;
  if (input.requestedDeliveryAt) {
    requestedDeliveryAt = new Date(input.requestedDeliveryAt);
    if (Number.isNaN(requestedDeliveryAt.getTime())) {
      throw new Error("Date de livraison invalide.");
    }
  }

  const req = await prisma.factoryOrderRequest.create({
    data: {
      branchId: customer.branchId,
      customerId: customer.id,
      status: "PENDING",
      requestedDeliveryAt,
      deliveryAddress:
        input.deliveryAddress?.trim() || customer.deliveryAddress || null,
      deliveryCity:
        input.deliveryCity?.trim() || customer.deliveryCity || null,
      notes: input.notes?.trim() || null,
      lines: { create: lines },
    },
    include: { lines: true },
  });

  const qtyLabel = lines.map((l) => `${l.qty}× ${l.nameSnapshot}`).join(", ");
  void notifyFactoryOrderRequestCreated({
    branchId: customer.branchId,
    requestId: req.id,
    customerName: customer.name,
    phone: customer.phone,
    qtyLabel,
    href: usineRoutes.demandes(org.id, customer.branchId),
  });

  revalidatePath(portalBase(input.orgSlug));
  revalidatePath(`${portalBase(input.orgSlug)}/demande`);
  revalidatePath(usineRoutes.demandes(org.id, customer.branchId));
  return req;
}

export async function updateAffiliateNotifyPrefsAction(input: {
  orgSlug: string;
  prefs: FactoryNotifyPrefs;
}) {
  const { customer } = await requireAffiliateCustomer(input.orgSlug);
  const families = (input.prefs.families ?? []).filter(
    (f): f is FactoryFinishedFamily => f === "EAU" || f === "VIN",
  );
  const prefs: FactoryNotifyPrefs = {
    families,
    waPromo: Boolean(input.prefs.waPromo),
    waStock: Boolean(input.prefs.waStock),
  };
  await prisma.factoryCustomer.update({
    where: { id: customer.id },
    data: { notifyPrefs: prefs as object },
  });
  revalidatePath(`${portalBase(input.orgSlug)}/preferences`);
  return prefs;
}
