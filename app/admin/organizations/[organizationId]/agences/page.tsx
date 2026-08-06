"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  MapPin,
  Package,
  QrCode,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ListGroup, ListItem } from "@/components/ui/list-item";

export default function AgencesDashboard() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const base = `/admin/organizations/${organizationId}/agences`;

  const links = [
    {
      href: `${base}/reservations/guichet`,
      title: "Guichet",
      description: "Vendre des billets et colis au comptoir",
      icon: Ticket,
    },
    {
      href: `${base}/reservations`,
      title: "Réservations",
      description: "Liste et suivi des ventes",
      icon: Users,
    },
    {
      href: `${base}/trajets`,
      title: "Trajets & départs",
      description: "Lignes bus / avion et planning",
      icon: MapPin,
    },
    {
      href: `${base}/passages`,
      title: "Embarquement",
      description: "Scan QR et pointage des passagers",
      icon: QrCode,
    },
    {
      href: `${base}/colis`,
      title: "Colis",
      description: "Suivi des envois et destinataires",
      icon: Package,
    },
  ] as const;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Agence"
        subtitle="Réservation voyage — Coccinelle"
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-5 md:max-w-4xl">
        <div className="grid grid-cols-2 gap-3">
          <Button
            render={<Link href={`${base}/reservations/guichet/vendre`} />}
            className="h-auto flex-col gap-2 py-4"
          >
            <Ticket className="size-5" />
            <span className="text-sm">Vendre</span>
          </Button>
          <Button
            variant="outline"
            render={
              <Link href={`${base}/reservations/guichet/vendre?express=1`} />
            }
            className="h-auto flex-col gap-2 py-4"
          >
            <Ticket className="size-5" />
            <span className="text-sm">Vente express</span>
          </Button>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Modules</h2>
          <ListGroup>
            {links.map((item) => (
              <ListItem
                key={item.href}
                href={item.href}
                title={item.title}
                description={item.description}
                leading={
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <item.icon className="size-5 text-primary" />
                  </div>
                }
                trailing={<ArrowRight className="size-4 text-muted-foreground" />}
              />
            ))}
          </ListGroup>
        </section>

        <Button
          variant="ghost"
          className="h-11 w-full justify-center touch-manipulation sm:w-fit sm:justify-start sm:px-3"
          render={<Link href={`/admin/organizations/${organizationId}`} />}
        >
          ← Accueil organisation
        </Button>
      </div>
    </div>
  );
}
