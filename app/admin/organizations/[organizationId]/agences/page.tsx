"use client";

import Link from "next/link";
import { Users, BookOpen, ClipboardList, Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { classes, children, courses, attendanceRecords, getClassById } from "@/lib/mock-data";
import { useParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export default function AgencesDashboard() {
  const params = useParams();
  const id = params.organizationId as string;
  const base = `/admin/organizations/${id}/agences`;
  const totalChildren = children.length;
  const totalClasses = classes.length;
  const lastAttendance = attendanceRecords.filter((r) => r.date === "2024-05-05");
  const presentCount = lastAttendance.filter((r) => r.status === "present").length;
  const attendanceRate = Math.round((presentCount / lastAttendance.length) * 100);

  const organizationId = params.organizationId as string;

  const recentChildren = children.slice(0, 4);
  const upcomingCourses = courses.slice(0, 3);

  return (
    <div className="min-h-screen">
      <PageHeader title="Agence" subtitle="Reservation et vol" />

      <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto md:max-w-4xl">
        {/* Stats */}
        <StatGrid>
          <StatCard title="Clients" value={totalChildren} icon={Users} subtitle="Inscrits" />
          <StatCard title="Vols" value={totalClasses} icon={BookOpen} variant="primary" />
          <StatCard
            title="Reservation"
            value={`${attendanceRate}%`}
            icon={ClipboardList}
            trend={{ value: 5, isPositive: true }}
            variant="success"
          />
          <StatCard
            title="Colis"
            value={courses.length}
            icon={Calendar}
            subtitle="Ce mois"
            variant="warning"
          />
        </StatGrid>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            render={<Link href={`${base}/inscription`} />}
            className="h-auto flex-col gap-2 py-4"
          >
            <Users className="size-5" />
            <span className="text-sm">Inscrire un client</span>
          </Button>
          <Button
            variant="outline"
            render={<Link href="/agences/passages" />}
            className="h-auto flex-col gap-2 py-4"
          >
            <ClipboardList className="size-5" />
            <span className="text-sm">Reservation</span>
          </Button>
        </div>

        {/* Classes Overview */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Vols</h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/agences/colis" />}
              className="-mr-2 gap-1"
            >
              Voir tout
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <ListGroup>
            {classes.slice(0, 3).map((cls) => (
              <ListItem
                key={cls.id}
                title={cls.name}
                description={`${cls.ageRange} - ${cls.childrenCount} enfants`}
                leading={
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="size-5 text-primary" />
                  </div>
                }
                trailing={
                  <Badge variant="secondary">
                    {Math.round((cls.childrenCount / cls.capacity) * 100)}%
                  </Badge>
                }
                href="/agences/colis"
              />
            ))}
          </ListGroup>
        </section>

        {/* Recent Children */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Enfants recents</h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/agences/clients" />}
              className="-mr-2 gap-1"
            >
              Voir tout
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <ListGroup>
            {recentChildren.map((child) => {
              const childClass = getClassById(child.classId);
              return (
                <ListItem
                  key={child.id}
                  title={`${child.firstName} ${child.lastName}`}
                  description={`${childClass?.name || ""} - ${child.age} ans`}
                  leading={
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-accent/20 text-accent text-sm">
                        {child.firstName[0]}
                        {child.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  }
                  href={`/agences/clients/${child.id}`}
                />
              );
            })}
          </ListGroup>
        </section>

        {/* Upcoming Courses */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Prochains cours</h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/agences/trajets" />}
              className="-mr-2 gap-1"
            >
              Voir tout
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {upcomingCourses.map((course) => (
              <Card key={course.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                      <Calendar className="size-5 text-warning-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{course.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{course.theme}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {new Date(course.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Badge>
                        {course.classIds.slice(0, 2).map((classId) => {
                          const cls = getClassById(classId);
                          return (
                            <Badge key={classId} variant="secondary" className="text-xs">
                              {cls?.ageRange}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Last Attendance Summary */}
        <section>
          <h2 className="text-base font-semibold mb-3">Derniere presence</h2>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Dimanche 5 Mai 2024</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 rounded-xl bg-success/10">
                  <p className="text-lg font-bold text-success">
                    {lastAttendance.filter((r) => r.status === "present").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Presents
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10">
                  <p className="text-lg font-bold text-destructive">
                    {lastAttendance.filter((r) => r.status === "absent").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Absents
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-warning/10">
                  <p className="text-lg font-bold text-warning-foreground">
                    {lastAttendance.filter((r) => r.status === "late").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Retard
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted">
                  <p className="text-lg font-bold">
                    {lastAttendance.filter((r) => r.status === "excused").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Excuses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
        <Button
          variant="ghost"
          className="h-11 min-h-[44px] w-full justify-center touch-manipulation sm:w-fit sm:justify-start sm:px-3"
          render={<Link href={`/admin/organizations/${organizationId}`} />}
        >
          ← Accueil organisation
        </Button>
      </div>
    </div>
  );
}
