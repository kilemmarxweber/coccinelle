import { ColisList } from "./components/colis-list";
import { getColisAction } from "./actions";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function ColisPage({ params }: PageProps) {
  const { organizationId } = await params;
  const result = await getColisAction(organizationId);

  if (!result.ok) {
    return <ColisList colis={[]} errorMessage={result.message} />;
  }

  const colis = result.data.map((item) => ({
    ...item,
    trajetDepart: item.trajetDepart
      ? {
          ...item.trajetDepart,
          dateDepart: item.trajetDepart.dateDepart.toISOString(),
        }
      : null,
  }));

  return <ColisList colis={colis} />;
}
