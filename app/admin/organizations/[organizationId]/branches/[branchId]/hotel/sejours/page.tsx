import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import {
  applyLateCheckoutFeesAction,
  listRoomsWithTypesAction,
  listStaysForMonthAction,
  listStaysForYearAction,
} from "@/lib/hotel/actions";
import { listBranchPartnersAction } from "@/lib/partners/actions";
import { SejoursClient } from "./sejours-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function SejoursPage({ params, searchParams }: PageProps) {
  const { organizationId, branchId } = await params;
  const sp = await searchParams;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "stays",
    requireDashCard: DASH_CARD.SEJOURS,
  });

  // Nuitée auto si occupant encore présent après 10h le jour de sortie
  await applyLateCheckoutFeesAction(organizationId, branchId);

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;

  const [rooms, stays, yearStays, rate, partners] = await Promise.all([
    listRoomsWithTypesAction(organizationId, branchId),
    listStaysForMonthAction(organizationId, branchId, year, month),
    listStaysForYearAction(organizationId, branchId, year),
    getActiveExchangeRate(branchId),
    listBranchPartnersAction(organizationId, branchId),
  ]);

  const roomsOrdered = [...rooms].sort((a, b) => {
    const ka = a.roomType.kind === "MEETING" ? 1 : 0;
    const kb = b.roomType.kind === "MEETING" ? 1 : 0;
    if (ka !== kb) return ka - kb;
    return a.number.localeCompare(b.number, "fr");
  });

  return (
    <SejoursClient
      organizationId={organizationId}
      branchId={branchId}
      rooms={roomsOrdered}
      stays={stays}
      yearStays={yearStays}
      partners={partners}
      initialYear={year}
      initialMonth={month}
      rate={rate}
    />
  );
}
