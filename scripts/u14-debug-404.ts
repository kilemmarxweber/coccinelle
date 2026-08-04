import "dotenv/config";
import { getPublicOrganizationBySlug } from "../lib/pwa/org";
import { getCheckoutDraft } from "../lib/reservation/draft";
import { getDepartForOrganization } from "../lib/search-departs";

async function main() {
  const org = await getPublicOrganizationBySlug("default-org");
  console.log("ORG", org);

  for (const token of [
    "862ab6ba-a422-4735-abc8-2f599e523894",
    "1c8cf043-e00d-477b-b8c1-d7e490c271b0",
  ]) {
    try {
      const draft = await getCheckoutDraft({
        organizationId: org!.id,
        draftToken: token,
      });
      console.log("DRAFT", token, {
        found: !!draft,
        expired: draft?.expired,
        departId: draft?.payload.trajetDepartId,
        places: draft?.placesRestantes,
      });
      if (draft) {
        const depart = await getDepartForOrganization({
          organizationSlug: org!.slug,
          departId: draft.payload.trajetDepartId,
        });
        console.log("DEPART_FROM_DRAFT", !!depart, depart?.statut, depart?.complet);
      }
    } catch (e) {
      console.log("ERR", token, e);
    }
  }

  const depart = await getDepartForOrganization({
    organizationSlug: "default-org",
    departId: "depart-prog-2-0",
  });
  console.log("DIRECT_DEPART", depart ? { id: depart.departId, statut: depart.statut } : null);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
