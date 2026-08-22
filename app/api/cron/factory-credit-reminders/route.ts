import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyFactoryCreditReminder } from "@/lib/factory/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET non configuré" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const credits = await prisma.factoryCredit.findMany({
    where: {
      status: { in: ["OPEN", "PARTIAL"] },
      customer: { phone: { not: null } },
    },
    include: {
      customer: true,
      branch: { select: { timezone: true } },
    },
    take: 300,
  });

  let sent = 0;
  let skipped = 0;

  for (const credit of credits) {
    const tz = credit.branch.timezone || "Africa/Kinshasa";
    const local = localParts(new Date(), tz);
    const todayKey = `${local.y}-${pad(local.m)}-${pad(local.d)}`;
    const dueKey = dateKey(credit.dueAt);
    const yesterday = new Date(credit.dueAt);
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = dateKey(yesterday);
    const remaining = Math.max(0, credit.totalUsd - credit.paidUsd);

    if (todayKey === yKey && !credit.reminderSentAt) {
      await notifyFactoryCreditReminder({
        branchId: credit.branchId,
        creditId: credit.id,
        number: credit.number,
        customerName: credit.customer.name,
        phone: credit.customer.phone,
        remainingUsd: remaining,
        dueAt: credit.dueAt,
      });
      await prisma.factoryCredit.update({
        where: { id: credit.id },
        data: { reminderSentAt: new Date() },
      });
      sent += 1;
      continue;
    }
    if (todayKey === dueKey && !credit.dueDayReminderSentAt) {
      await notifyFactoryCreditReminder({
        branchId: credit.branchId,
        creditId: credit.id,
        number: credit.number,
        customerName: credit.customer.name,
        phone: credit.customer.phone,
        remainingUsd: remaining,
        dueAt: credit.dueAt,
      });
      await prisma.factoryCredit.update({
        where: { id: credit.id },
        data: { dueDayReminderSentAt: new Date() },
      });
      sent += 1;
      continue;
    }
    skipped += 1;
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
