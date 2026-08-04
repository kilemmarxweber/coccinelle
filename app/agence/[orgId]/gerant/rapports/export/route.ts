import { NextResponse } from "next/server";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  caRapportToCsv,
  getGerantCaRapport,
  parseCaPeriod,
} from "@/lib/reports/gerant-ca";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { orgId } = await context.params;

  const perm = await assertOrganizationPermission(orgId, {
    rapport: ["read"],
  });
  if (!perm.ok) {
    return NextResponse.json({ error: perm.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const period = parseCaPeriod(sp);
  const rapport = await getGerantCaRapport(orgId, period);
  const csv = caRapportToCsv(rapport);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ca-${period.from}_${period.to}.csv"`,
    },
  });
}
