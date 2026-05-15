"use client"

import * as React from "react"
import { Calendar, BookOpen, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { EmptyState } from "@/components/ui/empty-state"
import { courses, getClassById } from "@/lib/mock-data"

export default function CoursesPage() {
  const [search, setSearch] = React.useState("")

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(search.toLowerCase()) ||
    course.theme.toLowerCase().includes(search.toLowerCase())
  )

  // Group courses by month
  const coursesByMonth = React.useMemo(() => {
    const grouped: Record<string, typeof courses> = {}
    filteredCourses.forEach((course) => {
      const monthKey = new Date(course.date).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric"
      })
      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(course)
    })
    return grouped
  }, [filteredCourses])

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Cours"
        subtitle={`${courses.length} cours programmes`}
        showBack
        actions={[
          { label: "Ajouter", onClick: () => {}, icon: <Plus className="size-4" /> }
        ]}
      />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <SearchInput 
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un cours..."
        />

        {filteredCourses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Aucun cours trouve"
            description="Essayez de modifier votre recherche."
            action={
              <Button variant="outline" onClick={() => setSearch("")}>
                Effacer la recherche
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(coursesByMonth).map(([month, monthCourses]) => (
              <section key={month}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 capitalize">
                  {month}
                </h2>
                <div className="space-y-3">
                  {monthCourses.map((course) => (
                    <Card key={course.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <div className="size-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                            <Calendar className="size-6 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base line-clamp-1">{course.title}</CardTitle>
                            <CardDescription className="line-clamp-1">{course.theme}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {course.description}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            <Calendar className="size-3 mr-1" />
                            {new Date(course.date).toLocaleDateString("fr-FR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short"
                            })}
                          </Badge>
                          {course.classIds.map((classId) => {
                            const cls = getClassById(classId)
                            return (
                              <Badge key={classId} variant="secondary" className="text-xs">
                                {cls?.ageRange}
                              </Badge>
                            )
                          })}
                        </div>

                        <div className="pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Verset cle</p>
                          <p className="text-sm font-medium">{course.bibleVerse}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Objectifs</p>
                          <ul className="space-y-1">
                            {course.objectives.slice(0, 2).map((obj, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                {obj}
                              </li>
                            ))}
                            {course.objectives.length > 2 && (
                              <li className="text-sm text-muted-foreground">
                                +{course.objectives.length - 2} autres objectifs
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="pt-2">
                          <p className="text-xs text-muted-foreground mb-2">Materiel necessaire</p>
                          <div className="flex flex-wrap gap-1.5">
                            {course.materials.map((material, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {material}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
