"use client"

import * as React from "react"
import Link from "next/link"
import { Users, BookOpen, MapPin, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "@/components/layout/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { classes, getChildrenByClass } from "@/lib/mock-data"

export default function ClassesPage() {
  const [search, setSearch] = React.useState("")

  const filteredClasses = classes.filter((cls) =>
    cls.name.toLowerCase().includes(search.toLowerCase()) ||
    cls.ageRange.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Classes" 
        subtitle={`${classes.length} classes actives`}
        showBack
        actions={[
          { label: "Nouvelle", onClick: () => {}, icon: <Plus className="size-4" /> }
        ]}
      />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <SearchInput 
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une classe..."
        />

        <div className="space-y-3">
          {filteredClasses.map((cls) => {
            const classChildren = getChildrenByClass(cls.id)
            const occupancyRate = Math.round((cls.childrenCount / cls.capacity) * 100)
            
            return (
              <Link key={cls.id} href={`/agences/colis/${cls.id}`}>
                <Card className="active:bg-muted/50 transition-colors touch-manipulation">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="size-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{cls.name}</CardTitle>
                            <CardDescription>{cls.ageRange}</CardDescription>
                          </div>
                          <Badge 
                            variant={occupancyRate >= 90 ? "destructive" : "secondary"}
                            className="shrink-0"
                          >
                            {occupancyRate}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {cls.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="size-4" />
                        <span>{cls.childrenCount}/{cls.capacity}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-4" />
                        <span>{cls.room}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {cls.teacher.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{cls.teacher}</span>
                      </div>
                      {classChildren.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {classChildren.slice(0, 4).map((child) => (
                            <Avatar key={child.id} className="size-6 border-2 border-background">
                              <AvatarFallback className="bg-accent/20 text-accent text-[10px]">
                                {child.firstName[0]}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {classChildren.length > 4 && (
                            <div className="size-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground">
                                +{classChildren.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
