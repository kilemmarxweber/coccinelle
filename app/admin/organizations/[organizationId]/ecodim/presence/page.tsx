"use client"

import * as React from "react"
import { Check, X, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "@/components/layout/page-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { children, classes, getClassById } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type AttendanceStatus = "present" | "absent" | "late" | "excused"

export default function AttendancePage() {
  const [selectedClass, setSelectedClass] = React.useState(classes[0].id)
  const [selectedDate] = React.useState(new Date().toISOString().split("T")[0])
  const [attendance, setAttendance] = React.useState<Record<string, AttendanceStatus>>({})

  const classChildren = children.filter((c) => c.classId === selectedClass)
  const currentClass = getClassById(selectedClass)

  const handleStatusChange = (childId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [childId]: prev[childId] === status ? undefined : status,
    } as Record<string, AttendanceStatus>))
  }

  const getStatusCount = (status: AttendanceStatus) => {
    return Object.values(attendance).filter((s) => s === status).length
  }

  const statusButtons: { status: AttendanceStatus; icon: React.ReactNode; label: string; color: string }[] = [
    { status: "present", icon: <Check className="size-4" />, label: "Present", color: "bg-success text-success-foreground" },
    { status: "late", icon: <Clock className="size-4" />, label: "Retard", color: "bg-warning text-warning-foreground" },
    { status: "absent", icon: <X className="size-4" />, label: "Absent", color: "bg-destructive text-destructive-foreground" },
    { status: "excused", icon: <AlertCircle className="size-4" />, label: "Excuse", color: "bg-muted text-muted-foreground" },
  ]

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Presence"
        subtitle={new Date(selectedDate).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long"
        })}
        showBack
        actions={[
          { label: "Enregistrer", onClick: () => {}, icon: <Check className="size-4" /> }
        ]}
      />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Class Tabs */}
        <Tabs value={selectedClass} onValueChange={setSelectedClass}>
          <TabsList className="w-full h-auto p-1">
            {classes.map((cls) => (
              <TabsTrigger key={cls.id} value={cls.id} className="flex-1 h-10 text-xs">
                {cls.ageRange.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-success/10 text-center">
            <p className="text-lg font-bold text-success">{getStatusCount("present")}</p>
            <p className="text-[10px] text-muted-foreground">Presents</p>
          </div>
          <div className="p-3 rounded-xl bg-warning/10 text-center">
            <p className="text-lg font-bold text-warning-foreground">{getStatusCount("late")}</p>
            <p className="text-[10px] text-muted-foreground">Retards</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/10 text-center">
            <p className="text-lg font-bold text-destructive">{getStatusCount("absent")}</p>
            <p className="text-[10px] text-muted-foreground">Absents</p>
          </div>
          <div className="p-3 rounded-xl bg-muted text-center">
            <p className="text-lg font-bold">{getStatusCount("excused")}</p>
            <p className="text-[10px] text-muted-foreground">Excuses</p>
          </div>
        </div>

        {/* Class Info */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{currentClass?.name}</p>
                <p className="text-sm text-muted-foreground">{currentClass?.teacher}</p>
              </div>
              <Badge variant="secondary">
                {classChildren.length} enfants
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Attendance List */}
        <div className="space-y-2">
          {classChildren.map((child) => {
            const currentStatus = attendance[child.id]
            
            return (
              <Card key={child.id} className="overflow-hidden">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {child.firstName[0]}{child.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{child.age} ans</p>
                    </div>
                    {child.allergies && (
                      <Badge variant="outline" className="text-xs bg-warning/10 border-warning/20">
                        Allergie
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {statusButtons.map(({ status, icon, label, color }) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(child.id, status)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 transition-all touch-manipulation min-h-[56px]",
                          currentStatus === status
                            ? `${color} border-transparent`
                            : "bg-background border-border hover:border-muted-foreground/30"
                        )}
                      >
                        {icon}
                        <span className="text-[10px] font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Save Button */}
        <div className="sticky bottom-20 md:bottom-4 pt-4">
          <Button className="w-full h-12" size="lg">
            <Check className="size-5 mr-2" />
            Enregistrer la presence
          </Button>
        </div>
      </div>
    </div>
  )
}
