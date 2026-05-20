"use client"

import * as React from "react"
import { use } from "react"
import { notFound } from "next/navigation"
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  Edit, 
  Trash2,
  BookOpen,
  ClipboardList,
  User,
  FileText
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "@/components/layout/page-header"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { getChildById, getClassById, getAttendanceByChild } from "@/lib/mock-data"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ChildProfilePage({ params }: PageProps) {
  const { id } = use(params)
  const child = getChildById(id)

  if (!child) {
    notFound()
  }

  const childClass = getClassById(child.classId)
  const attendance = getAttendanceByChild(child.id)
  
  const presentCount = attendance.filter(a => a.status === "present").length
  const attendanceRate = attendance.length > 0 
    ? Math.round((presentCount / attendance.length) * 100) 
    : 0

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Fiche Enfant"
        showBack
        actions={[
          { label: "Modifier", onClick: () => {}, icon: <Edit className="size-4" /> },
          { label: "Supprimer", onClick: () => {}, icon: <Trash2 className="size-4" />, variant: "destructive" }
        ]}
      />

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="size-20 mb-3">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {child.firstName[0]}{child.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold">{child.firstName} {child.lastName}</h1>
          <p className="text-muted-foreground">{child.age} ans</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">
              <BookOpen className="size-3 mr-1" />
              {childClass?.name || "Non assigne"}
            </Badge>
            {child.allergies && (
              <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/20">
                <AlertTriangle className="size-3 mr-1" />
                Allergies
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-primary">{attendanceRate}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Presence</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{attendance.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{child.age}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ans</p>
            </CardContent>
          </Card>
        </div>

        {/* Allergies Alert */}
        {child.allergies && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Allergies</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{child.allergies}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Contact Parent
          </h2>
          <ListGroup>
            <ListItem
              title={child.parentName}
              description="Parent / Tuteur"
              leading={<User className="size-5 text-muted-foreground" />}
              showChevron={false}
            />
            <ListItem
              title={child.parentPhone}
              description="Telephone"
              leading={<Phone className="size-5 text-muted-foreground" />}
              onClick={() => window.location.href = `tel:${child.parentPhone}`}
            />
            <ListItem
              title={child.parentEmail}
              description="Email"
              leading={<Mail className="size-5 text-muted-foreground" />}
              onClick={() => window.location.href = `mailto:${child.parentEmail}`}
            />
            <ListItem
              title={child.address}
              description="Adresse"
              leading={<MapPin className="size-5 text-muted-foreground" />}
              showChevron={false}
            />
          </ListGroup>
        </section>

        {/* Info */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Informations
          </h2>
          <ListGroup>
            <ListItem
              title={new Date(child.birthDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
              description="Date de naissance"
              leading={<Calendar className="size-5 text-muted-foreground" />}
              showChevron={false}
            />
            <ListItem
              title={new Date(child.registrationDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
              description="Date d'inscription"
              leading={<ClipboardList className="size-5 text-muted-foreground" />}
              showChevron={false}
            />
            <ListItem
              title={childClass?.name || "Non assigne"}
              subtitle={childClass?.ageRange}
              description="Classe"
              leading={<BookOpen className="size-5 text-muted-foreground" />}
              href={childClass ? `/ecodim/classes/${childClass.id}` : undefined}
            />
          </ListGroup>
        </section>

        {/* Notes */}
        {child.notes && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Notes
            </h2>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm">{child.notes}</p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Attendance History */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Historique Presence
          </h2>
          <ListGroup>
            {attendance.slice(0, 5).map((record) => (
              <ListItem
                key={record.id}
                title={new Date(record.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                })}
                description={record.notes}
                leading={
                  <div className={`size-3 rounded-full ${
                    record.status === "present" ? "bg-success" :
                    record.status === "late" ? "bg-warning" :
                    record.status === "excused" ? "bg-muted-foreground" :
                    "bg-destructive"
                  }`} />
                }
                trailing={
                  <Badge 
                    variant="outline"
                    className={
                      record.status === "present" ? "bg-success/10 text-success border-success/20" :
                      record.status === "late" ? "bg-warning/10 text-warning-foreground border-warning/20" :
                      record.status === "excused" ? "bg-muted text-muted-foreground" :
                      "bg-destructive/10 text-destructive border-destructive/20"
                    }
                  >
                    {record.status === "present" ? "Present" :
                     record.status === "late" ? "Retard" :
                     record.status === "excused" ? "Excuse" :
                     "Absent"}
                  </Badge>
                }
                showChevron={false}
              />
            ))}
          </ListGroup>
        </section>
      </div>
    </div>
  )
}
