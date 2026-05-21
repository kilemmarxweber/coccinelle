import Navbar from "@/app/components/navbar";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-16">
                <h1 className="text-4xl font-bold mb-6">À propos de Coccinelle</h1>

                <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                    <p>
                        Coccinelle est une plateforme moderne de voyage en République
                        Démocratique du Congo.
                    </p>

                    <p>
                        Notre mission est de simplifier la réservation de voyages en avion,
                        bus et l’envoi de colis à travers tout le pays.
                    </p>

                    <p>
                        Nous connectons les voyageurs aux meilleurs transporteurs locaux pour
                        offrir un service rapide, fiable et sécurisé.
                    </p>

                    <div className="rounded-2xl border p-6 bg-background">
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            Notre vision
                        </h2>
                        <p>
                            Rendre le transport en RDC aussi simple qu’une réservation en ligne.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}