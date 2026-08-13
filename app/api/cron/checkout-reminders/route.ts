import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";
import { sendStayCheckoutReminderNotification } from "@/lib/notifications/send-stay-checkout-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron : rappels WhatsApp ~20 min avant l’heure de sortie (10 h).
 * Auth : Authorization: Bearer CRON_SECRET
 * Planifier toutes les 5 minutes.
 */
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

  const stays = await prisma.hotelStay.findMany({
    where: {
      status: "CHECKED_IN",
      checkoutReminderSentAt: null,
      guestPhone: { not: null },
    },
    select: {
      id: true,
      branchId: true,
      guestName: true,
      guestPhone: true,
      checkOutDate: true,
      room: { select: { number: true } },
      branch: { select: { timezone: true } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;

  for (const stay of stays) {
    const tz = stay.branch.timezone || "Africa/Kinshasa";
    const local = localParts(new Date(), tz);
    const outDay = dateOnlyKey(stay.checkOutDate);
    const todayKey = `${local.y}-${pad(local.m)}-${pad(local.d)}`;
    if (outDay !== todayKey) {
      skipped += 1;
      continue;
    }
    // Fenêtre 09:40–09:59 pour sortie à 10 h
    const minutes = local.h * 60 + local.min;
    const windowStart = HOTEL_CHECKOUT_HOUR * 60 - 20;
    const windowEnd = HOTEL_CHECKOUT_HOUR * 60 - 1;
    if (minutes < windowStart || minutes > windowEnd) {
      skipped += 1;
      continue;
    }

    const ok = await sendStayCheckoutReminderNotification({
      branchId: stay.branchId,
      stayId: stay.id,
      guestName: stay.guestName,
      guestPhone: stay.guestPhone,
      roomLabel: stay.room.number,
    });
    if (ok) {
      await prisma.hotelStay.update({
        where: { id: stay.id },
        data: { checkoutReminderSentAt: new Date() },
      });
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stays.length,
    sent,
    skipped,
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateOnlyKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

function localParts(now: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour === "24" ? "0" : parts.hour),
    min: Number(parts.minute),
  };
}
