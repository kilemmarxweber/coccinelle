import prisma from "@/lib/prisma";

async function nextRemittanceNumber(organizationId: string) {
  const count = await prisma.cashRemittance.count({ where: { organizationId } });
  return `VER-${String(count + 1).padStart(5, "0")}`;
}

async function nextCentralNumber(organizationId: string, prefix: string) {
  const count = await prisma.centralCashEntry.count({ where: { organizationId } });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export async function ensureOrgCashAccount(organizationId: string) {
  return prisma.orgCashAccount.upsert({
    where: { organizationId },
    create: { organizationId, balanceUsd: 0 },
    update: {},
  });
}

export async function prepareRemittanceFromSession(input: {
  organizationId: string;
  branchId: string;
  cashSessionId: string;
  expectedUsd: number;
  declaredUsd: number;
  userId: string;
  note?: string;
}) {
  await ensureOrgCashAccount(input.organizationId);
  const number = await nextRemittanceNumber(input.organizationId);
  const varianceDeclaredUsd =
    Math.round((input.expectedUsd - input.declaredUsd) * 100) / 100;
  return prisma.cashRemittance.create({
    data: {
      organizationId: input.organizationId,
      fromBranchId: input.branchId,
      cashSessionId: input.cashSessionId,
      number,
      status: "PREPARED",
      expectedUsd: input.expectedUsd,
      declaredUsd: input.declaredUsd,
      varianceDeclaredUsd,
      preparedByUserId: input.userId,
      note: input.note ?? null,
    },
  });
}

export async function receiveRemittance(input: {
  organizationId: string;
  remittanceId: string;
  receivedUsd: number;
  userId: string;
  note?: string;
}) {
  const rem = await prisma.cashRemittance.findFirst({
    where: { id: input.remittanceId, organizationId: input.organizationId },
  });
  if (!rem) throw new Error("Versement introuvable.");
  if (rem.status === "RECEIVED") throw new Error("Versement déjà reçu.");

  const receivedUsd = Math.round(input.receivedUsd * 100) / 100;
  const varianceReceivedUsd =
    Math.round((rem.declaredUsd - receivedUsd) * 100) / 100;
  const status = varianceReceivedUsd === 0 ? "RECEIVED" : "DISPUTED";

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.cashRemittance.update({
      where: { id: rem.id },
      data: {
        status,
        receivedUsd,
        varianceReceivedUsd,
        receivedByUserId: input.userId,
        receivedAt: new Date(),
        note: input.note?.trim() || rem.note,
      },
    });
    const journalNumber = await nextCentralNumber(input.organizationId, "CC");
    await tx.centralCashEntry.create({
      data: {
        organizationId: input.organizationId,
        number: journalNumber,
        kind: "REMITTANCE_IN",
        amountUsd: receivedUsd,
        remittanceId: rem.id,
        justification: `Réception ${rem.number}`,
        createdByUserId: input.userId,
        approvedByUserId: input.userId,
      },
    });
    await tx.orgCashAccount.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        balanceUsd: receivedUsd,
      },
      update: { balanceUsd: { increment: receivedUsd } },
    });
    return next;
  });
  return updated;
}

export async function postCentralMovement(input: {
  organizationId: string;
  kind: "ENTRY" | "EXIT";
  amountUsd: number;
  justification: string;
  userId: string;
}) {
  const amount = Math.abs(input.amountUsd);
  if (!(amount > 0)) throw new Error("Montant invalide.");
  const justification = input.justification.trim();
  if (justification.length < 4) {
    throw new Error("Justificatif obligatoire.");
  }
  const signed = input.kind === "EXIT" ? -amount : amount;
  const account = await ensureOrgCashAccount(input.organizationId);
  if (input.kind === "EXIT" && account.balanceUsd < amount) {
    throw new Error("Solde coffre insuffisant.");
  }
  const number = await nextCentralNumber(input.organizationId, "CC");
  const [entry] = await prisma.$transaction([
    prisma.centralCashEntry.create({
      data: {
        organizationId: input.organizationId,
        number,
        kind: input.kind,
        amountUsd: signed,
        justification,
        createdByUserId: input.userId,
        approvedByUserId: input.userId,
      },
    }),
    prisma.orgCashAccount.update({
      where: { organizationId: input.organizationId },
      data: { balanceUsd: { increment: signed } },
    }),
  ]);
  return entry;
}
