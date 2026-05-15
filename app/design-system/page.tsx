"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Users, 
  BookOpen, 
  ClipboardList, 
  UserPlus,
  Search,
  Bell,
  ChevronRight,
  Calendar,
  Trash2,
  Edit,
  Plus,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import { SearchInput } from "@/components/ui/search-input"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
} from "@/components/ui/responsive-dialog"

export default function DesignSystemPage() {
  const router = useRouter()
  const [searchValue, setSearchValue] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <div className="min-h-screen pb-8">
      <PageHeader 
        title="Design System" 
        subtitle="Mobile-First UI"
        actions={[
          { label: "Demo Ecodim", onClick: () => router.push("/ecodim"), icon: <ArrowRight className="size-4" /> }
        ]}
      />

      <div className="px-4 py-6 space-y-10 max-w-2xl mx-auto">
        
        {/* Mobile First Notice */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <Info className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Design Mobile-First</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tous les composants sont optimises pour le tactile avec des zones de 44px minimum, 
                  des espacements genereux et des interactions adaptees.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Palette de Couleurs</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-primary" />
              <span className="text-xs text-muted-foreground block text-center">Primary</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-accent" />
              <span className="text-xs text-muted-foreground block text-center">Accent</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-success" />
              <span className="text-xs text-muted-foreground block text-center">Success</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-warning" />
              <span className="text-xs text-muted-foreground block text-center">Warning</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-destructive" />
              <span className="text-xs text-muted-foreground block text-center">Danger</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-secondary" />
              <span className="text-xs text-muted-foreground block text-center">Secondary</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-muted" />
              <span className="text-xs text-muted-foreground block text-center">Muted</span>
            </div>
            <div className="space-y-2">
              <div className="aspect-square rounded-xl bg-card border" />
              <span className="text-xs text-muted-foreground block text-center">Card</span>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Typographie</h2>
          <Card>
            <CardContent className="pt-5 space-y-5">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Titre Page</span>
                <h1 className="text-xl font-bold tracking-tight mt-1">Ecole du Dimanche</h1>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Titre Section</span>
                <h2 className="text-lg font-semibold mt-1">Liste des Classes</h2>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sous-titre</span>
                <h3 className="text-base font-medium mt-1">Classe des Petits</h3>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Corps</span>
                <p className="text-sm leading-relaxed text-muted-foreground mt-1">
                  Application de gestion pour l&apos;ecole du dimanche. Gerez les enfants, classes et presences.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Buttons - Touch Optimized */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Boutons (44px min)</h2>
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button>
                  <Plus className="size-4" />
                  Ajouter
                </Button>
                <Button variant="secondary">
                  <Edit className="size-4" />
                  Modifier
                </Button>
                <Button variant="outline">
                  Annuler
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button variant="destructive">
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
                <Button variant="ghost">Ghost</Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-3">Tailles</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Petit (36px)</Button>
                  <Button size="default">Normal (44px)</Button>
                  <Button size="lg">Grand (48px)</Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-3">Icones seules</p>
                <div className="flex items-center gap-3">
                  <Button size="icon-sm" variant="outline">
                    <Bell className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline">
                    <Bell className="size-5" />
                  </Button>
                  <Button size="icon-lg" variant="outline">
                    <Bell className="size-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Form Elements */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Formulaires Tactiles</h2>
          <Card>
            <CardContent className="pt-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recherche</Label>
                <SearchInput 
                  value={searchValue} 
                  onChange={setSearchValue}
                  placeholder="Rechercher un enfant..."
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Champ texte</Label>
                <Input placeholder="Nom de l'enfant" className="h-11" />
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Checkbox (zone tactile large)</Label>
                <div className="flex items-center gap-4 py-2 -mx-2 px-2 active:bg-muted/50 rounded-lg touch-manipulation">
                  <Checkbox id="terms" className="size-5" />
                  <Label htmlFor="terms" className="text-sm flex-1 cursor-pointer">
                    J&apos;accepte les conditions d&apos;utilisation
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t">
                <div>
                  <Label className="text-sm">Notifications push</Label>
                  <p className="text-xs text-muted-foreground">Recevoir les alertes</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Badges */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Badges</h2>
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap gap-2">
                <Badge>Nouveau</Badge>
                <Badge variant="secondary">En cours</Badge>
                <Badge variant="outline">Inactif</Badge>
                <Badge variant="destructive">Absent</Badge>
                <Badge className="bg-success text-success-foreground">Present</Badge>
                <Badge className="bg-warning text-warning-foreground">Retard</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Stat Cards */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Cartes Statistiques</h2>
          <StatGrid>
            <StatCard 
              title="Enfants" 
              value={156} 
              icon={Users}
              subtitle="Total"
            />
            <StatCard 
              title="Classes" 
              value={8} 
              icon={BookOpen}
              variant="primary"
            />
            <StatCard 
              title="Presence" 
              value="89%"
              icon={ClipboardList}
              trend={{ value: 5, isPositive: true }}
              variant="success"
            />
            <StatCard 
              title="Nouveaux" 
              value={12}
              icon={UserPlus}
              subtitle="Ce mois"
              variant="warning"
            />
          </StatGrid>
        </section>

        {/* List Items - Touch Optimized */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Listes Tactiles (56px min)</h2>
          <ListGroup title="Enfants recents">
            <ListItem
              title="Marie Dupont"
              description="Classe des Moyens - 8 ans"
              leading={
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">MD</AvatarFallback>
                </Avatar>
              }
              trailing={<Badge className="bg-success text-success-foreground">Present</Badge>}
              href="#"
            />
            <ListItem
              title="Paul Martin"
              description="Classe des Grands - 11 ans"
              leading={
                <Avatar className="size-10">
                  <AvatarFallback className="bg-accent/20 text-accent text-sm">PM</AvatarFallback>
                </Avatar>
              }
              trailing={<Badge variant="outline">Absent</Badge>}
              href="#"
            />
            <ListItem
              title="Sophie Bernard"
              description="Classe des Petits - 5 ans"
              leading={
                <Avatar className="size-10">
                  <AvatarFallback className="bg-warning/20 text-warning-foreground text-sm">SB</AvatarFallback>
                </Avatar>
              }
              href="#"
            />
          </ListGroup>
        </section>

        {/* Cards */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Cartes</h2>
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <BookOpen className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Classe des Moyens</CardTitle>
                    <CardDescription>7-9 ans</CardDescription>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">24 enfants inscrits</span>
                  <Badge variant="secondary">Actif</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-accent/20 p-2.5">
                    <Calendar className="size-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Prochain cours</CardTitle>
                    <CardDescription>Dimanche 15 Dec</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">L&apos;histoire de Noel</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Tabs - Mobile Optimized */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Onglets</h2>
          <Card>
            <CardContent className="pt-5">
              <Tabs defaultValue="all">
                <TabsList className="w-full h-11 p-1">
                  <TabsTrigger value="all" className="flex-1 h-9 text-sm">Tous</TabsTrigger>
                  <TabsTrigger value="present" className="flex-1 h-9 text-sm">Presents</TabsTrigger>
                  <TabsTrigger value="absent" className="flex-1 h-9 text-sm">Absents</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  <p className="text-sm text-muted-foreground text-center py-4">156 enfants au total</p>
                </TabsContent>
                <TabsContent value="present" className="mt-4">
                  <p className="text-sm text-muted-foreground text-center py-4">139 enfants presents</p>
                </TabsContent>
                <TabsContent value="absent" className="mt-4">
                  <p className="text-sm text-muted-foreground text-center py-4">17 enfants absents</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        {/* Responsive Dialog */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Dialog Adaptatif</h2>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground mb-4">
                Drawer sur mobile, Dialog sur desktop. Testez en redimensionnant.
              </p>
              <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <ResponsiveDialogTrigger>
                  <Button className="w-full">Ouvrir le dialog</Button>
                </ResponsiveDialogTrigger>
                <ResponsiveDialogContent>
                  <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Confirmer l&apos;action</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                      Ce dialog s&apos;adapte automatiquement a la taille de l&apos;ecran.
                    </ResponsiveDialogDescription>
                  </ResponsiveDialogHeader>
                  <div className="px-4 py-6">
                    <p className="text-sm text-center text-muted-foreground">
                      Sur mobile, il s&apos;affiche en bas de l&apos;ecran comme un drawer.
                      Sur desktop, il s&apos;affiche au centre comme un dialog classique.
                    </p>
                  </div>
                  <ResponsiveDialogFooter>
                    <ResponsiveDialogClose>
                      <Button variant="outline" className="w-full md:w-auto">Annuler</Button>
                    </ResponsiveDialogClose>
                    <Button className="w-full md:w-auto" onClick={() => setDialogOpen(false)}>
                      Confirmer
                    </Button>
                  </ResponsiveDialogFooter>
                </ResponsiveDialogContent>
              </ResponsiveDialog>
            </CardContent>
          </Card>
        </section>

        {/* Alerts */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Alertes</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
              <Check className="size-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Succes</p>
                <p className="text-sm text-muted-foreground mt-0.5">Enfant inscrit avec succes.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
              <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Attention</p>
                <p className="text-sm text-muted-foreground mt-0.5">Informations manquantes.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <X className="size-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Erreur</p>
                <p className="text-sm text-muted-foreground mt-0.5">Echec de l&apos;enregistrement.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Empty State */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Etat Vide</h2>
          <Card>
            <CardContent className="pt-0">
              <EmptyState
                icon={Search}
                title="Aucun resultat"
                description="Aucun enfant ne correspond a votre recherche."
                action={
                  <Button variant="outline">
                    Effacer les filtres
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </section>

        {/* Avatars */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Avatars</h2>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">SM</AvatarFallback>
                </Avatar>
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">MD</AvatarFallback>
                </Avatar>
                <Avatar className="size-12">
                  <AvatarFallback className="bg-accent/20 text-accent">LG</AvatarFallback>
                </Avatar>
                <Avatar className="size-14">
                  <AvatarFallback className="bg-success/20 text-success text-lg">XL</AvatarFallback>
                </Avatar>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Demo Link */}
        <section>
          <Card className="bg-primary text-primary-foreground overflow-hidden">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2">Voir la demo</h3>
              <p className="text-sm opacity-90 mb-5">
                Explorez l&apos;application Ecodim complete avec ce design system.
              </p>
              <Button
                variant="secondary"
                render={<Link href="/ecodim" />}
                className="w-full gap-2"
              >
                Ouvrir Ecodim
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
