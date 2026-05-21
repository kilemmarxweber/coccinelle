import Navbar from "@/app/components/navbar";

export default function SupportPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-16">
                <h1 className="text-4xl font-bold mb-6">Support client</h1>

                <div className="space-y-6 text-sm text-muted-foreground">
                    <p>
                        Besoin d’aide ? Notre équipe est disponible pour vous assister.
                    </p>

                    <div className="space-y-4">
                        <div className="rounded-2xl border p-5 bg-background">
                            <h2 className="font-semibold text-foreground">
                                🚍 Problème de réservation
                            </h2>
                            <p>Contactez-nous avec votre numéro de ticket.</p>
                        </div>

                        <div className="rounded-2xl border p-5 bg-background">
                            <h2 className="font-semibold text-foreground">
                                ✈️ Vols et billets
                            </h2>
                            <p>Assistance pour modifications ou annulations.</p>
                        </div>

                        <div className="rounded-2xl border p-5 bg-background">
                            <h2 className="font-semibold text-foreground">
                                📦 Colis
                            </h2>
                            <p>Suivi et support des expéditions.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}