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
  listDepartsDuJourAction,
  searchDepartsAction,
} from "@/lib/search-departs/actions";
import { todayIsoLocal } from "@/lib/search-departs/day-bounds";
import type { SearchDepartResult } from "@/lib/search-departs/types";
import type { SearchBarValues } from "@/components/funnel";
import {
  createGuichetClientAction,
  createReservationAction,
  searchClientsAction,
} from "../../actions";
import { EMPTY_NEW_CLIENT, emptyPassager } from "./constants";
import type {
  ClientHit,
  GuichetFormProps,
  GuichetStepId,
  ModePaiement,
  NewClientForm,
  PassagerForm,
} from "./types";

export function useGuichetForm({ organizationId, express = false }: GuichetFormProps) {
  const router = useRouter();
  const base = `/admin/organizations/${organizationId}/agences/reservations`;

  const [step, setStep] = React.useState<GuichetStepId>("recherche");
  const [searchPending, setSearchPending] = React.useState(false);
  const [results, setResults] = React.useState<SearchDepartResult[] | null>(
    express ? null : null,
  );
  const [selectedDepart, setSelectedDepart] =
    React.useState<SearchDepartResult | null>(null);
  const [search, setSearch] = React.useState<SearchBarValues>({
    villeDepart: "",
    villeArrivee: "",
    date: todayIsoLocal(),
    modeTransport: "",
  });

  const [clientQuery, setClientQuery] = React.useState("");
  const [clientHits, setClientHits] = React.useState<ClientHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<ClientHit | null>(
    null,
  );
  const [showNewClient, setShowNewClient] = React.useState(false);
  const [newClient, setNewClient] = React.useState<NewClientForm>(EMPTY_NEW_CLIENT);

  const [nombrePlaces, setNombrePlaces] = React.useState(1);
  const [passagers, setPassagers] = React.useState<PassagerForm[]>([
    emptyPassager(),
  ]);
  const [includeColis, setIncludeColis] = React.useState(false);
  const [colisType, setColisType] = React.useState<"ORDINAIRE" | "SPECIAL">(
    "ORDINAIRE",
  );
  const [colisPoids, setColisPoids] = React.useState("");
  const [colisMontant, setColisMontant] = React.useState("");
  const [colisCommentaire, setColisCommentaire] = React.useState("");
  const [destinataireNom, setDestinataireNom] = React.useState("");
  const [destinataireTel, setDestinataireTel] = React.useState("");
  const [destinataireId, setDestinataireId] = React.useState("");
  const [modePaiement, setModePaiement] = React.useState<ModePaiement>("CASH");
  const [submitting, setSubmitting] = React.useState(false);

  const tarifs: TrajetTarifs | null = selectedDepart
    ? {
        prixBase: selectedDepart.prixBase,
        prixParKilo: selectedDepart.prixParKilo,
        kilosGratuits: selectedDepart.kilosGratuits,
      }
    : null;

  React.useEffect(() => {
    if (!express) return;
    let cancelled = false;
    (async () => {
      setSearchPending(true);
      const res = await listDepartsDuJourAction({
        organizationId,
        includeComplets: true,
      });
      if (cancelled) return;
      setSearchPending(false);
      if (!res.ok) {
        toast.error(res.message);
        setResults([]);
        return;
      }
      setResults(res.data.results);
    })();
    return () => {
      cancelled = true;
    };
  }, [express, organizationId]);

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

  React.useEffect(() => {
    if (nombrePlaces === 0) {
      setIncludeColis(true);
    }
  }, [nombrePlaces]);

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
      nombrePlaces > 0
        ? passagers.map((p) => ({ categorie: p.categorie }))
        : [],
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

  async function handleSearch(values: SearchBarValues) {
    setSearchPending(true);
    setSelectedDepart(null);
    const res = await searchDepartsAction({
      organizationId,
      villeDepart: values.villeDepart,
      villeArrivee: values.villeArrivee,
      date: values.date,
      modeTransport: values.modeTransport || undefined,
      includeComplets: true,
    });
    setSearchPending(false);
    if (!res.ok) {
      toast.error(res.message);
      setResults([]);
      return;
    }
    setResults(res.data.results);
    if (res.data.results.length === 0) {
      toast.message("Aucun départ pour ces critères.");
    }
  }

  function selectDepart(depart: SearchDepartResult) {
    if (depart.complet) {
      toast.error(
        `Capacité insuffisante : 0 place restante, ${Math.max(1, nombrePlaces)} demandée(s).`,
      );
      return;
    }
    setSelectedDepart(depart);
    setStep("client");
  }

  async function handleCreateClient() {
    const res = await createGuichetClientAction({
      organizationId,
      ...newClient,
    });
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

  function goNextFromClient() {
    if (!selectedClient) {
      toast.error("Sélectionnez ou créez un client.");
      return;
    }
    setStep("passagers");
  }

  function goNextFromPassagers() {
    if (nombrePlaces === 0) {
      setIncludeColis(true);
      setStep("colis");
      return;
    }
    if (passagers.some((p, i) => !(p.nom.trim() || (i === 0 && selectedClient?.nom)))) {
      toast.error("Renseignez le nom de chaque passager.");
      return;
    }
    setStep("colis");
  }

  function goNextFromColis() {
    const hasColis = includeColis || nombrePlaces === 0;
    if (hasColis) {
      if (
        !destinataireNom.trim() ||
        !destinataireTel.trim() ||
        !destinataireId.trim()
      ) {
        toast.error(
          "Renseignez le destinataire du colis (nom, téléphone, pièce).",
        );
        return;
      }
    }
    setStep("paiement");
  }

  function skipColis() {
    if (nombrePlaces === 0) {
      toast.error("Colis obligatoire pour une réservation sans place.");
      return;
    }
    setIncludeColis(false);
    setStep("paiement");
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selectedClient) {
      toast.error("Sélectionnez ou créez un client.");
      setStep("client");
      return;
    }
    if (!selectedDepart || !tarifs || !pricing) {
      toast.error("Choisissez un départ.");
      setStep("recherche");
      return;
    }
    if (selectedDepart.complet || selectedDepart.placesRestantes < nombrePlaces) {
      toast.error(
        `Capacité insuffisante : ${selectedDepart.placesRestantes} place(s) restante(s), ${nombrePlaces} demandée(s).`,
      );
      return;
    }

    const passagersPayload = passagers.map((p, i) => ({
      nom: p.nom.trim() || (i === 0 ? selectedClient.nom : "Passager"),
      prenom:
        p.prenom.trim() ||
        (i === 0 ? selectedClient.prenom.trim() || selectedClient.nom : "—"),
      sexe: p.sexe,
      categorie: p.categorie,
      dateNaissance: p.dateNaissance || undefined,
      prix: prixPassager(tarifs, p.categorie),
      isClient: i === 0,
    }));

    const hasColisOnly = nombrePlaces === 0;
    const hasColis = hasColisOnly || includeColis;
    if (!hasColisOnly && passagersPayload.some((p) => !p.nom)) {
      toast.error("Renseignez le nom de chaque passager.");
      setStep("passagers");
      return;
    }
    if (hasColis) {
      if (
        !destinataireNom.trim() ||
        !destinataireTel.trim() ||
        !destinataireId.trim()
      ) {
        toast.error(
          "Renseignez le destinataire du colis (nom, téléphone, pièce).",
        );
        setStep("colis");
        return;
      }
    }

    setSubmitting(true);
    const res = await createReservationAction(organizationId, {
      clientId: selectedClient.id,
      trajetId: selectedDepart.trajetId,
      trajetDepartId: selectedDepart.departId,
      dateDepart: selectedDepart.dateDepart,
      heureDepart: selectedDepart.heureDepart,
      nombrePlaces,
      passagers: passagersPayload,
      colis: hasColis
        ? {
            type: colisType,
            poids: colisPoids || undefined,
            kilosSupplement: pricing.colis.kilosSupplement,
            kilosGratuits: pricing.colis.kilosGratuits,
            montant:
              colisType === "SPECIAL" ? Number(colisMontant) || 0 : undefined,
            commentaire: colisCommentaire || undefined,
            prix: pricing.totalColis,
            destinataireNom: destinataireNom.trim(),
            destinataireTel: destinataireTel.trim(),
            destinataireId: destinataireId.trim(),
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
    express,
    step,
    setStep,
    search: {
      values: search,
      setValues: setSearch,
      pending: searchPending,
      results,
      submit: handleSearch,
    },
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
      goNext: goNextFromClient,
    },
    voyage: {
      selectedDepart,
      selectDepart,
      tarifs,
      /** Compat sections colis (prix / kg). */
      selectedTrajet: selectedDepart
        ? {
            id: selectedDepart.trajetId,
            villeDepart: selectedDepart.villeDepart,
            villeArrivee: selectedDepart.villeArrivee,
            prixBase: selectedDepart.prixBase,
            prixParKilo: selectedDepart.prixParKilo,
            kilosGratuits: selectedDepart.kilosGratuits,
          }
        : null,
      selectedDepartLegacy: selectedDepart
        ? {
            id: selectedDepart.departId,
            dateDepart: selectedDepart.dateDepart,
            heureDepart: selectedDepart.heureDepart,
            placesRestantes: selectedDepart.placesRestantes,
          }
        : null,
    },
    passagers: {
      nombrePlaces,
      setNombrePlaces,
      list: passagers,
      update: updatePassager,
      goNext: goNextFromPassagers,
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
      destinataireNom,
      setDestinataireNom,
      destinataireTel,
      setDestinataireTel,
      destinataireId,
      setDestinataireId,
      show: includeColis || nombrePlaces === 0,
      goNext: goNextFromColis,
      skip: skipColis,
    },
    paiement: { mode: modePaiement, setMode: setModePaiement },
    pricing,
    submitting,
    handleSubmit,
  };
}

export type GuichetFormState = ReturnType<typeof useGuichetForm>;
