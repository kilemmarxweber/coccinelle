"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, User, Users, Navigation, Ticket, Plane } from "lucide-react";

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

interface Passager {
  nom: string;
  prenom: string;
  isClient: boolean;
  categorie: "ADULTE" | "ENFANT" | "BEBE";
  dateNaissance?: string;
}
interface FormData {
  nom: string;
  postnom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  telephone: string;
  email?: string;
  adresse?: string;
  nationalite?: string;
  statut: string;
  trajetId: string;

  nombrePlaces: number;
  passagers: Passager[];
}

export default function RegistrationPage({ trajets }: { trajets: any[] }) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const [formData, setFormData] = React.useState<FormData>({
    nom: "",
    postnom: "",
    prenom: "",
    sexe: "",
    dateNaissance: "",
    telephone: "",
    email: "",
    adresse: "",
    nationalite: "",
    statut: "actif",
    trajetId: "",

    nombrePlaces: 1,
    passagers: [
      {
        nom: "",
        prenom: "",
        isClient: true,
        categorie: "ADULTE",
        dateNaissance: "",
      },
    ],
  });
  const selectedTrajet = trajets.find((t) => t.id === formData.trajetId);
  const kilosGratuits = selectedTrajet?.kilosGratuits || 0;
  const totalKilosAutorises = kilosGratuits * formData.nombrePlaces;

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlacesChange = (value: number) => {
    setFormData((prev) => {
      const passagers = [...prev.passagers];

      // toujours au moins 1 passager (client)
      const baseClient: Passager = {
        nom: prev.nom,
        prenom: prev.prenom,
        isClient: true,
        categorie: "ADULTE",
        dateNaissance: prev.dateNaissance || "",
      };

      const newPassagers = [baseClient];

      for (let i = 1; i < value; i++) {
        newPassagers.push({
          nom: passagers[i]?.nom || "",
          prenom: passagers[i]?.prenom || "",
          isClient: false,
          categorie: passagers[i]?.categorie || "ADULTE",
          dateNaissance: passagers[i]?.dateNaissance || "",
        });
      }

      return {
        ...prev,
        nombrePlaces: value,
        passagers: newPassagers,
      };
    });
  };

  const handlePassengerChange = (index: number, field: keyof Passager, value: string) => {
    const updated = [...formData.passagers];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setFormData({ ...formData, passagers: updated });
  };

  const isFormValid =
    formData.nom && formData.prenom && formData.sexe && formData.telephone && formData.trajetId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 🔥 client devient passager 0 automatiquement
    const passagersFinal = formData.passagers.map((p, index) => {
      const base = {
        nom: index === 0 ? formData.nom : p.nom,
        prenom: index === 0 ? formData.prenom : p.prenom,
        categorie: p.categorie,
        dateNaissance: p.dateNaissance,
        isClient: index === 0,
      };

      // 💡 logique métier
      let prix = 0;
      let occupePlace = true;

      if (p.categorie === "BEBE") {
        prix = 0; // gratuit ou réduit
        occupePlace = false;
      } else if (p.categorie === "ENFANT") {
        prix = 0.5; // ex: 50% (tu ajusteras backend)
      } else {
        prix = 1;
      }

      return {
        ...base,
        prix,
        occupePlace,
      };
    });

    const payload = {
      ...formData,
      passagers: passagersFinal,
    };

    console.log("PAYLOAD:", payload);

    await new Promise((r) => setTimeout(r, 1500));

    setIsSubmitting(false);
    setShowSuccess(true);
  };

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
                  value={formData.prenom}
                  onChange={(e) => handleChange("prenom", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Select
                  value={formData.sexe}
                  onChange={(e) => handleChange("sexe", e.target.value)}
                >
                  <option value="">Sexe</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Input
                  type="date"
                  value={formData.dateNaissance}
                  onChange={(e) => handleChange("dateNaissance", e.target.value)}
                />
              </div>
            </div>
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

            <Select
              value={formData.nombrePlaces}
              onChange={(e) => handlePlacesChange(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} place(s)
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        {/* PASSAGERS */}
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
                  Passager {i + 1} {p.isClient && "(Client)"}
                </div>

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
                <Select
                  value={p.categorie}
                  onChange={(e) => handlePassengerChange(i, "categorie", e.target.value)}
                >
                  <option value="ADULTE">Adulte</option>
                  <option value="ENFANT">Enfant</option>
                  <option value="BEBE">Bébé</option>
                </Select>

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
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CONTACT */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Users className="size-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">Contact client</CardTitle>
                <CardDescription>Informations du responsable</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Téléphone"
              value={formData.telephone}
              onChange={(e) => handleChange("telephone", e.target.value)}
            />

            <Input
              placeholder="Email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />

            <Textarea
              placeholder="Adresse"
              value={formData.adresse}
              onChange={(e) => handleChange("adresse", e.target.value)}
            />
          </CardContent>
        </Card>

        {/* SUBMIT */}

        <div className="sticky bottom-20 md:bottom-4 pt-4 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 pb-4">
          <Button
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
          </Button>
        </div>
      </form>

      {/* SUCCESS */}
      <ResponsiveDialog open={showSuccess} onOpenChange={() => setShowSuccess(false)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Succès</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Réservation créée avec succès</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <ResponsiveDialogFooter>
            <Button onClick={() => router.push("/")}>OK</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
