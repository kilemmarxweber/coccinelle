import Link from "next/link";
import {
  ArrowRight,
  Plane,
  Bus,
  MapPin,
  Sparkles,
  ShieldCheck,
  Clock3,
} from "lucide-react";

import Navbar from "@/app/components/navbar";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      {/* Navbar */}
      <Navbar />
      <main className="relative z-0 pt-6">
        {/* HERO */}
        <section className="relative isolate overflow-hidden">
          {/* Glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-6xl px-4 pt-20 pb-20">
            <div className="text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/70 px-4 py-2 text-sm shadow-sm backdrop-blur">
                <Sparkles className="size-4 text-primary" />
                Plateforme intelligente de voyage en RDC
              </div>

              <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight md:text-6xl">
                Voyagez facilement en{" "}
                <span className="text-primary">avion</span> ✈️ et en{" "}
                <span className="text-primary">bus</span> 🚌
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Réservez vos trajets, gérez vos passagers et expédiez vos colis
                partout en République Démocratique du Congo.
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 rounded-2xl px-6 text-base shadow-lg"
                >
                  <Link href="/trajets" className="inline-flex items-center">
                    Réserver maintenant
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-2xl px-6 text-base"
                >
                  <Link href="/agences">
                    Voir les agences
                  </Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border bg-background/70 p-6 backdrop-blur">
                  <div className="mb-3 inline-flex rounded-2xl bg-primary/10 p-3">
                    <Plane className="size-5 text-primary" />
                  </div>

                  <h3 className="text-3xl font-bold">120+</h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Vols disponibles chaque semaine
                  </p>
                </div>

                <div className="rounded-3xl border bg-background/70 p-6 backdrop-blur">
                  <div className="mb-3 inline-flex rounded-2xl bg-primary/10 p-3">
                    <Bus className="size-5 text-primary" />
                  </div>

                  <h3 className="text-3xl font-bold">80+</h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Lignes de bus connectées
                  </p>
                </div>

                <div className="rounded-3xl border bg-background/70 p-6 backdrop-blur">
                  <div className="mb-3 inline-flex rounded-2xl bg-primary/10 p-3">
                    <ShieldCheck className="size-5 text-primary" />
                  </div>

                  <h3 className="text-3xl font-bold">100%</h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Paiements et réservations sécurisés
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Nos services
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Une plateforme moderne pour voyager
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Flights */}
            <Card className="group overflow-hidden rounded-3xl border-0 bg-background shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <div className="relative h-52 overflow-hidden">
                <div className="absolute inset-0 bg-[url('/vols.jpg')] bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                <div className="absolute bottom-5 left-5">
                  <div className="mb-3 inline-flex rounded-2xl bg-white/20 p-3 backdrop-blur">
                    <Plane className="size-6 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-white">
                    Offres Vols
                  </h3>
                </div>
              </div>

              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  Réservez vos billets d’avion aux meilleurs prix pour voyager
                  rapidement partout en RDC.
                </p>

                <Button className="mt-5 rounded-2xl">
                  <Link href="/vols" className="inline-flex items-center">
                    Réserver un vol
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Bus */}
            <Card className="group overflow-hidden rounded-3xl border-0 bg-background shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <div className="relative h-52 overflow-hidden">
                <div className="absolute inset-0 bg-[url('/bus.jpg')] bg-cover bg-center transition-transform duration-500 group-hover:scale-105" />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                <div className="absolute bottom-5 left-5">
                  <div className="mb-3 inline-flex rounded-2xl bg-white/20 p-3 backdrop-blur">
                    <Bus className="size-6 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-white">
                    Offres Bus
                  </h3>
                </div>
              </div>

              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  Trouvez des trajets rapides, économiques et confortables entre
                  les grandes villes du Congo.
                </p>

                <Button className="mt-5 rounded-2xl">
                  <Link href="/bus" className="inline-flex items-center">
                    Voir les trajets
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* POPULAR ROUTES */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Destinations populaires
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Trajets les plus demandés
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { from: "Kinshasa", to: "Matadi" },
              { from: "Kinshasa", to: "Lubumbashi" },
              { from: "Kinshasa", to: "Goma" },
              { from: "Lubumbashi", to: "Kolwezi" },
              { from: "Goma", to: "Bukavu" },
              { from: "Kisangani", to: "Kinshasa" },
            ].map((trajet) => (
              <div
                key={trajet.from + trajet.to}
                className="
                group rounded-3xl border bg-background p-5
                transition-all duration-300
                hover:-translate-y-1
                hover:shadow-xl
              "
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-2xl bg-primary/10 p-3">
                    <MapPin className="size-5 text-primary" />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    Disponible
                  </div>
                </div>

                <h3 className="text-lg font-bold">
                  {trajet.from}
                  <span className="mx-2 text-primary">→</span>
                  {trajet.to}
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  Bus VIP • Minibus • Voyage express
                </p>

                <Button
                  variant="ghost"
                  className="mt-4 rounded-2xl px-0 text-primary"
                >
                  Réserver maintenant →
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* MAP */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-background/70 shadow-xl backdrop-blur">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b p-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                  Agences
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  Nos agences en RDC
                </h2>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 text-primary" />

                <p className="text-sm">
                  Kinshasa • Lubumbashi • Goma • Bukavu • Kisangani
                </p>
              </div>
            </div>

            {/* Map */}
            <iframe
              className="h-[450px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=Kinshasa,+DRC&output=embed"
            />
          </div>
        </section>

        {/* FOOTER */}
        {/* FOOTER */}
        {/* FOOTER */}
        <footer className="px-4 pb-8 pt-6">
          <div
            className="
      mx-auto max-w-6xl
      rounded-3xl border
      bg-background/70
      backdrop-blur-xl
      shadow-lg
      overflow-hidden
    "
          >
            {/* Top */}
            <div className="grid gap-10 p-8 md:grid-cols-4">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary p-2 shadow">
                    <Plane className="size-5 text-primary-foreground" />
                  </div>

                  <div>
                    <h3 className="font-bold text-lg">Coccinelle</h3>

                    <p className="text-xs text-muted-foreground">
                      Smart Travel RDC
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Une plateforme moderne pour réserver vos voyages,
                  transporter vos colis et connecter les grandes villes
                  de la RDC facilement.
                </p>
              </div>

              {/* Services */}
              <div>
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">
                  Services
                </h4>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <Link
                    href="/vols"
                    className="block transition hover:text-primary"
                  >
                    Billets d’avion
                  </Link>

                  <Link
                    href="/bus"
                    className="block transition hover:text-primary"
                  >
                    Transport bus
                  </Link>

                  <Link
                    href="/colis"
                    className="block transition hover:text-primary"
                  >
                    Expédition colis
                  </Link>

                  <Link
                    href="/trajets"
                    className="block transition hover:text-primary"
                  >
                    Trajets populaires
                  </Link>
                </div>
              </div>

              {/* Company */}
              <div>
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">
                  Entreprise
                </h4>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <Link
                    href="../components/about"
                    className="block transition hover:text-primary"
                  >
                    À propos
                  </Link>

                  <Link
                    href="../components/contact"
                    className="block transition hover:text-primary"
                  >
                    Contact
                  </Link>

                  <Link
                    href="../components/support"
                    className="block transition hover:text-primary"
                  >
                    Support client
                  </Link>

                  <Link
                    href="../components/privacy"
                    className="block transition hover:text-primary"
                  >
                    Politique de confidentialité
                  </Link>
                </div>
              </div>

              {/* Partners */}
              <div>
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider">
                  Partenaires
                </h4>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl border p-3">
                    <div className="rounded-xl bg-primary/10 p-2">
                      <Plane className="size-4 text-primary" />
                    </div>

                    <div>
                      <p className="text-sm font-medium">Congo Airways</p>
                      <p className="text-xs text-muted-foreground">
                        Transport aérien
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border p-3">
                    <div className="rounded-xl bg-primary/10 p-2">
                      <Bus className="size-4 text-primary" />
                    </div>

                    <div>
                      <p className="text-sm font-medium">Trans Express</p>
                      <p className="text-xs text-muted-foreground">
                        Réseau bus national
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border p-3">
                    <div className="rounded-xl bg-primary/10 p-2">
                      <MapPin className="size-4 text-primary" />
                    </div>

                    <div>
                      <p className="text-sm font-medium">DRC Logistics</p>
                      <p className="text-xs text-muted-foreground">
                        Livraison & colis
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom */}
            <div
              className="
        flex flex-col gap-3
        border-t px-8 py-5
        text-sm text-muted-foreground
        md:flex-row md:items-center md:justify-between
      "
            >
              <p>
                © 2026 Coccinelle — Tous droits réservés.
              </p>

              <div className="flex items-center gap-6">
                <Link href="./components/terms" className="hover:text-primary transition">
                  Conditions
                </Link>

                <Link href="../components/privacy" className="hover:text-primary transition">
                  Confidentialité
                </Link>

                <Link href="../components/cookies" className="hover:text-primary transition">
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}