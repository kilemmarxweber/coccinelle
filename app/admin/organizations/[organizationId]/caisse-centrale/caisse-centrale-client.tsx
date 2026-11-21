"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  postCentralCashAction,
  receiveRemittanceAction,
} from "@/lib/central-cash/actions";
import { formatMoney } from "@/components/reports/report-shell";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import {
  PilotageFrame,
  PilotageKpis,
  PilotageTable,
} from "@/components/org/pilotage-frame";

type Remittance = {
  id: string;
  number: string;
  status: string;
  expectedUsd: number;
  declaredUsd: number;
  receivedUsd: number | null;
  varianceDeclaredUsd: number;
  varianceReceivedUsd: number | null;
  createdAt: string;
  branchName: string;
  branchCode: string;
  note: string | null;
};

type Journal = {
  id: string;
  number: string;
  kind: string;
  amountUsd: number;
  justification: string;
  createdAt: string;
};

type Props = {
  organizationId: string;
  orgName: string;
  data: {
    balanceUsd: number;
    remittances: Remittance[];
    journal: Journal[];
    branches: { id: string; name: string; code: string }[];
  };
};

export function CaisseCentraleClient({ organizationId, orgName, data }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [received, setReceived] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");

  function receive(id: string) {
    const n = Number(received[id]);
    if (!Number.isFinite(n)) {
      toast.error("Indiquez le montant reçu.");
      return;
    }
    start(async () => {
      try {
        await receiveRemittanceAction({
          organizationId,
          remittanceId: id,
          receivedUsd: n,
        });
        toast.success("Accusé de réception enregistré");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function postMove() {
    start(async () => {
      try {
        await postCentralCashAction({
          organizationId,
          kind,
          amountUsd: Number(amount),
          justification,
        });
        setAmount("");
        setJustification("");
        toast.success("Mouvement coffre enregistré");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const pendingRows = data.remittances.filter((r) => r.status !== "RECEIVED");
  const today = new Date().toISOString().slice(0, 10);

  function handleExport(kind: "pdf" | "excel") {
    const meta = {
      orgName,
      reportTitle: "Caisse centrale",
      from: today,
      to: today,
      branchNames: data.branches.map((b) => b.name),
      kpis: [
        { label: "Solde coffre", value: formatMoney(data.balanceUsd) },
        { label: "Versements en attente", value: String(pendingRows.length) },
        { label: "Écritures journal", value: String(data.journal.length) },
      ],
    };
    const remittanceTable = {
      title: "Versements",
      headers: [
        "Référence",
        "Département",
        "Statut",
        "Théorique",
        "Déclaré",
        "Reçu",
        "Écart déclaré",
      ],
      rows: data.remittances.map((r) => [
        r.number,
        r.branchName,
        STATUS[r.status] ?? r.status,
        r.expectedUsd,
        r.declaredUsd,
        r.receivedUsd ?? "—",
        r.varianceDeclaredUsd,
      ]),
    };
    const journalTable = {
      title: "Journal du coffre",
      headers: ["Référence", "Type", "Montant", "Justificatif", "Date"],
      rows: data.journal.map((j) => [
        j.number,
        KIND[j.kind] ?? j.kind,
        j.amountUsd,
        j.justification,
        new Date(j.createdAt).toLocaleString("fr-FR"),
      ]),
    };
    const ok =
      kind === "pdf"
        ? exportOrgReportPdf(meta, remittanceTable, [journalTable])
        : exportOrgReportExcel(meta, remittanceTable, [journalTable]);
    if (!ok && kind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(kind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé");
  }

  return (
    <PilotageFrame
      backHref={`/admin/organizations/${organizationId}`}
      kicker="Caisse centrale"
      title={orgName}
      subtitle="Versements des départements et journal du coffre. L’export reprend les deux tableaux."
      onPdf={() => handleExport("pdf")}
      onExcel={() => handleExport("excel")}
    >
      <PilotageKpis
        items={[
          { label: "Solde coffre", value: formatMoney(data.balanceUsd) },
          {
            label: "À recevoir",
            value: String(pendingRows.length),
            hint: "Versements non accusés",
            tone: pendingRows.length > 0 ? "alert" : "green",
          },
          { label: "Écritures", value: String(data.journal.length) },
          { label: "Départements", value: String(data.branches.length) },
        ]}
      />

      <section className="flex shrink-0 flex-wrap items-end gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={kind === "ENTRY" ? "default" : "outline"}
            onClick={() => setKind("ENTRY")}
          >
            Entrée
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "EXIT" ? "default" : "outline"}
            onClick={() => setKind("EXIT")}
          >
            Sortie
          </Button>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px]">Montant USD</Label>
          <Input
            className="h-8 w-28"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid min-w-[180px] flex-1 gap-1">
          <Label className="text-[11px]">Justificatif</Label>
          <Input
            className="h-8"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Pièce, motif"
          />
        </div>
        <Button size="sm" className="h-8" disabled={pending} onClick={postMove}>
          Enregistrer
        </Button>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
        <PilotageTable
          title="Versements"
          headers={["Réf.", "Département", "Théorique", "Déclaré", "Reçu", "Statut"]}
        >
          {data.remittances.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-muted-foreground">
                Aucun versement.
              </td>
            </tr>
          ) : (
            data.remittances.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.number}</td>
                <td>{r.branchName}</td>
                <td className="tabular-nums">{formatMoney(r.expectedUsd)}</td>
                <td className="tabular-nums">{formatMoney(r.declaredUsd)}</td>
                <td>
                  {r.status === "RECEIVED" ? (
                    <span className="tabular-nums">
                      {formatMoney(r.receivedUsd ?? 0)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Input
                        className="h-7 w-24"
                        type="number"
                        min={0}
                        step="0.01"
                        value={received[r.id] ?? String(r.declaredUsd)}
                        onChange={(e) =>
                          setReceived((m) => ({ ...m, [r.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        className="h-7"
                        disabled={pending}
                        onClick={() => receive(r.id)}
                      >
                        Recevoir
                      </Button>
                    </span>
                  )}
                </td>
                <td>
                  <span className="rounded-full bg-[#e9f7ef] px-2 py-0.5 text-[11px] font-medium text-[#157a3c]">
                    {STATUS[r.status] ?? r.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </PilotageTable>

        <PilotageTable
          title="Journal du coffre"
          headers={["Réf.", "Type", "Montant", "Justificatif", "Date"]}
        >
          {data.journal.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-muted-foreground">
                Aucune écriture.
              </td>
            </tr>
          ) : (
            data.journal.map((j) => (
              <tr key={j.id}>
                <td className="font-medium">{j.number}</td>
                <td>{KIND[j.kind] ?? j.kind}</td>
                <td
                  className={
                    j.amountUsd < 0
                      ? "tabular-nums text-[#c2410c]"
                      : "tabular-nums text-[#157a3c]"
                  }
                >
                  {formatMoney(j.amountUsd)}
                </td>
                <td className="max-w-[220px] truncate">{j.justification}</td>
                <td className="whitespace-nowrap text-muted-foreground">
                  {new Date(j.createdAt).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))
          )}
        </PilotageTable>
      </div>
    </PilotageFrame>
  );
}

const STATUS: Record<string, string> = {
  PREPARED: "Préparé",
  RECEIVED: "Reçu",
  DISPUTED: "En écart",
};

const KIND: Record<string, string> = {
  ENTRY: "Entrée",
  EXIT: "Sortie",
  REMITTANCE_IN: "Versement reçu",
};
