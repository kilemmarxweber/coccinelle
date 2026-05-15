import Link from "next/link"
import { ArrowRight, BookOpen, Palette, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-primary p-2">
              <BookOpen className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">EgliseManager</h1>
              <p className="text-xs text-muted-foreground">Gestion Ecodim</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href="/auth/sign-in" />}>
              Connexion
            </Button>
            <Button size="sm" render={<Link href="/auth/sign-up" />}>
              Créer un compte
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <div className="space-y-6">
          {/* Hero */}
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold tracking-tight mb-3">
              Application de gestion pour l&apos;Ecole du Dimanche
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Gerez facilement les enfants, les classes, les presences et les cours 
              de votre eglise evangelique.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <Card className="group hover:border-primary/50 transition-colors">
              <Link href="/design-system" className="block">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                      <Palette className="size-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Design System</CardTitle>
                      <CardDescription>Composants UI mobile-first</CardDescription>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    Decouvrez tous les composants optimises pour telephone et tablette.
                  </p>
                </CardContent>
              </Link>
            </Card>

            <Card className="group hover:border-primary/50 transition-colors">
              <Link href="/ecodim" className="block">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-accent/20 p-2.5 group-hover:bg-accent/30 transition-colors">
                      <Users className="size-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Demo Ecodim</CardTitle>
                      <CardDescription>Application complete</CardDescription>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    Explorez les pages de gestion: enfants, classes, presences, inscription.
                  </p>
                </CardContent>
              </Link>
            </Card>
          </div>

          {/* Features */}
          <div className="pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Fonctionnalites
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-card border">
                <p className="font-medium text-sm">Gestion Enfants</p>
                <p className="text-xs text-muted-foreground mt-1">Fiches completes</p>
              </div>
              <div className="p-4 rounded-xl bg-card border">
                <p className="font-medium text-sm">Classes</p>
                <p className="text-xs text-muted-foreground mt-1">Par tranches d&apos;age</p>
              </div>
              <div className="p-4 rounded-xl bg-card border">
                <p className="font-medium text-sm">Presences</p>
                <p className="text-xs text-muted-foreground mt-1">Suivi hebdomadaire</p>
              </div>
              <div className="p-4 rounded-xl bg-card border">
                <p className="font-medium text-sm">Inscription</p>
                <p className="text-xs text-muted-foreground mt-1">Formulaire simple</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <p className="text-center text-sm text-muted-foreground">
          EgliseManager - Design System Mobile-First
        </p>
      </footer>
    </div>
  )
}
