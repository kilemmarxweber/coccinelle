import { NextResponse } from "next/server";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  listGerantReservations,
  parseGerantReservationFilters,
  reservationsToCsv,
} from "@/lib/reports/list-gerant-reservations";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { orgId } = await context.params;

  const perm = await assertOrganizationPermission(orgId, {
    inscription: ["modifier"],
  });
  if (!perm.ok) {
    return NextResponse.json({ error: perm.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const filters = parseGerantReservationFilters(sp);
  const rows = await listGerantReservations(orgId, filters);
  const csv = reservationsToCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations-${orgId}.csv"`,
    },
  });
}
