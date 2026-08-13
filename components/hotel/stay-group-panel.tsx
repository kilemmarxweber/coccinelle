"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { PosPayMethodPicker } from "@/components/pos/pos-terminal";
import type { BranchPartnerDTO } from "@/lib/partners/types";
import {
  GUEST_ID_DOC_TYPES,
  guestIdDocLabel,
  readGuestIdFileAsDataUrl,
  type GuestIdDocType,
} from "@/lib/hotel/guest-id-document";
import {
  cancelStayGroupBatchAction,
  cancelStayInGroupAction,
  checkInStayGroupBatchAction,
  completeStayGuestAction,
  createStayGroupAction,
  getStayGroupDetailAction,
  issueStayGroupInvoiceAction,
  markStayGroupInvoiceHandedOverAction,
  previewStayGroupInvoiceAction,
  recordStayGroupPaymentAction,
  recordStayGroupRefundAction,
  updateStayGroupRoomRateAction,
} from "@/lib/hotel/stay-group";
import {
  formatPrimaryAmount,
  formatUsdLineTotal,
  formatUsdPrimaryInputValue,
  isCdfPrimary,
  primaryAmountToUsd,
  primaryCurrencyLabel,
  primaryPriceInputStep,
  usdToPrimaryNumber,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { stayGroupSettlementDisplay } from "@/lib/hotel/stay-group-settlement";

type Room = {
  id: string;
  number: string;
  roomType: {
    id: string;
    name: string;
    priceNight: number;
    kind?: string;
  };
};

type RoomTypeAgg = {
  id: string;
  name: string;
  priceNight: number;
  roomCount: number;
};

type StayGroupListItem = {
  id: string;
  code: string;
  label: string | null;
  status: string;
  bookerName: string | null;
  partner: { id: string; name: string } | null;
  stays: {
    id: string;
    guestName: string;
    guestPending: boolean;
    status: string;
    checkInDate: string | Date;
    checkOutDate: string | Date;
    room: { number: string; roomType: { name: string } };
  }[];
};

function localToday() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tomorrow() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function StayGroupToolbar(props: {
  onOpenWizard: () => void;
  onOpenDossiers: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={props.onOpenWizard}>
        <Users className="mr-1.5 size-4" />
        Réservation groupée
      </Button>
      <Button size="sm" variant="outline" onClick={props.onOpenDossiers}>
        Dossiers groupe
      </Button>
    </div>
  );
}

export function StayGroupWizardDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  branchId: string;
  rooms: Room[];
  partners: BranchPartnerDTO[];
  rate?: NormalizedUsdCdfRate | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const roomTypes = useMemo(() => {
    const map = new Map<string, RoomTypeAgg>();
    for (const r of props.rooms) {
      if (r.roomType.kind === "MEETING") continue;
      const id = r.roomType.id;
      if (!id) continue;
      const cur = map.get(id);
      if (cur) cur.roomCount += 1;
      else {
        map.set(id, {
          id,
          name: r.roomType.name,
          priceNight: r.roomType.priceNight,
          roomCount: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [props.rooms]);

  const [mode, setMode] = useState<"types" | "rooms">("types");
  const [checkInDate, setCheckInDate] = useState(localToday);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [partnerId, setPartnerId] = useState("");
  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [label, setLabel] = useState("");
  const [payTiming, setPayTiming] = useState<"PREPAID" | "AT_CHECKOUT">(
    "AT_CHECKOUT",
  );
  const [depositPrimary, setDepositPrimary] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK"
  >("CASH");
  const [qtyByType, setQtyByType] = useState<Record<string, string>>({});
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  function reset() {
    setMode("types");
    setCheckInDate(localToday());
    setCheckOutDate(tomorrow());
    setPartnerId("");
    setBookerName("");
    setBookerPhone("");
    setBookerEmail("");
    setLabel("");
    setPayTiming("AT_CHECKOUT");
    setDepositPrimary("");
    setQtyByType({});
    setSelectedRoomIds([]);
  }

  function submit() {
    start(async () => {
      try {
        const lines =
          mode === "rooms"
            ? selectedRoomIds.map((roomId) => ({ roomId }))
            : roomTypes
                .map((t) => ({
                  roomTypeId: t.id,
                  quantity: Math.max(0, Math.floor(Number(qtyByType[t.id]) || 0)),
                }))
                .filter((l) => l.quantity > 0);
        if (!lines.length) {
          toast.error("Sélectionnez au moins une chambre.");
          return;
        }
        const depositUsd =
          depositPrimary.trim() === ""
            ? 0
            : primaryAmountToUsd(Number(depositPrimary), props.rate);
        const res = await createStayGroupAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          checkInDate,
          checkOutDate,
          lines,
          partnerId: partnerId || null,
          bookerName: bookerName || null,
          bookerPhone: bookerPhone || null,
          bookerEmail: bookerEmail || null,
          label: label || null,
          payTiming,
          depositPaymentUsd: depositUsd > 0 ? depositUsd : null,
          paymentMethod,
        });
        toast.success(`Dossier ${res.code} · ${res.stayIds.length} chambres`);
        props.onOpenChange(false);
        reset();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Création impossible");
      }
    });
  }

  const lodgingRooms = props.rooms.filter((r) => r.roomType.kind !== "MEETING");

  return (
    <Dialog
      open={props.open}
      onOpenChange={(v) => {
        props.onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Réservation groupée</DialogTitle>
          <DialogDescription>
            Plusieurs chambres, mêmes dates. Identités des occupants au check-in.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Entrée</Label>
              <Input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Sortie</Label>
              <Input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Partenaire (optionnel)</Label>
            <SearchCombobox
              value={partnerId}
              onValueChange={setPartnerId}
              items={[
                { value: "", label: "— Particulier / booker —" },
                ...props.partners.map((p) => ({
                  value: p.id,
                  label: p.name,
                })),
              ]}
              placeholder="Société ou particulier…"
              showClear
            />
          </div>
          <div>
            <Label>{partnerId ? "Contact booker (opt.)" : "Booker *"}</Label>
            <Input
              value={bookerName}
              onChange={(e) => setBookerName(e.target.value)}
              placeholder="Nom organisateur"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Téléphone</Label>
              <Input
                value={bookerPhone}
                onChange={(e) => setBookerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={bookerEmail}
                onChange={(e) => setBookerEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Libellé dossier</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Groupe mariage Dupont"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "types" ? "default" : "outline"}
              onClick={() => setMode("types")}
            >
              Par type
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "rooms" ? "default" : "outline"}
              onClick={() => setMode("rooms")}
            >
              Chambres précises
            </Button>
          </div>

          {mode === "types" ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              {roomTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun type de chambre (ids manquants) — utilisez « Chambres
                  précises ».
                </p>
              ) : (
                roomTypes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrimaryAmount(t.priceNight, props.rate)} / nuit ·{" "}
                        {t.roomCount} ch.
                      </p>
                    </div>
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      max={t.roomCount}
                      value={qtyByType[t.id] ?? ""}
                      onChange={(e) =>
                        setQtyByType((q) => ({
                          ...q,
                          [t.id]: e.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {lodgingRooms.map((r) => {
                const checked = selectedRoomIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedRoomIds((ids) =>
                          checked
                            ? ids.filter((x) => x !== r.id)
                            : [...ids, r.id],
                        )
                      }
                    />
                    <span>
                      {r.number} · {r.roomType.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Paiement</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={payTiming}
                onChange={(e) =>
                  setPayTiming(e.target.value as "PREPAID" | "AT_CHECKOUT")
                }
              >
                <option value="AT_CHECKOUT">À la sortie</option>
                <option value="PREPAID">Acompte / prépayé</option>
              </select>
            </div>
            <div>
              <Label>Acompte ({primaryCurrencyLabel(props.rate)})</Label>
              <Input
                type="number"
                step={primaryPriceInputStep(props.rate)}
                value={depositPrimary}
                onChange={(e) => setDepositPrimary(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          {Number(depositPrimary) > 0 ? (
            <PosPayMethodPicker
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Création…" : "Créer le dossier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function nightsBetweenDates(checkIn: string | Date, checkOut: string | Date) {
  const a =
    checkIn instanceof Date
      ? Date.UTC(
          checkIn.getUTCFullYear(),
          checkIn.getUTCMonth(),
          checkIn.getUTCDate(),
        )
      : Date.parse(`${String(checkIn).slice(0, 10)}T00:00:00Z`);
  const b =
    checkOut instanceof Date
      ? Date.UTC(
          checkOut.getUTCFullYear(),
          checkOut.getUTCMonth(),
          checkOut.getUTCDate(),
        )
      : Date.parse(`${String(checkOut).slice(0, 10)}T00:00:00Z`);
  return Math.max(1, Math.ceil((b - a) / 86400000));
}

function stayRoomPricing(
  stay: {
    catalogUnitPrice: number;
    unitPriceApplied: number | null;
    checkInDate: string | Date;
    checkOutDate: string | Date;
    folio: {
      lines: {
        kind: string;
        quantity: number;
        unitPrice: number;
        amount: number;
      }[];
    } | null;
  },
) {
  const nightLine = stay.folio?.lines.find((l) => l.kind === "NIGHT");
  const qty =
    nightLine?.quantity ??
    nightsBetweenDates(stay.checkInDate, stay.checkOutDate);
  const catalog = stay.catalogUnitPrice;
  const unit =
    stay.unitPriceApplied != null && stay.unitPriceApplied >= 0
      ? stay.unitPriceApplied
      : (nightLine?.unitPrice ?? catalog);
  const amount = nightLine?.amount ?? qty * unit;
  return { qty, catalog, unit, amount };
}

/** Affiche un total déjà en devise primaire (CDF entier) ou un USD à convertir. */
function formatDossierMoney(
  amount: number,
  rate: NormalizedUsdCdfRate | null | undefined,
  amountsArePrimary: boolean,
) {
  if (amountsArePrimary && isCdfPrimary(rate)) {
    return `${Math.round(amount).toLocaleString("fr-FR")} CDF`;
  }
  return formatPrimaryAmount(amount, rate);
}

export function StayGroupDossiersDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  branchId: string;
  groups: StayGroupListItem[];
  rate?: NormalizedUsdCdfRate | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof getStayGroupDetailAction>
  > | null>(null);
  const [guestStayId, setGuestStayId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK"
  >("CASH");
  const [unitEdits, setUnitEdits] = useState<Record<string, string>>({});
  const [rateNotes, setRateNotes] = useState<Record<string, string>>({});
  const [guestForm, setGuestForm] = useState({
    guestName: "",
    guestPhone: "",
    guestAddress: "",
    guestCity: "",
    idDocumentType: "CNI" as GuestIdDocType,
    idDocumentNumber: "",
    idDocumentImageUrl: "",
  });

  const dossierTotals = useMemo(() => {
    if (!detail) {
      return {
        charges: 0,
        paid: 0,
        balance: 0,
        staySubtotal: 0,
        dueFromClient: 0,
        refundDue: 0,
        amountsArePrimary: false as const,
      };
    }
    const mapped = detail.stays.map((s) => ({
      id: s.id,
      status: s.status,
      guestName: s.guestName,
      room: { number: s.room.number },
      folio: s.folio
        ? {
            id: s.folio.id,
            closed: Boolean(s.folio.closed),
            lines: s.folio.lines,
            payments: s.folio.payments ?? [],
          }
        : null,
    }));
    const settlement = stayGroupSettlementDisplay(mapped, props.rate);
    let staySubtotal = 0;
    if (settlement.amountsArePrimary && props.rate && props.rate.rate > 0) {
      const r = Math.round(props.rate.rate);
      for (const s of detail.stays) {
        if (s.status === "CANCELLED" || s.status === "NO_SHOW") continue;
        const pricing = stayRoomPricing(s);
        staySubtotal +=
          Math.round(pricing.qty) * Math.round(pricing.unit * r);
      }
    } else {
      for (const s of detail.stays) {
        if (s.status === "CANCELLED" || s.status === "NO_SHOW") continue;
        staySubtotal += stayRoomPricing(s).amount;
      }
    }
    return { ...settlement, staySubtotal };
  }, [detail, props.rate]);

  function moneyDossier(amount: number) {
    return formatDossierMoney(
      amount,
      props.rate,
      dossierTotals.amountsArePrimary,
    );
  }

  /** Montant UI (CDF ou USD) → USD pour les actions serveur. */
  function toUsdForAction(displayAmount: number) {
    if (dossierTotals.amountsArePrimary) {
      return primaryAmountToUsd(displayAmount, props.rate);
    }
    return displayAmount;
  }

  function syncRateEdits(
    d: NonNullable<Awaited<ReturnType<typeof getStayGroupDetailAction>>>,
  ) {
    const units: Record<string, string> = {};
    const notes: Record<string, string> = {};
    for (const s of d.stays) {
      if (s.status === "CANCELLED") continue;
      const { unit } = stayRoomPricing(s);
      units[s.id] = formatUsdPrimaryInputValue(unit, props.rate);
      notes[s.id] = s.rateNote ?? "";
    }
    setUnitEdits(units);
    setRateNotes(notes);
  }

  function openDetail(id: string) {
    setDetailId(id);
    setSelected([]);
    setPayAmount("");
    start(async () => {
      try {
        const d = await getStayGroupDetailAction(
          props.organizationId,
          props.branchId,
          id,
        );
        setDetail(d);
        syncRateEdits(d);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible");
      }
    });
  }

  function refreshDetail() {
    if (!detailId) return;
    start(async () => {
      const d = await getStayGroupDetailAction(
        props.organizationId,
        props.branchId,
        detailId,
      );
      setDetail(d);
      syncRateEdits(d);
      router.refresh();
    });
  }

  function payDossier(amountUsd: number) {
    if (!detail) return;
    start(async () => {
      try {
        await recordStayGroupPaymentAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          bookingId: detail.id,
          amountUsd,
          paymentMethod: payMethod,
        });
        toast.success("Paiement ventilé sur les notes");
        setPayAmount("");
        refreshDetail();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Paiement refusé");
      }
    });
  }

  function refundDossier(amountUsd: number) {
    if (!detail) return;
    start(async () => {
      try {
        await recordStayGroupRefundAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          bookingId: detail.id,
          amountUsd,
          paymentMethod: payMethod,
        });
        toast.success("Remboursement enregistré");
        setPayAmount("");
        refreshDetail();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Remboursement refusé");
      }
    });
  }

  function notifySettlement(s: {
    refundDue: number;
    dueFromClient: number;
  }) {
    // Solde renvoyé par le serveur = USD
    if (s.refundDue > 0.01) {
      toast.message(
        `Trop-perçu ${formatPrimaryAmount(s.refundDue, props.rate)} — rembourser`,
      );
    } else if (s.dueFromClient > 0.01) {
      toast.message(
        `Complément dû ${formatPrimaryAmount(s.dueFromClient, props.rate)}`,
      );
    } else {
      toast.success("Dossier soldé");
    }
  }

  function openInvoiceHtml(html: string) {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dossiers groupe / partenaires</DialogTitle>
            <DialogDescription>
              Codes GRP- / PRT- · occupants différés · facture globale
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {props.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dossier.</p>
            ) : (
              props.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => openDetail(g.id)}
                >
                  <div>
                    <p className="font-semibold">{g.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.partner?.name ?? g.bookerName ?? "—"} ·{" "}
                      {g.stays.length} ch. ·{" "}
                      {g.stays.filter((s) => s.guestPending).length} à identifier
                    </p>
                  </div>
                  <Badge variant="outline">{g.status}</Badge>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailId)}
        onOpenChange={(v) => {
          if (!v) {
            setDetailId(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Dossier {detail?.code ?? "…"}
              {detail?.invoiceNumber ? ` · ${detail.invoiceNumber}` : ""}
            </DialogTitle>
            <DialogDescription>
              {detail?.partner?.name ?? detail?.bookerName ?? ""}
              {detail?.label ? ` · ${detail.label}` : ""}
            </DialogDescription>
          </DialogHeader>
          {!detail ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs">
                      <th className="p-2 w-8" />
                      <th className="p-2">Ch.</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Occupant</th>
                      <th className="p-2 text-right">Cat.</th>
                      <th className="p-2 text-right">
                        P.U. négocié ({primaryCurrencyLabel(props.rate)})
                      </th>
                      <th className="p-2 text-right">Qté</th>
                      <th className="p-2 text-right">Montant</th>
                      <th className="p-2">Statut</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.stays.map((s) => {
                        const cancelled = s.status === "CANCELLED";
                        const canBatch =
                          s.status === "RESERVED" && !s.guestPending;
                        const pricing = stayRoomPricing(s);
                        const canEditRate =
                          !cancelled &&
                          (s.status === "RESERVED" || s.status === "CHECKED_IN");
                        const negotiated =
                          Math.abs(pricing.unit - pricing.catalog) >= 0.01;
                        return (
                          <tr
                            key={s.id}
                            className={
                              cancelled
                                ? "border-b border-border/60 opacity-60"
                                : "border-b border-border/60"
                            }
                          >
                            <td className="p-2">
                              {canBatch ? (
                                <input
                                  type="checkbox"
                                  checked={selected.includes(s.id)}
                                  onChange={() =>
                                    setSelected((ids) =>
                                      ids.includes(s.id)
                                        ? ids.filter((x) => x !== s.id)
                                        : [...ids, s.id],
                                    )
                                  }
                                />
                              ) : null}
                            </td>
                            <td className="p-2 font-medium">
                              {s.room.number}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {s.room.roomType.name}
                            </td>
                            <td className="p-2">
                              {cancelled ? (
                                <Badge variant="outline">Annulée</Badge>
                              ) : s.guestPending ? (
                                <Badge variant="secondary">À identifier</Badge>
                              ) : (
                                s.guestName
                              )}
                            </td>
                            <td className="p-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                              {formatPrimaryAmount(pricing.catalog, props.rate)}
                            </td>
                            <td className="p-2">
                              {canEditRate ? (
                                <div className="flex flex-col items-end gap-1">
                                  <Input
                                    className="h-8 w-24 text-right"
                                    type="number"
                                    step={primaryPriceInputStep(props.rate)}
                                    value={unitEdits[s.id] ?? ""}
                                    onChange={(e) =>
                                      setUnitEdits((m) => ({
                                        ...m,
                                        [s.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  {negotiated ||
                                  Number(unitEdits[s.id]) !==
                                    usdToPrimaryNumber(
                                      pricing.catalog,
                                      props.rate,
                                    ) ? (
                                    <Input
                                      className="h-7 w-28 text-xs"
                                      placeholder="Motif négo."
                                      value={rateNotes[s.id] ?? ""}
                                      onChange={(e) =>
                                        setRateNotes((m) => ({
                                          ...m,
                                          [s.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    disabled={pending}
                                    onClick={() =>
                                      start(async () => {
                                        try {
                                          const primary = Number(
                                            unitEdits[s.id],
                                          );
                                          if (
                                            !Number.isFinite(primary) ||
                                            primary < 0
                                          ) {
                                            toast.error("P.U. invalide");
                                            return;
                                          }
                                          const usd = primaryAmountToUsd(
                                            primary,
                                            props.rate,
                                          );
                                          await updateStayGroupRoomRateAction({
                                            organizationId:
                                              props.organizationId,
                                            branchId: props.branchId,
                                            stayId: s.id,
                                            unitPriceAppliedUsd: usd,
                                            rateNote:
                                              rateNotes[s.id]?.trim() || null,
                                          });
                                          toast.success(
                                            `Tarif ch. ${s.room.number} mis à jour`,
                                          );
                                          refreshDetail();
                                        } catch (e) {
                                          toast.error(
                                            e instanceof Error
                                              ? e.message
                                              : "Tarif refusé",
                                          );
                                        }
                                      })
                                    }
                                  >
                                    Appliquer
                                  </Button>
                                </div>
                              ) : (
                                <span className="block text-right whitespace-nowrap">
                                  {formatPrimaryAmount(
                                    cancelled ? 0 : pricing.unit,
                                    props.rate,
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-medium">
                              {cancelled ? 0 : pricing.qty}
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">
                              {cancelled
                                ? moneyDossier(0)
                                : formatUsdLineTotal(
                                    pricing.qty,
                                    pricing.unit,
                                    props.rate,
                                  )}
                            </td>
                            <td className="p-2 text-xs">{s.status}</td>
                            <td className="p-2">
                              {cancelled ? null : (
                              <div className="flex flex-wrap gap-1">
                                {s.guestPending || s.status === "RESERVED" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setGuestStayId(s.id);
                                      setGuestForm({
                                        guestName: s.guestPending
                                          ? ""
                                          : s.guestName,
                                        guestPhone: s.guestPhone ?? "",
                                        guestAddress: s.guestAddress ?? "",
                                        guestCity: s.guestCity ?? "",
                                        idDocumentType: "CNI",
                                        idDocumentNumber:
                                          s.idDocumentNumber ?? "",
                                        idDocumentImageUrl:
                                          s.idDocumentImageUrl ?? "",
                                      });
                                    }}
                                  >
                                    {s.guestPending
                                      ? "Compléter identité"
                                      : "Modifier identité"}
                                  </Button>
                                ) : null}
                                {s.status === "RESERVED" ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-destructive"
                                    disabled={pending}
                                    onClick={() =>
                                      start(async () => {
                                        try {
                                          const { settlement } =
                                            await cancelStayInGroupAction({
                                              organizationId:
                                                props.organizationId,
                                              branchId: props.branchId,
                                              stayId: s.id,
                                            });
                                          toast.success(
                                            `Chambre ${s.room.number} annulée`,
                                          );
                                          notifySettlement(settlement);
                                          refreshDetail();
                                        } catch (e) {
                                          toast.error(
                                            e instanceof Error
                                              ? e.message
                                              : "Erreur",
                                          );
                                        }
                                      })
                                    }
                                  >
                                    Annuler
                                  </Button>
                                ) : null}
                              </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 text-sm font-medium">
                      <td colSpan={6} className="p-2 text-right">
                        Sous-total hébergement
                      </td>
                      <td className="p-2 text-right">
                        {detail.stays
                          .filter((s) => s.status !== "CANCELLED")
                          .reduce(
                            (n, s) => n + stayRoomPricing(s).qty,
                            0,
                          )}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {moneyDossier(dossierTotals.staySubtotal)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={pending || selected.length === 0}
                  onClick={() =>
                    start(async () => {
                      try {
                        await checkInStayGroupBatchAction({
                          organizationId: props.organizationId,
                          branchId: props.branchId,
                          stayIds: selected,
                        });
                        toast.success(`Check-in · ${selected.length} ch.`);
                        setSelected([]);
                        refreshDetail();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Check-in refusé",
                        );
                      }
                    })
                  }
                >
                  Check-in lot ({selected.length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending || selected.length === 0}
                  onClick={() =>
                    start(async () => {
                      try {
                        const { cancelled, settlement } =
                          await cancelStayGroupBatchAction({
                            organizationId: props.organizationId,
                            branchId: props.branchId,
                            stayIds: selected,
                          });
                        toast.success(`${cancelled} chambre(s) annulée(s)`);
                        notifySettlement(settlement);
                        setSelected([]);
                        refreshDetail();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Annulation refusée",
                        );
                      }
                    })
                  }
                >
                  Annuler sélection ({selected.length})
                </Button>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Paiement dossier</p>
                    <p className="text-xs text-muted-foreground">
                      Après annulation / conso réelle : remboursement ou
                      complément
                    </p>
                  </div>
                  <div className="text-right text-sm space-y-0.5 min-w-[11rem]">
                    <p>
                      Total dû{" "}
                      <span className="font-semibold">
                        {moneyDossier(dossierTotals.charges)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Déjà réglé {moneyDossier(dossierTotals.paid)}
                    </p>
                    {dossierTotals.refundDue > 0 ? (
                      <p className="text-base font-semibold text-amber-700 dark:text-amber-400">
                        À rembourser {moneyDossier(dossierTotals.refundDue)}
                      </p>
                    ) : dossierTotals.dueFromClient > 0 ? (
                      <p className="text-base font-semibold">
                        Solde {moneyDossier(dossierTotals.dueFromClient)}
                      </p>
                    ) : (
                      <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                        Solde {moneyDossier(0)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label>
                      Montant ({primaryCurrencyLabel(props.rate)})
                    </Label>
                    <Input
                      className="w-32"
                      type="number"
                      step={primaryPriceInputStep(props.rate)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </div>
                  <PosPayMethodPicker
                    value={payMethod}
                    onChange={setPayMethod}
                    includeBank
                  />
                  {dossierTotals.dueFromClient > 0 ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setPayAmount(
                            dossierTotals.amountsArePrimary
                              ? String(Math.round(dossierTotals.dueFromClient))
                              : formatUsdPrimaryInputValue(
                                  dossierTotals.dueFromClient,
                                  props.rate,
                                ),
                          );
                        }}
                      >
                        Remplir solde
                      </Button>
                      <Button
                        size="sm"
                        disabled={pending || !(Number(payAmount) > 0)}
                        onClick={() => {
                          const usd = primaryAmountToUsd(
                            Number(payAmount),
                            props.rate,
                          );
                          payDossier(usd);
                        }}
                      >
                        Encaisser
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          payDossier(toUsdForAction(dossierTotals.dueFromClient))
                        }
                      >
                        Payer le solde
                      </Button>
                    </>
                  ) : null}
                  {dossierTotals.refundDue > 0 ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setPayAmount(
                            dossierTotals.amountsArePrimary
                              ? String(Math.round(dossierTotals.refundDue))
                              : formatUsdPrimaryInputValue(
                                  dossierTotals.refundDue,
                                  props.rate,
                                ),
                          );
                        }}
                      >
                        Remplir remboursement
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending || !(Number(payAmount) > 0)}
                        onClick={() => {
                          const usd = primaryAmountToUsd(
                            Number(payAmount),
                            props.rate,
                          );
                          refundDossier(usd);
                        }}
                      >
                        Rembourser
                      </Button>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          refundDossier(
                            toUsdForAction(dossierTotals.refundDue),
                          )
                        }
                      >
                        Rembourser le trop-perçu
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium">Facture globale</p>
                <p className="text-xs text-muted-foreground">
                  Aperçu / proforma ·{" "}
                  {dossierTotals.refundDue > 0
                    ? `à rembourser ${moneyDossier(dossierTotals.refundDue)}`
                    : dossierTotals.dueFromClient > 0
                      ? `à payer ${moneyDossier(dossierTotals.dueFromClient)}`
                      : "soldé"}{" "}
                  · signatures gérant + société/booker
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        try {
                          const { html, invoice } =
                            await previewStayGroupInvoiceAction({
                              organizationId: props.organizationId,
                              branchId: props.branchId,
                              bookingId: detail.id,
                            });
                          openInvoiceHtml(html);
                          toast.message(
                            invoice.isProforma
                              ? `Proforma · solde ${formatPrimaryAmount(invoice.balance, props.rate)}`
                              : `Facture · solde ${formatPrimaryAmount(invoice.balance, props.rate)}`,
                          );
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Aperçu impossible",
                          );
                        }
                      })
                    }
                  >
                    Aperçu / proforma
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        try {
                          const { html, invoiceNumber } =
                            await issueStayGroupInvoiceAction({
                              organizationId: props.organizationId,
                              branchId: props.branchId,
                              bookingId: detail.id,
                            });
                          openInvoiceHtml(html);
                          toast.success(
                            `Facture archivée ${invoiceNumber} · signatures`,
                          );
                          refreshDetail();
                        } catch (e) {
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Facture impossible",
                          );
                        }
                      })
                    }
                  >
                    {detail.invoiceNumber
                      ? "Réimprimer (archivé)"
                      : "Archiver + signatures"}
                  </Button>
                  {detail.invoiceNumber ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending || Boolean(detail.invoiceHandedOverAt)}
                      onClick={() =>
                        start(async () => {
                          try {
                            await markStayGroupInvoiceHandedOverAction({
                              organizationId: props.organizationId,
                              branchId: props.branchId,
                              bookingId: detail.id,
                            });
                            toast.success("Remise enregistrée");
                            refreshDetail();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Erreur",
                            );
                          }
                        })
                      }
                    >
                      {detail.invoiceHandedOverAt
                        ? "Remise OK"
                        : detail.partner
                          ? "Remise à la société"
                          : "Remise au booker"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(guestStayId)}
        onOpenChange={(v) => {
          if (!v) setGuestStayId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Identité occupant</DialogTitle>
            <DialogDescription>
              Saisie sur place pour cette chambre du dossier
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <div>
              <Label>Nom *</Label>
              <Input
                value={guestForm.guestName}
                onChange={(e) =>
                  setGuestForm((f) => ({ ...f, guestName: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                value={guestForm.guestPhone}
                onChange={(e) =>
                  setGuestForm((f) => ({ ...f, guestPhone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Adresse *</Label>
              <Input
                value={guestForm.guestAddress}
                onChange={(e) =>
                  setGuestForm((f) => ({ ...f, guestAddress: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Ville *</Label>
              <Input
                value={guestForm.guestCity}
                onChange={(e) =>
                  setGuestForm((f) => ({ ...f, guestCity: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Pièce</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={guestForm.idDocumentType}
                  onChange={(e) =>
                    setGuestForm((f) => ({
                      ...f,
                      idDocumentType: e.target.value as GuestIdDocType,
                    }))
                  }
                >
                  {GUEST_ID_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {guestIdDocLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>N°</Label>
                <Input
                  value={guestForm.idDocumentNumber}
                  onChange={(e) =>
                    setGuestForm((f) => ({
                      ...f,
                      idDocumentNumber: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Scan / photo *</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await readGuestIdFileAsDataUrl(file);
                    setGuestForm((f) => ({
                      ...f,
                      idDocumentImageUrl: url,
                    }));
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Image invalide",
                    );
                  }
                }}
              />
              {guestForm.idDocumentImageUrl ? (
                <p className="mt-1 text-xs text-emerald-700">Image OK</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuestStayId(null)}>
              Annuler
            </Button>
            <Button
              disabled={pending || !guestStayId}
              onClick={() =>
                start(async () => {
                  if (!guestStayId) return;
                  try {
                    await completeStayGuestAction({
                      organizationId: props.organizationId,
                      branchId: props.branchId,
                      stayId: guestStayId,
                      ...guestForm,
                    });
                    toast.success("Occupant enregistré");
                    setGuestStayId(null);
                    refreshDetail();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Enregistrement refusé",
                    );
                  }
                })
              }
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
