import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";

/** Racine app : connexion, ou redirection post-login si déjà authentifié. */
export default async function RootPage() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });

  if (session?.user) {
    redirect(await resolvePostLoginPath(h));
  }

  redirect("/auth/sign-in");
}
