"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  computeReservationPricing,
  prixPassager,
  type TrajetTarifs,
} from "@/lib/reservation/pricing";
import {
  createGuichetClientAction,
  createReservationAction,
  searchClientsAction,
} from "../../actions";
import { EMPTY_NEW_CLIENT, emptyPassager } from "./constants";
import type {
  ClientHit,
  GuichetFormProps,
  ModePaiement,
  NewClientForm,
  PassagerForm,
} from "./types";

export function useGuichetForm({ organizationId, trajets }: GuichetFormProps) {
  const router = useRouter();
  const base = `/admin/organizations/${organizationId}/agences/reservations`;

  const [clientQuery, setClientQuery] = React.useState("");
  const [clientHits, setClientHits] = React.useState<ClientHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<ClientHit | null>(null);
  const [showNewClient, setShowNewClient] = React.useState(false);
  const [newClient, setNewClient] = React.useState<NewClientForm>(EMPTY_NEW_CLIENT);

  const [trajetId, setTrajetId] = React.useState("");
  const [departId, setDepartId] = React.useState("");
  const [nombrePlaces, setNombrePlaces] = React.useState(1);
  const [passagers, setPassagers] = React.useState<PassagerForm[]>([emptyPassager()]);
  const [includeColis, setIncludeColis] = React.useState(false);
  const [colisType, setColisType] = React.useState<"ORDINAIRE" | "SPECIAL">("ORDINAIRE");
  const [colisPoids, setColisPoids] = React.useState("");
  const [colisMontant, setColisMontant] = React.useState("");
  const [colisCommentaire, setColisCommentaire] = React.useState("");
  const [modePaiement, setModePaiement] = React.useState<ModePaiement>("CASH");
  const [submitting, setSubmitting] = React.useState(false);

  const selectedTrajet = trajets.find((t) => t.id === trajetId);
  const departs = selectedTrajet?.departs ?? [];
  const selectedDepart = departs.find((d) => d.id === departId);

  const tarifs: TrajetTarifs | null = selectedTrajet
    ? {
        prixBase: selectedTrajet.prixBase,
        prixParKilo: selectedTrajet.prixParKilo,
        kilosGratuits: selectedTrajet.kilosGratuits,
      }
    : null;

  React.useEffect(() => {
    const t = setTimeout(async () => {
      if (clientQuery.trim().length < 2) {
        setClientHits([]);
        return;
      }
      setSearching(true);
      const hits = await searchClientsAction(organizationId, clientQuery);
      setClientHits(hits);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [clientQuery, organizationId]);

  React.useEffect(() => {
    setDepartId("");
  }, [trajetId]);

  React.useEffect(() => {
    setPassagers((prev) => {
      const next = [...prev];
      while (next.length < nombrePlaces) next.push(emptyPassager());
      if (next.length > nombrePlaces) next.length = nombrePlaces;
      if (selectedClient && next[0]) {
        next[0] = {
          ...next[0],
          nom: selectedClient.nom || next[0].nom,
          prenom: selectedClient.prenom || next[0].prenom,
        };
      }
      return next;
    });
  }, [nombrePlaces, selectedClient]);

  const pricing = React.useMemo(() => {
    if (!tarifs) return null;
    const colisForCalc =
      includeColis || nombrePlaces === 0
        ? {
            type: colisType,
            poids: colisPoids,
            montantFixe:
              colisType === "SPECIAL" ? Number(colisMontant) || 0 : undefined,
          }
        : undefined;

    return computeReservationPricing(
      tarifs,
      nombrePlaces > 0 ? passagers.map((p) => ({ categorie: p.categorie })) : [],
      colisForCalc,
    );
  }, [
    tarifs,
    passagers,
    includeColis,
    colisType,
    colisPoids,
    colisMontant,
    nombrePlaces,
  ]);

  const updatePassager = React.useCallback(
    (index: number, patch: Partial<PassagerForm>) => {
      setPassagers((arr) => {
        const next = [...arr];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [],
  );

  const selectClient = React.useCallback((client: ClientHit) => {
    setSelectedClient(client);
    setClientHits([]);
    setClientQuery("");
  }, []);

  async function handleCreateClient() {
    const res = await createGuichetClientAction({ organizationId, ...newClient });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Client créé.");
    setSelectedClient({
      id: res.data.id,
      nom: newClient.nom,
      prenom: newClient.prenom,
      postnom: newClient.postnom,
      telephone: newClient.telephone,
      email: newClient.email,
    });
    setShowNewClient(false);
    setClientQuery("");
    setClientHits([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) {
      toast.error("Sélectionnez ou créez un client.");
      return;
    }
    if (!trajetId || !departId || !selectedDepart || !tarifs || !pricing) {
      toast.error("Choisissez un trajet et un départ.");
      return;
    }

    const passagersPayload = passagers.map((p, i) => ({
      nom: p.nom.trim() || (i === 0 ? selectedClient.nom : "Passager"),
      prenom: p.prenom.trim() || (i === 0 ? selectedClient.prenom : ""),
      sexe: p.sexe,
      categorie: p.categorie,
      dateNaissance: p.dateNaissance || undefined,
      prix: prixPassager(tarifs, p.categorie),
      isClient: i === 0,
    }));

    const hasColisOnly = nombrePlaces === 0;
    if (!hasColisOnly && passagersPayload.some((p) => !p.nom)) {
      toast.error("Renseignez le nom de chaque passager.");
      return;
    }

    setSubmitting(true);
    const res = await createReservationAction(organizationId, {
      clientId: selectedClient.id,
      trajetId,
      trajetDepartId: departId,
      dateDepart: selectedDepart.dateDepart,
      heureDepart: selectedDepart.heureDepart,
      nombrePlaces,
      passagers: passagersPayload,
      colis:
        hasColisOnly || includeColis
          ? {
              type: colisType,
              poids: colisPoids || undefined,
              kilosSupplement: pricing.colis.kilosSupplement,
              kilosGratuits: pricing.colis.kilosGratuits,
              montant: colisType === "SPECIAL" ? Number(colisMontant) || 0 : undefined,
              commentaire: colisCommentaire || undefined,
              prix: pricing.totalColis,
            }
          : { prix: 0 },
      modePaiement,
      statutReservation: "CONFIRME",
      pricing: {
        totalPassagers: pricing.totalPassagers,
        totalColis: pricing.totalColis,
        total: pricing.total,
      },
      dateLimiteReport: null,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    toast.success(`Réservation ${res.data.codeUnique} créée.`);
    router.push(`${base}/${res.data.id}`);
    router.refresh();
  }

  return {
    trajets,
    client: {
      query: clientQuery,
      setQuery: setClientQuery,
      hits: clientHits,
      searching,
      selected: selectedClient,
      setSelected: setSelectedClient,
      select: selectClient,
      showNew: showNewClient,
      setShowNew: setShowNewClient,
      newClient,
      setNewClient,
      create: handleCreateClient,
    },
    voyage: {
      trajetId,
      setTrajetId,
      departId,
      setDepartId,
      selectedTrajet,
      selectedDepart,
      departs,
      tarifs,
    },
    passagers: {
      nombrePlaces,
      setNombrePlaces,
      list: passagers,
      update: updatePassager,
    },
    colis: {
      include: includeColis,
      setInclude: setIncludeColis,
      type: colisType,
      setType: setColisType,
      poids: colisPoids,
      setPoids: setColisPoids,
      montant: colisMontant,
      setMontant: setColisMontant,
      commentaire: colisCommentaire,
      setCommentaire: setColisCommentaire,
      show: includeColis || nombrePlaces === 0,
    },
    paiement: { mode: modePaiement, setMode: setModePaiement },
    pricing,
    submitting,
    handleSubmit,
  };
}

export type GuichetFormState = ReturnType<typeof useGuichetForm>;
