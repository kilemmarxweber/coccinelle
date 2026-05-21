import Navbar from "@/app/components/navbar";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-16">
                <h1 className="text-4xl font-bold mb-6">Conditions d’utilisation</h1>

                <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                    <p>
                        En utilisant Coccinelle, vous acceptez les présentes conditions
                        d’utilisation.
                    </p>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            1. Utilisation du service
                        </h2>
                        <p>
                            Vous vous engagez à utiliser la plateforme uniquement à des fins
                            légales liées à la réservation de voyages et d’expédition de colis.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            2. Comptes utilisateurs
                        </h2>
                        <p>
                            Vous êtes responsable de la sécurité de votre compte et des
                            activités effectuées depuis celui-ci.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            3. Réservations
                        </h2>
                        <p>
                            Les réservations sont soumises à disponibilité et confirmation des
                            transporteurs partenaires.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            4. Modifications
                        </h2>
                        <p>
                            Nous pouvons modifier ces conditions à tout moment pour améliorer le
                            service.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}