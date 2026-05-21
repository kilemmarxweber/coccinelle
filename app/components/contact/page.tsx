import Navbar from "@/app/components/navbar";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-16">
                <h1 className="text-4xl font-bold mb-6">Contact</h1>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Info */}
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <p>📍 Kinshasa, RDC</p>
                        <p>📧 support@coccinelle.com</p>
                        <p>📞 +243 XXX XXX XXX</p>

                        <div className="rounded-2xl border p-4 bg-background">
                            <p className="font-semibold text-foreground">Heures de support</p>
                            <p>Lundi - Samedi : 8h - 18h</p>
                        </div>
                    </div>

                    {/* Form */}
                    <form className="space-y-4 rounded-2xl border p-6 bg-background">
                        <input
                            type="text"
                            placeholder="Nom"
                            className="w-full rounded-xl border p-3 text-sm"
                        />

                        <input
                            type="email"
                            placeholder="Email"
                            className="w-full rounded-xl border p-3 text-sm"
                        />

                        <textarea
                            placeholder="Message"
                            rows={4}
                            className="w-full rounded-xl border p-3 text-sm"
                        />

                        <button className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground">
                            Envoyer
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}