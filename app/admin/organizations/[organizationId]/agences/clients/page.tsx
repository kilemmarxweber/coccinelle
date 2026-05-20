"use client"

import * as React from "react"
import { Plus, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "@/components/layout/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { EmptyState } from "@/components/ui/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { children, classes, getClassById } from "@/lib/mock-data"

export default function ChildrenPage() {
  const [search, setSearch] = React.useState("")
  const [selectedClass, setSelectedClass] = React.useState("all")

  const filteredChildren = children.filter((child) => {
    const matchesSearch = 
      child.firstName.toLowerCase().includes(search.toLowerCase()) ||
      child.lastName.toLowerCase().includes(search.toLowerCase())
    
    const matchesClass = selectedClass === "all" || child.classId === selectedClass
    
    return matchesSearch && matchesClass
  })

  // Group by class
  const childrenByClass = React.useMemo(() => {
    const grouped: Record<string, typeof children> = {}
    filteredChildren.forEach((child) => {
      if (!grouped[child.classId]) {
        grouped[child.classId] = []
      }
      grouped[child.classId].push(child)
    })
    return grouped
  }, [filteredChildren])

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Enfants" 
        subtitle={`${children.length} inscrits`}
        showBack
        actions={[
          { label: "Inscrire", onClick: () => {}, icon: <Plus className="size-4" /> }
        ]}
      />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <SearchInput 
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un enfant..."
        />

        <Tabs value={selectedClass} onValueChange={setSelectedClass}>
          <TabsList className="w-full h-auto p-1 flex-wrap">
            <TabsTrigger value="all" className="flex-1 h-9 text-xs">
              Tous ({children.length})
            </TabsTrigger>
            {classes.map((cls) => (
              <TabsTrigger key={cls.id} value={cls.id} className="flex-1 h-9 text-xs">
                {cls.ageRange.split(" ")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filteredChildren.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="Aucun enfant trouve"
            description="Essayez de modifier vos filtres de recherche."
            action={
              <Button variant="outline" onClick={() => { setSearch(""); setSelectedClass("all"); }}>
                Effacer les filtres
              </Button>
            }
          />
        ) : selectedClass === "all" ? (
          // Grouped view
          <div className="space-y-4">
            {Object.entries(childrenByClass).map(([classId, classChildren]) => {
              const cls = getClassById(classId)
              return (
                <ListGroup key={classId} title={cls?.name || classId}>
                  {classChildren.map((child) => (
                    <ListItem
                      key={child.id}
                      title={`${child.firstName} ${child.lastName}`}
                      description={`${child.age} ans`}
                      leading={
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {child.firstName[0]}{child.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                      }
                      trailing={
                        child.allergies ? (
                          <Badge variant="outline" className="text-xs bg-warning/10 text-warning-foreground border-warning/20">
                            Allergie
                          </Badge>
                        ) : null
                      }
                      href={`/agences/clients/${child.id}`}
                    />
                  ))}
                </ListGroup>
              )
            })}
          </div>
        ) : (
          // Flat list for single class
          <ListGroup>
            {filteredChildren.map((child) => (
              <ListItem
                key={child.id}
                title={`${child.firstName} ${child.lastName}`}
                description={`${child.age} ans - ${child.parentName}`}
                leading={
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {child.firstName[0]}{child.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                }
                trailing={
                  child.allergies ? (
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning-foreground border-warning/20">
                      Allergie
                    </Badge>
                  ) : null
                }
                href={`/agences/clients/${child.id}`}
              />
            ))}
          </ListGroup>
        )}
      </div>
    </div>
  )
}
