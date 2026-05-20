"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, User, Navigation, Ticket, Plane } from "lucide-react";
import { createReservation } from "./client.action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import PhoneInput from "react-phone-number-input";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import "react-phone-number-input/style.css";
import { searchClients } from "./client.action";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";
interface Passager {
  nom: string;
  prenom: string;
  isClient: boolean;
  categorie: "ADULTE" | "ENFANT" | "BEBE";
  dateNaissance?: string;
  sexe: string;
  // 🆕 colis
  surplusKilos?: number;
  typeColis?: "ORDINAIRE" | "SPECIAL";
  montantColis?: number; // utilisé si SPECIAL
  poids?: number;
}
interface FormData {
  nom: string;
  postnom: string;
  prenom: string;
  dateInscription: string;
  dateDepart?: string;
  dateLimiteReport?: string;
  penalite?: number;
  telephone: string;
  email?: string;
  adresse?: string;
  nationalite?: string;
  statut: string;
  trajetId: string;
  trajetDepartId: string; // 🆕 IMPORTANT
  modePaiement: "CASH" | "MOBILE" | "CARD" | "";
  statutPaiement: "PENDING";
  statutReservation?: "CONFIRME" | "EMBARQUE" | "RATE" | "REPORTE" | "ANNULE";
  nombrePlaces: number;
  passagers: Passager[];
  commentaireColis?: string;
  societe?: string;
}
interface TrajetDepart {
  id: string;
  dateDepart: string;
  heureDepart?: string;
}
export default function RegistrationPage({ trajets }: { trajets: any[] }) {
  const { data: session } = useSession();
  const organizationId = session?.organization?.id ?? "";
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [showPaymentDialog, setShowPaymentDialog] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(false);
  const [selecting, setSelecting] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [existingClient, setExistingClient] = React.useState<any | null>(null);
  const [colis, setColis] = React.useState({
    typeColis: "",
    poids: 0,
    kilosSupplement: 0,
    montant: 0,
    commentaireColis: "",
  });
  const [formData, setFormData] = React.useState<FormData>({
    nom: "",
    postnom: "",
    prenom: "",
    dateInscription: "",
    telephone: "",
    email: "",
    adresse: "",
    nationalite: "",
    statut: "actif",
    trajetId: "",
    modePaiement: "CASH",
    statutPaiement: "PENDING",
    nombrePlaces: 0,
    commentaireColis: "",
    dateDepart: "",
    dateLimiteReport: "",
    penalite: 0,
    trajetDepartId: "", // 🆕 IMPORTANT
    statutReservation: "CONFIRME",
    passagers: [
      {
        nom: "",
        prenom: "",
        isClient: true,
        categorie: "ADULTE",
        sexe: "M",
        dateNaissance: "",
        surplusKilos: 0,
        typeColis: "ORDINAIRE",
        montantColis: 0,
        poids: 0,
      },
    ],
  });
  const selectedTrajet = trajets.find((t) => t.id === formData.trajetId);
  const kilosGratuits = selectedTrajet?.kilosGratuits || 0;
  const totalKilosAutorises = kilosGratuits * formData.nombrePlaces;
  const selectedDepart = selectedTrajet?.trajetDepart?.find(
    (d: TrajetDepart) => d.id === formData.trajetDepartId
  );

  const flightsByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();

    trajets.forEach((trajet) => {
      trajet.trajetDepart?.forEach((d: any) => {
        const key = new Date(d.dateDepart).toDateString();

        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          ...d,
          trajet,
        });
      });
    });

    return map;
  }, [trajets]);
  const today = new Date();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenCalendar(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const availableDates = selectedTrajet?.trajetDepart?.map((d: TrajetDepart) =>
    new Date(d.dateDepart).toDateString()
  );
  const availableDatesSet = React.useMemo(() => {
    return new Set(availableDates);
  }, [availableDates]);
  React.useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      setLoading(true);

      const data = await searchClients(query, organizationId);

      setResults(data);
      setOpen(true);

      setLoading(false);
    }, 400);

    return () => clearTimeout(delay);
  }, [query]);

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const handleClientSexeChange = (value: string) => {
    const updated = [...formData.passagers];
    updated[0] = {
      ...updated[0],
      sexe: value,
    };

    setFormData((prev) => ({
      ...prev,
      passagers: updated,
    }));
  };

  const handlePlacesChange = (value: number) => {
    setFormData((prev) => {
      // 🚨 CAS IMPORTANT : 0 PASSAGER
      if (value === 0) {
        return {
          ...prev,
          nombrePlaces: 0,
          passagers: [], // 🔥 aucun passager
        };
      }

      const passagers = [...prev.passagers];

      // 👤 premier passager = client
      const baseClient: Passager = {
        nom: prev.nom,
        prenom: prev.prenom,
        isClient: true,
        categorie: "ADULTE",
        sexe: "M",
        dateNaissance: prev.dateInscription || "",
        surplusKilos: 0,
        typeColis: "ORDINAIRE",
        montantColis: 0,
      };

      const newPassagers = [baseClient];

      for (let i = 1; i < value; i++) {
        newPassagers.push({
          nom: passagers[i]?.nom || "",
          prenom: passagers[i]?.prenom || "",
          isClient: false,
          sexe: passagers[i]?.sexe || "M",
          categorie: passagers[i]?.categorie || "ADULTE",
          dateNaissance: passagers[i]?.dateNaissance || "",
          surplusKilos: passagers[i]?.surplusKilos || 0,
          typeColis: passagers[i]?.typeColis || "ORDINAIRE",
          montantColis: passagers[i]?.montantColis || 0,
        });
      }

      return {
        ...prev,
        nombrePlaces: value,
        passagers: newPassagers,
      };
    });
  };

  const handlePassengerChange = (index: number, field: keyof Passager, value: any) => {
    const updated = [...formData.passagers];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setFormData({ ...formData, passagers: updated });
  };
  const isPhoneValid = /^\+?[0-9]{10,13}$/.test(formData.telephone);
  const isFormValid =
    formData.telephone &&
    isPhoneValid &&
    formData.trajetId &&
    (formData.nombrePlaces > 0 ? formData.nom && formData.prenom : colis.typeColis);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      const payload = {
        clientId: existingClient?.id ?? null,

        client: {
          nom: formData.nom,
          prenom: formData.prenom,
          telephone: formData.telephone,
          email: formData.email,
          adresse: formData.adresse,
          societe: formData.societe,
          dateInscription: formData.dateInscription,
        },

        trajetId: formData.trajetId,
        modePaiement: formData.modePaiement,
        statutPaiement: "PENDING",
        nombrePlaces: formData.nombrePlaces,

        dateDepart: selectedDepart?.dateDepart,
        heureDepart: selectedDepart?.heureDepart,
        trajetDepartId: formData.trajetDepartId,

        dateLimiteReport: selectedDepart?.dateDepart
          ? new Date(new Date(selectedDepart.dateDepart).getTime() - 24 * 60 * 60 * 1000)
          : null,

        statutReservation: "CONFIRME",
        penalite: 0,

        passagers: passagersAvecPrix.map((p, i) => ({
          nom: i === 0 ? formData.nom : p.nom,
          prenom: i === 0 ? formData.prenom : p.prenom,
          categorie: p.categorie,
          sexe: p.sexe,
          dateNaissance: p.dateNaissance,
          prix: p.prix,
          isClient: i === 0,
        })),

        colis: {
          type: colis.typeColis,
          poids: `${(colis.kilosSupplement ?? 0) + (selectedTrajet?.kilosGratuits ?? 0)}`,
          kilosSupplement: colis.kilosSupplement,
          kilosGratuits: selectedTrajet.kilosGratuits,
          montant: colis.montant,
          commentaire: colis.commentaireColis,
          prix: prixColisGlobal,
        },

        pricing: {
          totalPassagers,
          totalColis: prixColisGlobal,
          total: totalPrix,
        },
      };

      const res = await createReservation(payload);

      if (!res.success) {
        toast.error(res.message || "Erreur lors de la réservation");
        return;
      }

      toast.success("Réservation créée avec succès");

      setShowPaymentDialog(false);
      setShowSuccess(true);

      router.refresh();
    } catch (error) {
      console.error(error);

      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };
  const prixBase = selectedTrajet?.prixBase || 0;

  const passagersAvecPrix = formData.passagers.map((p) => {
    let coef = 1;

    if (p.categorie === "BEBE") coef = 0;
    else if (p.categorie === "ENFANT") coef = 0.5;

    const prixPassager = prixBase * coef;

    let prixColis = 0;

    if (p.typeColis === "ORDINAIRE") {
      prixColis = (p.surplusKilos || 0) * (selectedTrajet?.prixParKilo || 0);
    } else {
      prixColis = p.montantColis || 0;
    }

    return {
      ...p,
      prix: prixPassager + prixColis,
    };
  });
  const handleColisChange = (field: string, value: any) => {
    setColis((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  let prixColisGlobal = 0;

  if (colis.typeColis === "ORDINAIRE") {
    prixColisGlobal = (colis.kilosSupplement || 0) * (selectedTrajet?.prixParKilo || 0);
  }

  if (colis.typeColis === "SPECIAL") {
    prixColisGlobal = colis.montant || 0;
  }
  const totalPassagers = passagersAvecPrix.reduce((acc, p) => acc + p.prix, 0);

  const totalPrix = totalPassagers + prixColisGlobal;
  React.useEffect(() => {
    if (formData.nombrePlaces === 0) {
      setFormData((prev) => ({
        ...prev,
        passagers: [],
      }));
    }
  }, [formData.nombrePlaces]);
  React.useEffect(() => {
    setExistingClient(null);

    setFormData((prev) => ({
      ...prev,
      nom: "",
      prenom: "",
      telephone: "",
      email: "",
      adresse: "",
      societe: "",
      dateInscription: "",
    }));
  }, [query]);
  const MAX_DIGITS = 15;
  return (
    <div className="min-h-screen">
      <PageHeader title="Inscription" subtitle="Nouvelle réservation" showBack />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* CLIENT INFO */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Informations de client</CardTitle>
                <CardDescription>Details client</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Rechercher client (nom, téléphone...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {loading && <p className="text-xs text-muted-foreground mt-1">Recherche...</p>}

              {open && results.length > 0 && (
                <div className="absolute z-50 w-full bg-white border rounded-md shadow max-h-60 overflow-auto">
                  {results.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 hover:bg-muted cursor-pointer"
                      onClick={() => {
                        setExistingClient(c); // ✅ IMPORTANT
                        setFormData((prev) => ({
                          ...prev,
                          clientId: c.id,
                          nom: c.nom,
                          prenom: c.prenom,
                          telephone: c.telephone,
                          email: c.email,
                          societe: c.societe,
                          adresse: c.adresse,
                          dateInscription: c.dateInscription,
                        }));

                        //setQuery(`${c.nom} ${c.prenom}`);
                        setOpen(false);
                      }}
                    >
                      <div className="font-medium">
                        {c.nom} {c.prenom}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.telephone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nom *</Label>
                <Input
                  placeholder="Nom"
                  value={formData.nom}
                  onChange={(e) => handleChange("nom", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Prenom *</Label>
                <Input
                  placeholder="Prenom"
                  value={formData.prenom || ""}
                  onChange={(e) => handleChange("prenom", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  type="date"
                  value={formData.dateInscription || ""}
                  onChange={(e) => handleChange("dateInscription", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <PhoneInput
                  international
                  defaultCountry="CD"
                  value={formData.telephone || ""}
                  onChange={(value: string | undefined) => {
                    if (!value) return handleChange("telephone", "");

                    const digits = value.replace(/\D/g, "").slice(0, MAX_DIGITS);

                    handleChange("telephone", `+${digits}`);
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    const value = formData.telephone || "";
                    const digits = value.replace(/\D/g, "");

                    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

                    if (allowedKeys.includes(e.key)) return;

                    if (digits.length >= MAX_DIGITS) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
                    const paste = e.clipboardData.getData("text");

                    const digits = paste.replace(/\D/g, "").slice(0, MAX_DIGITS);

                    e.preventDefault();
                    handleChange("telephone", `+${digits}`);
                  }}
                  className="flex items-center gap-2 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus-within:ring-2 focus-within:ring-primary"
                  countrySelectProps={{
                    className: "text-xs w-[70px] border-none bg-transparent focus:outline-none",
                  }}
                  numberInputProps={{
                    className:
                      "flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground",
                    maxLength: MAX_DIGITS + 1,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Société</Label>
                <Input
                  placeholder="Nom de l'entreprise"
                  value={formData.societe || ""}
                  onChange={(e) => handleChange("societe", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email (*)</Label>
                <Input
                  placeholder="Email"
                  value={formData.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>
            </div>
            <Textarea
              placeholder="Adresse"
              value={formData.adresse || ""}
              onChange={(e) => handleChange("adresse", e.target.value)}
            />
          </CardContent>
        </Card>

        {/* TRAJET + PLACES */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Navigation className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Trajectoire</CardTitle>
                <CardDescription>Details trajet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Select
                  value={formData.trajetId}
                  onChange={(e) => handleChange("trajetId", e.target.value)}
                >
                  <option value="">Choisir un trajet</option>
                  {trajets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.villeDepart} → {t.villeArrivee}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Select
                  value={formData.nombrePlaces}
                  onChange={(e) => handlePlacesChange(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Colis uniquement" : n === 1 ? "1 place" : `${n} place(s)`}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 ">
              {selectedTrajet && (
                <div className="space-y-2">
                  <Label>Départ disponible</Label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 absolute">
                    {/* INPUT */}
                    <Input
                      readOnly
                      value={
                        selectedDepart
                          ? `${new Date(selectedDepart.dateDepart).toLocaleDateString()} - ${selectedDepart.heureDepart}`
                          : ""
                      }
                      placeholder="Choisir une date de départ"
                      onClick={() => setOpenCalendar(true)}
                      className="w-full"
                    />

                    {/* CALENDAR POPUP */}
                    {openCalendar && (
                      <div
                        ref={ref}
                        className="
      absolute top-full left-0 mt-2
      z-[9999]
      w-full sm:w-auto
      min-w-[280px]
      bg-white
      shadow-2xl
      rounded-xl
      border
      p-2
    "
                      >
                        <DayPicker
                          mode="single"
                          selected={selectedDate}
                          className="w-full"
                          classNames={{
                            months: "flex justify-center",
                            month: "w-full",
                          }}
                          disabled={(date) => !availableDatesSet.has(date.toDateString())}
                          modifiers={{
                            available: (date) => availableDatesSet.has(date.toDateString()),
                          }}
                          modifiersClassNames={{
                            available: "bg-green-500 text-white rounded-md",
                          }}
                          onSelect={(date) => {
                            if (!date) return;

                            setSelectedDate(date);

                            const depart = selectedTrajet?.trajetDepart?.find(
                              (d: TrajetDepart) =>
                                new Date(d.dateDepart).toDateString() === date.toDateString()
                            );

                            if (!depart) return;

                            setFormData((prev) => ({
                              ...prev,
                              dateDepart: depart.dateDepart,
                              trajetDepartId: depart.id,
                            }));

                            setOpenCalendar(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Mode paiement (*)</Label>
                <Select
                  value={formData.modePaiement}
                  onChange={(e) => handleChange("modePaiement", e.target.value)}
                >
                  <option value="">Choisir</option>
                  <option value="CASH">Cash (Agence)</option>
                  <option value="MOBILE">Mobile Money</option>
                  <option value="CARD">Carte bancaire</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PASSAGERS */}
        {formData.nombrePlaces > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Ticket className="size-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-base">Passages</CardTitle>
                  <CardDescription>Details passages</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.passagers.map((p, i) => (
                <div key={i} className="border p-3 rounded-md space-y-2">
                  <div className="text-sm font-medium">
                    Passager {i + 1} {p.isClient}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Input
                        placeholder="Prenom"
                        value={i === 0 ? formData.prenom : p.prenom}
                        onChange={(e) => {
                          if (i === 0) {
                            handleChange("prenom", e.target.value);
                          } else {
                            handlePassengerChange(i, "prenom", e.target.value);
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Nom"
                        value={i === 0 ? formData.nom : p.nom}
                        onChange={(e) => {
                          if (i === 0) {
                            handleChange("nom", e.target.value);
                          } else {
                            handlePassengerChange(i, "nom", e.target.value);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Select
                        value={p.categorie}
                        onChange={(e) => handlePassengerChange(i, "categorie", e.target.value)}
                      >
                        <option value="ADULTE">Adulte</option>
                        <option value="ENFANT">Enfant</option>
                        <option value="BEBE">Bébé</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Select
                        value={formData.passagers[0].sexe}
                        onChange={(e) => handleClientSexeChange(e.target.value)}
                      >
                        <option value="">Sexe</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </Select>
                    </div>
                  </div>
                  <Input
                    type="date"
                    value={p.dateNaissance || ""}
                    onChange={(e) => handlePassengerChange(i, "dateNaissance", e.target.value)}
                  />
                  {p.categorie === "BEBE" && (
                    <p className="text-xs text-muted-foreground">
                      Bébé: ne prend pas de place, tarif réduit
                    </p>
                  )}
                  {selectedTrajet && (
                    <div className="text-sm bg-muted/50 p-3 rounded-md space-y-1">
                      <p>
                        🎒 Kilos gratuits / passager:{" "}
                        <strong>{selectedTrajet.kilosGratuits} kg</strong>
                      </p>
                      <p>
                        🧮 Total autorisé: <strong>{totalKilosAutorises} kg</strong>
                      </p>
                      <p>
                        💰 Prix par kilo supplémentaire:{" "}
                        <strong>{selectedTrajet.prixParKilo} $ / kg</strong>
                      </p>
                    </div>
                  )}
                  <div className="text-sm font-medium flex justify-between items-center">
                    {selectedTrajet && (
                      <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-semibold">
                        {passagersAvecPrix[i].prix.toFixed(2)} $
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
            {selectedTrajet && (
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border flex justify-between items-center">
                <span className="font-medium">Total à payer</span>
                <span className="text-lg font-bold text-primary">{totalPrix.toFixed(2)} $</span>
              </div>
            )}
          </Card>
        )}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plane className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Colis</CardTitle>
                <CardDescription>Informations du colis</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Select
              value={colis.typeColis || ""}
              onChange={(e) => handleColisChange("typeColis", e.target.value)}
            >
              <option value="">Type colis</option>
              <option value="ORDINAIRE">Ordinaire</option>
              <option value="SPECIAL">Spécial</option>
            </Select>
            {/* ORDINAIRE */}
            {colis.typeColis === "ORDINAIRE" && (
              <Input
                type="number"
                placeholder="Kilos supplémentaires"
                value={colis.kilosSupplement || 0}
                onChange={(e) => handleColisChange("kilosSupplement", Number(e.target.value))}
              />
            )}
            {/* SPECIAL */}
            {colis.typeColis === "SPECIAL" && (
              <>
                {/* POIDS (toujours obligatoire) */}
                <Input
                  type="number"
                  placeholder="Poids colis (kg)"
                  value={colis.poids || 0}
                  onChange={(e) => handleColisChange("poids", Number(e.target.value))}
                />
                {/*Montant manuel */}
                <Input
                  type="number"
                  placeholder="Montant colis"
                  value={colis.montant || 0}
                  onChange={(e) => handleColisChange("montant", Number(e.target.value))}
                />
              </>
            )}
            {/* COMMENTAIRE */}{" "}
            {colis.typeColis && (
              <Textarea
                placeholder="Commentaire (fragile, urgent, etc.)"
                value={colis.commentaireColis || ""}
                onChange={(e) => handleColisChange("commentaireColis", e.target.value)}
              />
            )}
            {/* PRIX AUTO */}
            {colis.typeColis && (
              <div className="text-sm bg-muted/50 p-3 rounded">
                💰 Prix colis :{" "}
                <strong>
                  {colis.typeColis === "ORDINAIRE"
                    ? ((colis.kilosSupplement || 0) * (selectedTrajet?.prixParKilo || 0)).toFixed(2)
                    : (colis.montant || 0).toFixed(2)}{" "}
                  $
                </strong>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SUBMIT */}

        <div className="sticky bottom-20 md:bottom-4 pt-4 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 pb-4">
          {/* <Button
            type="submit"
            className="w-full h-12"
            size="lg"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="size-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Inscription en cours...
              </>
            ) : (
              <>
                <Check className="size-5 mr-2" />
                {isSubmitting ? "En cours..." : "Créer réservation"}
              </>
            )}
          </Button> */}
          <Button
            type="button"
            className="w-full h-12"
            size="lg"
            disabled={!isFormValid}
            onClick={() => setShowPaymentDialog(true)}
          >
            <Check className="size-5 mr-2" />
            Continuer vers paiement
          </Button>
        </div>
      </form>

      {/* SUCCESS */}
      <ResponsiveDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Paiement</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Complétez les informations de paiement
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4">
            {/* MOBILE MONEY */}
            {formData.modePaiement === "MOBILE" && (
              <>
                <Input placeholder="Numéro téléphone (ex: 243...)" />
                <Input placeholder="Nom titulaire" />
              </>
            )}

            {/* CARTE */}
            {formData.modePaiement === "CARD" && (
              <>
                <Input placeholder="Numéro de carte" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="MM/YY" />
                  <Input placeholder="CVV" />
                </div>
                <Input placeholder="Nom sur la carte" />
              </>
            )}

            {/* CASH */}
            {formData.modePaiement === "CASH" && (
              <p className="text-sm text-muted-foreground">Paiement à effectuer en agence</p>
            )}

            <div className="p-3 rounded-lg bg-muted flex justify-between">
              <span>Total</span>
              <strong>{totalPrix.toFixed(2)} $</strong>
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button
              onClick={() => {
                setShowPaymentDialog(false);
                handleSubmit(new Event("submit") as any);
              }}
            >
              Confirmer paiement
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
