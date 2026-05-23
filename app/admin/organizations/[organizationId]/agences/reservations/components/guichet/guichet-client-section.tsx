"use client";

import { Search, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GuichetFormState } from "./use-guichet-form";

type Props = { form: GuichetFormState };

function clientDisplayName(parts: {
  prenom?: string;
  nom?: string;
  postnom?: string;
}) {
  return [parts.prenom, parts.nom, parts.postnom].filter(Boolean).join(" ");
}

export function GuichetClientSection({ form }: Props) {
  const { client } = form;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Client
        </CardTitle>
        <CardDescription>
          Recherchez un client existant ou créez-en un sans OTP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {client.selected ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="font-medium">{clientDisplayName(client.selected)}</p>
              <p className="text-sm text-muted-foreground">{client.selected.telephone}</p>
              <p className="text-sm text-muted-foreground">{client.selected.email}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => client.setSelected(null)}>
              Changer
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                placeholder="Nom, email, téléphone…"
                value={client.query}
                onChange={(e) => client.setQuery(e.target.value)}
              />
            </div>
            {client.searching && (
              <p className="text-sm text-muted-foreground">Recherche…</p>
            )}
            {client.hits.length > 0 && (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {client.hits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full touch-manipulation flex-col items-start px-4 py-3 text-left hover:bg-muted/50"
                      onClick={() => client.select(c)}
                    >
                      <span className="font-medium">{clientDisplayName(c)}</span>
                      <span className="text-sm text-muted-foreground">
                        {c.telephone} · {c.email}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => client.setShowNew((v) => !v)}
            >
              <UserPlus className="size-4" />
              {client.showNew ? "Masquer le formulaire" : "Nouveau client"}
            </Button>
            {client.showNew && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["nom", "Nom *"],
                    ["prenom", "Prénom"],
                    ["telephone", "Téléphone *"],
                    ["email", "Email *"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      type={key === "email" ? "email" : "text"}
                      className="h-11"
                      value={client.newClient[key]}
                      onChange={(e) =>
                        client.setNewClient((s) => ({ ...s, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <Button type="button" onClick={client.create} className="w-full">
                    Enregistrer le client
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
