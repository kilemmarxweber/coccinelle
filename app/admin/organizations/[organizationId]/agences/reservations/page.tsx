import { getTrajets } from "../trajets/trajet.actions";
import RegistrationPage from "./components/form-client";

export default async function Page() {
  const trajets = await getTrajets();

  return <RegistrationPage trajets={trajets} />;
}
