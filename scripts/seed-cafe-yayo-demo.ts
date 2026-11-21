/**
 * Démo CAFE YAYO : org campus, 6 départements, ventes, production,
 * clôtures + versements caisse centrale.
 *
 *   pnpm exec tsx scripts/seed-cafe-yayo-demo.ts
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { bootstrapBranchByType } from "@/lib/branch/bootstrap-branch";
import { deriveHospitalityBranch } from "@/lib/branch/hospitality";
import { deriveShopFlags } from "@/lib/branch/agency-shop";
import { deriveFactoryFlags } from "@/lib/branch/usine";
import {
  withYayoVertical,
  YAYO_DEPARTMENTS,
  type YayoDepartmentTemplate,
} from "@/lib/org/yayo";
import {
  ensureOrgCashAccount,
  prepareRemittanceFromSession,
  receiveRemittance,
} from "@/lib/central-cash/service";

const ORG_NAME = "CAFE YAYO";
const ORG_SLUG = "cafe-yayo";
const ROOT_EMAIL = "kilemmarxweber@gmail.com";
const RATE = 2850;
const DEMO_NOTE = "DEMO-YAYO";

const TARGETS: Record<string, number> = {
  MMKT: 400,
  BOIS: 250,
  FFOD: 350,
  BUFF: 500,
  CREM: 200,
  CHAR: 300,
};

async function ensureOrg(userId: string) {
  let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: randomUUID().replace(/-/g, "").slice(0, 32),
        name: ORG_NAME,
        slug: ORG_SLUG,
        createdAt: new Date(),
        metadata: withYayoVertical(null, true),
      },
    });
    console.log("Organisation créée", org.id);
  } else {
    await prisma.organization.update({
      where: { id: org.id },
      data: { metadata: withYayoVertical(org.metadata, true), name: ORG_NAME },
    });
    console.log("Organisation existante", org.id);
  }

  const existingMember = await prisma.member.findFirst({
    where: { organizationId: org.id, userId },
  });
  const member = existingMember
    ? await prisma.member.update({
        where: { id: existingMember.id },
        data: { role: "owner" },
      })
    : await prisma.member.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          userId,
          role: "owner",
          createdAt: new Date(),
        },
      });

  await ensureOrgCashAccount(org.id);
  return { org, member };
}

async function createDepartment(
  organizationId: string,
  tpl: YayoDepartmentTemplate,
  creatorMemberId: string | null,
) {
  const exists = await prisma.branch.findUnique({
    where: { organizationId_code: { organizationId, code: tpl.code } },
  });
  if (exists) {
    await prisma.branch.update({
      where: { id: exists.id },
      data: { salesTargetUsd: TARGETS[tpl.code] ?? 200, hasProduction: Boolean(tpl.hasProduction) },
    });
    return { created: false, branch: exists };
  }

  let branchType: "BOUTIQUE" | "RESTAURANT" | "HOTEL" | "USINE" = "BOUTIQUE";
  let hasStays = false;
  let hasRestaurant = false;
  let hasPharmacie = false;
  let hasShop = false;
  let hasAlimentation = false;
  let hasEau = false;
  let hasVin = false;
  const hasProduction = Boolean(tpl.hasProduction);

  if (tpl.formType === "HOTEL") {
    const derived = deriveHospitalityBranch(false, true);
    branchType = derived.type as typeof branchType;
    hasStays = false;
    hasRestaurant = true;
  } else if (tpl.formType === "USINE") {
    branchType = "USINE";
    const flags = deriveFactoryFlags();
    hasEau = flags.hasEau;
    hasVin = flags.hasVin;
  } else {
    const flags = deriveShopFlags({
      hasPharmacie: false,
      hasShop: tpl.hasShop === true,
      hasAlimentation: tpl.hasAlimentation === true,
    });
    hasPharmacie = flags.hasPharmacie;
    hasShop = flags.hasShop;
    hasAlimentation = flags.hasAlimentation;
  }

  const branch = await prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({
      data: {
        organizationId,
        type: branchType,
        name: tpl.name,
        code: tpl.code,
        hasStays,
        hasRestaurant,
        hasPharmacie,
        hasShop,
        hasAlimentation,
        hasEau,
        hasVin,
        hasProduction,
        status: "ACTIVE",
        city: "Kolwezi",
        salesTargetUsd: TARGETS[tpl.code] ?? 200,
      },
    });
    await bootstrapBranchByType(tx, {
      organizationId,
      branchId: created.id,
      type: branchType,
      hasStays,
      hasRestaurant,
      hasPharmacie,
      hasShop,
      hasAlimentation,
      hasEau,
      hasVin,
      seedDemo: true,
      creatorMemberId,
    });
    return created;
  });
  return { created: true, branch };
}

async function nextReceipt(branchId: string) {
  const count = await prisma.payment.count({ where: { branchId } });
  return `RC-${String(count + 1).padStart(5, "0")}`;
}

async function nextTicket(branchId: string) {
  const count = await prisma.shopSale.count({ where: { branchId } });
  return `TK-${String(count + 1).padStart(5, "0")}`;
}

async function ensureRate(branchId: string) {
  const existing = await prisma.exchangeRate.findFirst({
    where: { branchId },
  });
  if (existing) return existing;
  return prisma.exchangeRate.create({
    data: {
      branchId,
      fromCurrency: "USD",
      toCurrency: "CDF",
      rate: RATE,
    },
  });
}

async function sellShop(
  branchId: string,
  userId: string,
  cashierName: string,
  sessionId: string,
  qty: number,
) {
  const product = await prisma.shopProduct.findFirst({
    where: { branchId, active: true, productKind: { not: "CONSUMABLE" } },
    orderBy: { price: "asc" },
  });
  if (!product) return 0;
  const total = Math.round(product.price * qty * 100) / 100;
  const sale = await prisma.shopSale.create({
    data: {
      branchId,
      cashSessionId: sessionId,
      status: "ENCAISSEE",
      ticketNumber: await nextTicket(branchId),
      totalAmount: total,
      isAnonymous: true,
      anonymousCode: "Y1",
      cashierUserId: userId,
      cashierName,
      paidAt: new Date(),
      items: {
        create: {
          productId: product.id,
          name: product.name,
          kind: product.kind,
          quantity: qty,
          unitPrice: product.price,
          catalogPrice: product.price,
        },
      },
    },
  });
  await prisma.shopProduct.update({
    where: { id: product.id },
    data: { stockQty: { decrement: qty } },
  });
  await prisma.warehouseProduct.upsert({
    where: {
      branchId_sku: { branchId, sku: product.sku || `WP-${product.id.slice(0, 8)}` },
    },
    create: {
      branchId,
      sku: product.sku || `WP-${product.id.slice(0, 8)}`,
      name: product.name,
      type: "MARCHANDISE",
      unitCostUsd: Math.round(product.price * 0.55 * 100) / 100,
      stockQty: Math.max(0, product.stockQty - qty),
      shopProductId: product.id,
    },
    update: { shopProductId: product.id },
  });
  await prisma.payment.create({
    data: {
      branchId,
      cashSessionId: sessionId,
      shopSaleId: sale.id,
      receiptNumber: await nextReceipt(branchId),
      method: "CASH",
      confirmationStatus: "CONFIRMED",
      amountCdf: Math.round(total * RATE),
      amountForeign: total,
      foreignCurrency: "USD",
      exchangeRateUsed: RATE,
      cashierUserId: userId,
      note: DEMO_NOTE,
    },
  });
  return total;
}

async function sellRestaurant(
  branchId: string,
  userId: string,
  sessionId: string,
) {
  const item = await prisma.hotelMenuItem.findFirst({
    where: { branchId, active: true, isConsumable: false },
    orderBy: { price: "desc" },
  });
  if (!item) return 0;
  const qty = 2;
  const amount = item.price * qty;
  const order = await prisma.hotelOrder.create({
    data: {
      branchId,
      tableLabel: "T-YAYO",
      status: "PAYEE",
      settlementMode: "COMPTANT",
      createdByUserId: userId,
      paidAt: new Date(),
      sentAt: new Date(),
      readyAt: new Date(),
      items: {
        create: {
          menuItemId: item.id,
          name: item.name,
          quantity: qty,
          unitPrice: item.price,
          amount,
          needsKitchen: item.needsKitchen,
        },
      },
    },
  });
  await prisma.payment.create({
    data: {
      branchId,
      cashSessionId: sessionId,
      orderId: order.id,
      receiptNumber: await nextReceipt(branchId),
      method: "CASH",
      confirmationStatus: "CONFIRMED",
      amountCdf: Math.round(amount * RATE),
      amountForeign: amount,
      foreignCurrency: "USD",
      exchangeRateUsed: RATE,
      cashierUserId: userId,
      note: DEMO_NOTE,
    },
  });
  return amount;
}

async function produceCharcuterie(branchId: string, userId: string) {
  let beef = await prisma.shopProduct.findFirst({
    where: { branchId, sku: "MP-BOEUF" },
  });
  let pork = await prisma.shopProduct.findFirst({
    where: { branchId, sku: "MP-PORC" },
  });
  let saucisson = await prisma.shopProduct.findFirst({
    where: { branchId, sku: "PF-SAUC" },
  });
  const cat =
    (await prisma.shopCategory.findFirst({ where: { branchId, name: "Charcuterie" } })) ??
    (await prisma.shopCategory.create({
      data: { branchId, name: "Charcuterie" },
    }));
  if (!beef) {
    beef = await prisma.shopProduct.create({
      data: {
        branchId,
        categoryId: cat.id,
        name: "Bœuf (kg)",
        sku: "MP-BOEUF",
        kind: "ARTICLE",
        productKind: "CONSUMABLE",
        price: 8,
        stockQty: 120,
      },
    });
  }
  if (!pork) {
    pork = await prisma.shopProduct.create({
      data: {
        branchId,
        categoryId: cat.id,
        name: "Porc (kg)",
        sku: "MP-PORC",
        kind: "ARTICLE",
        productKind: "CONSUMABLE",
        price: 6,
        stockQty: 80,
      },
    });
  }
  if (!saucisson) {
    saucisson = await prisma.shopProduct.create({
      data: {
        branchId,
        categoryId: cat.id,
        name: "Saucisson campus",
        sku: "PF-SAUC",
        kind: "ARTICLE",
        productKind: "FINISHED",
        finishedFamily: "CHARCUTERIE",
        price: 12,
        stockQty: 10,
      },
    });
  }
  let recipe = await prisma.factoryRecipe.findFirst({
    where: { branchId, shopProductId: saucisson.id },
  });
  if (!recipe) {
    recipe = await prisma.factoryRecipe.create({
      data: {
        branchId,
        shopProductId: saucisson.id,
        outputQty: 45,
        lines: {
          create: [
            { consumableProductId: beef.id, qtyPerBatch: 30 },
            { consumableProductId: pork.id, qtyPerBatch: 20 },
          ],
        },
      },
    });
  }
  const already = await prisma.factoryBatch.findFirst({
    where: { branchId, notes: DEMO_NOTE },
  });
  if (already) return;
  await prisma.shopProduct.update({
    where: { id: beef.id },
    data: { stockQty: { decrement: 30 } },
  });
  await prisma.shopProduct.update({
    where: { id: pork.id },
    data: { stockQty: { decrement: 20 } },
  });
  await prisma.shopProduct.update({
    where: { id: saucisson.id },
    data: { stockQty: { increment: 42 } },
  });
  const count = await prisma.factoryBatch.count({ where: { branchId } });
  await prisma.factoryBatch.create({
    data: {
      branchId,
      number: `LOT-${String(count + 1).padStart(5, "0")}`,
      status: "VALIDATED",
      recipeId: recipe.id,
      multiplier: 1,
      outputProductId: saucisson.id,
      outputQty: 45,
      actualOutputQty: 42,
      wasteQty: 3,
      theoreticalCostUsd: 30 * 8 + 20 * 6,
      actualCostUsd: 30 * 8 + 20 * 6,
      notes: DEMO_NOTE,
      producedAt: new Date(),
      validatedByUserId: userId,
    },
  });
}

async function produceFastFood(branchId: string, userId: string) {
  const cat =
    (await prisma.shopCategory.findFirst({ where: { branchId, name: "Cuisine" } })) ??
    (await prisma.shopCategory.create({ data: { branchId, name: "Cuisine" } }));
  let poulet = await prisma.shopProduct.findFirst({
    where: { branchId, sku: "MP-POULET" },
  });
  let burger = await prisma.shopProduct.findFirst({
    where: { branchId, sku: "PF-BURGER" },
  });
  if (!poulet) {
    poulet = await prisma.shopProduct.create({
      data: {
        branchId,
        categoryId: cat.id,
        name: "Poulet (kg)",
        sku: "MP-POULET",
        kind: "ARTICLE",
        productKind: "CONSUMABLE",
        price: 5,
        stockQty: 40,
      },
    });
  }
  if (!burger) {
    burger = await prisma.shopProduct.create({
      data: {
        branchId,
        categoryId: cat.id,
        name: "Burger campus",
        sku: "PF-BURGER",
        kind: "ARTICLE",
        productKind: "FINISHED",
        finishedFamily: "AUTRE",
        price: 4.5,
        stockQty: 5,
      },
    });
  }
  let recipe = await prisma.factoryRecipe.findFirst({
    where: { branchId, shopProductId: burger.id },
  });
  if (!recipe) {
    recipe = await prisma.factoryRecipe.create({
      data: {
        branchId,
        shopProductId: burger.id,
        outputQty: 10,
        lines: {
          create: [{ consumableProductId: poulet.id, qtyPerBatch: 2 }],
        },
      },
    });
  }
  const already = await prisma.factoryBatch.findFirst({
    where: { branchId, notes: DEMO_NOTE },
  });
  if (already) return;
  await prisma.shopProduct.update({
    where: { id: poulet.id },
    data: { stockQty: { decrement: 2 } },
  });
  await prisma.shopProduct.update({
    where: { id: burger.id },
    data: { stockQty: { increment: 10 } },
  });
  const count = await prisma.factoryBatch.count({ where: { branchId } });
  await prisma.factoryBatch.create({
    data: {
      branchId,
      number: `LOT-${String(count + 1).padStart(5, "0")}`,
      status: "VALIDATED",
      recipeId: recipe.id,
      multiplier: 1,
      outputProductId: burger.id,
      outputQty: 10,
      actualOutputQty: 10,
      wasteQty: 0,
      notes: DEMO_NOTE,
      producedAt: new Date(),
      validatedByUserId: userId,
    },
  });
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: ROOT_EMAIL },
  });
  if (!user) throw new Error(`Admin introuvable : ${ROOT_EMAIL}. Lancez pnpm seed.`);

  const { org, member } = await ensureOrg(user.id);
  const cashierName = user.name || user.email;

  for (const tpl of YAYO_DEPARTMENTS) {
    const { created, branch } = await createDepartment(org.id, tpl, member.id);
    console.log(
      `${created ? "+" : "="} ${branch.name} (${branch.code}) ${branch.id}`,
    );
    await ensureRate(branch.id);

    const alreadyPaid = await prisma.payment.findFirst({
      where: { branchId: branch.id, note: DEMO_NOTE },
    });
    if (alreadyPaid) {
      console.log("  ventes déjà présentes");
      continue;
    }

    const session = await prisma.cashSession.create({
      data: {
        branchId: branch.id,
        openedByUserId: user.id,
        openingFloat: 20,
        status: "OPEN",
      },
    });

    let sold = 0;
    if (branch.type === "BOUTIQUE" || branch.type === "USINE") {
      sold += await sellShop(branch.id, user.id, cashierName, session.id, 3);
    }
    if (branch.hasRestaurant) {
      sold += await sellRestaurant(branch.id, user.id, session.id);
    }
    if (branch.code === "CHAR") {
      await produceCharcuterie(branch.id, user.id);
      sold += await sellShop(branch.id, user.id, cashierName, session.id, 2);
    }
    if (branch.code === "FFOD") {
      await produceFastFood(branch.id, user.id);
    }

    const expected = Math.round((20 + sold) * 100) / 100;
    const declared =
      branch.code === "MMKT" ? Math.round((expected - 1.5) * 100) / 100 : expected;
    await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByUserId: user.id,
        closingCash: declared,
        expectedCashUsd: expected,
        declaredCashUsd: declared,
        varianceUsd: Math.round((expected - declared) * 100) / 100,
      },
    });
    const rem = await prepareRemittanceFromSession({
      organizationId: org.id,
      branchId: branch.id,
      cashSessionId: session.id,
      expectedUsd: expected,
      declaredUsd: declared,
      userId: user.id,
      note: DEMO_NOTE,
    });
    if (branch.code !== "CREM") {
      await receiveRemittance({
        organizationId: org.id,
        remittanceId: rem.id,
        receivedUsd: declared,
        userId: user.id,
        note: "Accusé démo PCA",
      });
    }
    console.log(`  ventes ${sold.toFixed(2)} $ · versement ${rem.number}`);
  }

  console.log("\nOK");
  console.log(`Org : http://localhost:3000/admin/organizations/${org.id}`);
  console.log(`PCA : http://localhost:3000/admin/organizations/${org.id}/pca`);
  console.log(
    `Caisse centrale : http://localhost:3000/admin/organizations/${org.id}/caisse-centrale`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
