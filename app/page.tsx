import Link from "next/link";
import { ArrowRight, Palette, Users, Plane, Bus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-2 shadow">
              <Plane className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Coccinelle</h1>
              <p className="text-xs text-muted-foreground">Voyage intelligent RDC</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" render={<Link href="/auth/sign-in" />}>
              Connexion
            </Button>
            <Button size="sm" render={<Link href="/auth/sign-up" />}>
              Créer un compte
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center py-12 px-4 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-3">Voyagez facilement en avion ✈️ et en bus 🚌</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Gérez vos passagers, suivez vos trajets et expédiez vos colis en toute sécurité à travers
          la RDC.
        </p>
      </section>

      {/* Ads Module */}
      <section className="max-w-4xl mx-auto px-4 mb-10 grid gap-4 sm:grid-cols-2">
        <Card className="overflow-hidden group hover:shadow-lg transition">
          <div className="h-36 bg-[url('/vols.jpg')] bg-cover bg-center" />
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Plane className="text-primary" />
              <p className="font-semibold">Offres Vols</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Réservez vos billets d'avion aux meilleurs prix.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden group hover:shadow-lg transition">
          <div className="h-36 bg-[url('/bus.jpg')] bg-cover bg-center" />
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bus className="text-primary" />
              <p className="font-semibold">Offres Bus</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Trouvez des trajets rapides et économiques.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Trajets locaux RDC (center improved) */}
      <section className="max-w-4xl mx-auto px-4 mb-12">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5 text-center">
          Trajets populaires en RDC
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="p-4 rounded-2xl bg-card border hover:shadow-md transition"
            >
              <p className="text-sm font-semibold">
                {trajet.from} → {trajet.to}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Bus, VIP & minibus disponibles</p>
            </div>
          ))}
        </div>
      </section>

      {/* Map Agences full width improved */}
      <section className="w-full mb-12">
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Agences de voyage en RDC
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="text-primary" />
            <p className="text-sm text-muted-foreground">
              Kinshasa • Lubumbashi • Goma • Bukavu • Kisangani
            </p>
          </div>
        </div>

        <div className="w-full h-[380px]">
          <iframe
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=Kinshasa,+DRC&output=embed"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Coccinelle © 2026 - Plateforme voyage RDC
      </footer>
    </div>
  );
}
