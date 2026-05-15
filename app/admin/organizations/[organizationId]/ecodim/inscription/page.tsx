"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, User, Users, MapPin, AlertTriangle, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { classes } from "@/lib/mock-data"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"

interface FormData {
  firstName: string
  lastName: string
  birthDate: string
  classId: string
  parentName: string
  parentPhone: string
  parentEmail: string
  address: string
  allergies: string
  notes: string
}

export default function RegistrationPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const [formData, setFormData] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    birthDate: "",
    classId: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    address: "",
    allergies: "",
    notes: "",
  })

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    setIsSubmitting(false)
    setShowSuccess(true)
  }

  const handleSuccessClose = () => {
    setShowSuccess(false)
    router.push("/ecodim/enfants")
  }

  const isFormValid = formData.firstName && formData.lastName && formData.birthDate && 
                       formData.classId && formData.parentName && formData.parentPhone

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Inscription"
        subtitle="Nouvel enfant"
        showBack
      />

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-6 max-w-2xl mx-auto">
        {/* Child Information */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Informations de l&apos;enfant</CardTitle>
                <CardDescription>Details personnels</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prenom *</Label>
                <Input
                  id="firstName"
                  placeholder="Prenom"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  placeholder="Nom"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className="h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Date de naissance *</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => handleChange("birthDate", e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="classId">Classe *</Label>
              <Select
                id="classId"
                className="h-11"
                value={formData.classId}
                onChange={(e) => handleChange("classId", e.target.value)}
                required
              >
                <option value="">Selectionner une classe</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.ageRange})
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Parent Information */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Users className="size-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">Contact parent</CardTitle>
                <CardDescription>Informations du responsable</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentName">Nom du parent / tuteur *</Label>
              <Input
                id="parentName"
                placeholder="Nom complet"
                value={formData.parentName}
                onChange={(e) => handleChange("parentName", e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentPhone">Telephone *</Label>
              <Input
                id="parentPhone"
                type="tel"
                placeholder="+33 6 00 00 00 00"
                value={formData.parentPhone}
                onChange={(e) => handleChange("parentPhone", e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentEmail">Email</Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="email@exemple.com"
                value={formData.parentEmail}
                onChange={(e) => handleChange("parentEmail", e.target.value)}
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                <MapPin className="size-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Adresse</CardTitle>
                <CardDescription>Facultatif</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse complete</Label>
              <Textarea
                id="address"
                placeholder="Numero, rue, code postal, ville"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Medical Info */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="size-5 text-warning-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Informations medicales</CardTitle>
                <CardDescription>Allergies et precautions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies ou conditions medicales</Label>
              <Textarea
                id="allergies"
                placeholder="Listez les allergies, intolérances ou conditions medicales importantes"
                value={formData.allergies}
                onChange={(e) => handleChange("allergies", e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Notes supplementaires</CardTitle>
                <CardDescription>Informations utiles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Toute information utile pour les moniteurs"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
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
                Inscrire l&apos;enfant
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Success Dialog */}
      <ResponsiveDialog open={showSuccess} onOpenChange={handleSuccessClose}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="size-16 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="size-8 text-success" />
              </div>
            </div>
            <ResponsiveDialogTitle className="text-center">Inscription reussie!</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-center">
              {formData.firstName} {formData.lastName} a ete inscrit(e) avec succes a l&apos;ecole du dimanche.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button className="w-full" onClick={handleSuccessClose}>
              Voir la liste des enfants
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
