import Navbar from "@/app/components/navbar";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-16">
                <h1 className="text-4xl font-bold mb-6">
                    Politique de confidentialité
                </h1>

                <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                    <p>
                        Votre confidentialité est importante pour nous. Cette politique
                        explique comment nous utilisons vos données.
                    </p>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            1. Données collectées
                        </h2>
                        <p>
                            Nous collectons des informations comme votre nom, email et historique
                            de réservation.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            2. Utilisation des données
                        </h2>
                        <p>
                            Les données sont utilisées pour améliorer les services et gérer vos
                            réservations.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            3. Partage des données
                        </h2>
                        <p>
                            Nous ne vendons pas vos données. Elles peuvent être partagées avec
                            nos partenaires de transport uniquement pour exécuter les services.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            4. Sécurité
                        </h2>
                        <p>
                            Nous utilisons des mesures de sécurité modernes pour protéger vos
                            informations.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}