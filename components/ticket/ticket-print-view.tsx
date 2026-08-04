import {
  CATEGORIE_PASSAGER_LABELS,
  METHODE_PAIEMENT_LABELS,
  MODE_TRANSPORT_LABELS,
  formatDateTimeFr,
  formatMontantFc,
} from "@/lib/reservation/labels";
import type { TicketReservation } from "@/lib/reservation/ticket-data";
import { cn } from "@/lib/utils";

type Props = {
  ticket: TicketReservation;
  className?: string;
};

/** Vue billet HTML print-ready (aperçu écran + source pour impression). */
export function TicketPrintView({ ticket, className }: Props) {
  const mode =
    MODE_TRANSPORT_LABELS[ticket.trajet.modeTransport] ??
    ticket.trajet.modeTransport;

  return (
    <div
      data-ticket-print-root
      className={cn(
        "ticket-print-view bg-white text-black",
        "flex flex-col gap-5 p-6 text-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          {ticket.organization.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticket.organization.logo}
              alt=""
              className="mb-1 h-10 w-auto object-contain"
            />
          ) : null}
          <p className="text-lg font-semibold tracking-tight">
            {ticket.organization.name}
          </p>
          <p className="text-neutral-600">Billet de voyage · {mode}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Réservation
          </p>
          <p className="font-mono text-base font-semibold">{ticket.codeUnique}</p>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Trajet
          </p>
          <p className="text-base font-medium">
            {ticket.trajet.villeDepart} → {ticket.trajet.villeArrivee}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Départ
          </p>
          <p className="text-base font-medium">
            {formatDateTimeFr(ticket.dateDepart, ticket.heureDepart)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Client
          </p>
          <p className="font-medium">{ticket.client.displayName}</p>
          <p className="text-neutral-600">{ticket.client.telephone}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Montant
          </p>
          <p className="font-medium">{formatMontantFc(ticket.prixTotal)}</p>
          <p className="text-neutral-600">
            Billets {formatMontantFc(ticket.prixBillet)}
            {ticket.paiement
              ? ` · ${METHODE_PAIEMENT_LABELS[ticket.paiement.methode] ?? ticket.paiement.methode}`
              : null}
          </p>
        </div>
      </section>

      {ticket.passagers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Passagers
          </h2>
          <ul className="flex flex-col gap-3">
            {ticket.passagers.map((p) => {
              const isBebe = p.categorie === "BEBE" || !p.occupePlace;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-4 border border-neutral-200 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.qrDataUrl}
                    alt={`QR ${p.codeUnique}`}
                    width={96}
                    height={96}
                    className="size-24 shrink-0 bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.prenom} {p.nom}
                    </p>
                    <p className="text-neutral-600">
                      {CATEGORIE_PASSAGER_LABELS[p.categorie] ?? p.categorie}
                      {isBebe ? " · n’occupe pas de siège" : null}
                    </p>
                    <p className="mt-1 font-mono text-xs">{p.codeUnique}</p>
                    <p className="text-neutral-600">{formatMontantFc(p.prix)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-neutral-300 pt-3 text-xs text-neutral-500">
        Présentez ce billet à l’embarquement. Chaque passager a son propre QR.
        Réimpression autorisée — ne crée pas une nouvelle réservation.
      </footer>
    </div>
  );
}
