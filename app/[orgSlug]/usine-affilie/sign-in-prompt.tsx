import Link from "next/link";

export function AffilieSignInPrompt(props: {
  orgSlug: string;
  message?: string;
}) {
  const callback = encodeURIComponent(`/${props.orgSlug}/usine-affilie`);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <h1 className="text-xl font-bold">Portail affilié</h1>
      <p className="text-sm text-muted-foreground">
        {props.message === "Non authentifié."
          ? "Connectez-vous avec le compte invité par l’usine pour voir vos crédits et commander."
          : props.message ||
            "Compte affilié requis. Demandez une invitation au marketeur."}
      </p>
      <Link
        href={`/auth/sign-in?callbackUrl=${callback}`}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Se connecter
      </Link>
    </div>
  );
}
