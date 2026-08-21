import { NextResponse } from "next/server";
import { runEndOfDayCron } from "@/lib/payroll/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron paie commerce : auto-absent fin de journée + relance J+2.
 * Auth : Authorization: Bearer CRON_SECRET
 * Planifier toutes les 15 minutes (idempotent).
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

  const result = await runEndOfDayCron();
  return NextResponse.json({ ok: true, ...result });
}
