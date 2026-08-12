"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChartCard,
  KpiGrid,
  formatMoney,
  formatQty,
} from "@/components/reports/report-shell";
import {
  DonutChart,
  DualBarChart,
  FinanceComboChart,
  SimpleBarChart,
  TrendAreaChart,
} from "@/components/reports/report-charts";
import { formatBothRateLabels } from "@/lib/cash/exchange";
import { defaultReportRange, toIsoDate } from "@/lib/hotel/reports/period";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
  type OrgExportMeta,
  type OrgExportTable,
} from "@/lib/org/report-exports";
import {
  getOrgAggregatedArticlesReportAction,
  getOrgAggregatedFinanceReportAction,
  getOrgAggregatedPurchasesReportAction,
  getOrgAggregatedSalesReportAction,
  getOrgAggregatedStockReportAction,
  type OrgBranchOption,
} from "@/lib/org/reports-actions";
import { cn } from "@/lib/utils";

type TabId = "ventes" | "achats" | "stock" | "articles" | "financier";

type SalesData = Awaited<ReturnType<typeof getOrgAggregatedSalesReportAction>>;
type PurchasesData = Awaited<
  ReturnType<typeof getOrgAggregatedPurchasesReportAction>
>;
type StockData = Awaited<ReturnType<typeof getOrgAggregatedStockReportAction>>;
type ArticlesData = Awaited<
  ReturnType<typeof getOrgAggregatedArticlesReportAction>
>;
type FinanceData = Awaited<
  ReturnType<typeof getOrgAggregatedFinanceReportAction>
>;

type Props = {
  organizationId: string;
  orgName: string;
  branches: OrgBranchOption[];
};

const TABS: { id: TabId; label: string }[] = [
  { id: "ventes", label: "Ventes" },
  { id: "achats", label: "Achats" },
  { id: "stock", label: "Stock" },
  { id: "articles", label: "Articles" },
  { id: "financier", label: "Financier" },
];

export function OrgRapportsClient(props: Props) {
  const fallback = defaultReportRange(30);
  const [tab, setTab] = useState<TabId>("ventes");
  const [selected, setSelected] = useState<string[]>(() =>
    props.branches.map((b) => b.id),
  );
  const [from, setFrom] = useState(fallback.from);
  const [to, setTo] = useState(fallback.to);
  const [pending, start] = useTransition();
  const [sales, setSales] = useState<SalesData | null>(null);
  const [purchases, setPurchases] = useState<PurchasesData | null>(null);
  const [stock, setStock] = useState<StockData | null>(null);
  const [articles, setArticles] = useState<ArticlesData | null>(null);
  const [finance, setFinance] = useState<FinanceData | null>(null);

  const allSelected =
    props.branches.length > 0 && selected.length === props.branches.length;

  function toggleBranch(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : props.branches.map((b) => b.id));
  }

  function clearTabData(nextTab: TabId) {
    if (nextTab === "ventes") setSales(null);
    if (nextTab === "achats") setPurchases(null);
    if (nextTab === "stock") setStock(null);
    if (nextTab === "articles") setArticles(null);
    if (nextTab === "financier") setFinance(null);
  }

  function load(
    nextTab = tab,
    nextFrom = from,
    nextTo = to,
    branchIds = selected,
  ) {
    if (branchIds.length === 0) {
      setSales(null);
      setPurchases(null);
      setStock(null);
      setArticles(null);
      setFinance(null);
      toast.error("Sélectionnez au moins une branche.");
      return;
    }
    clearTabData(nextTab);
    start(async () => {
      try {
        const base = {
          organizationId: props.organizationId,
          branchIds,
          from: nextFrom,
          to: nextTo,
        };
        if (nextTab === "ventes") {
          setSales(await getOrgAggregatedSalesReportAction(base));
        } else if (nextTab === "achats") {
          setPurchases(await getOrgAggregatedPurchasesReportAction(base));
        } else if (nextTab === "stock") {
          setStock(await getOrgAggregatedStockReportAction(base));
        } else if (nextTab === "articles") {
          setArticles(await getOrgAggregatedArticlesReportAction(base));
        } else {
          setFinance(await getOrgAggregatedFinanceReportAction(base));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur rapport");
      }
    });
  }

  function switchTab(next: TabId) {
    setTab(next);
    load(next);
  }

  useEffect(() => {
    if (props.branches.length === 0) return;
    load(
      "ventes",
      fallback.from,
      fallback.to,
      props.branches.map((b) => b.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- charge initiale
  }, [props.organizationId]);

  const activeRate =
    tab === "ventes"
      ? sales?.rate
      : tab === "achats"
        ? purchases?.rate
        : tab === "stock"
          ? stock?.rate
          : tab === "articles"
            ? articles?.rate
            : finance?.rate;
  const rates = formatBothRateLabels(activeRate)?.both ?? null;
  const money = (n: number) => formatMoney(n, activeRate ?? null);

  const typeLabel = useMemo(
    () =>
      ({
        AGENCE: "Agence",
        HOTEL: "Hôtel",
        RESTAURANT: "Restaurant",
        BOUTIQUE: "Commerce",
      }) as Record<string, string>,
    [],
  );

  const hasData =
    (tab === "ventes" && sales) ||
    (tab === "achats" && purchases) ||
    (tab === "stock" && stock) ||
    (tab === "articles" && articles) ||
    (tab === "financier" && finance);

  const branchNames = useMemo(() => {
    const set = new Set(selected);
    return props.branches.filter((b) => set.has(b.id)).map((b) => b.name);
  }, [props.branches, selected]);

  function buildExportPayload(): {
    meta: OrgExportMeta;
    table: OrgExportTable;
  } | null {
    const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "Rapport";
    const baseMeta = {
      orgName: props.orgName,
      reportTitle: `Rapport ${tabLabel}`,
      from,
      to,
      branchNames,
      rateBanner: rates,
    };

    if (tab === "ventes" && sales) {
      const rows: (string | number)[][] = [];
      for (const g of sales.groupsByBranchType) {
        rows.push([`— ${g.typeLabel.toUpperCase()} —`, "", "", "", "", "", "", ""]);
        for (const l of g.lines) {
          rows.push([
            l.day,
            l.branchName,
            l.label,
            l.receiptNumber ?? "",
            l.itemsLabel,
            l.participants.map((p) => `${p.role} : ${p.name}`).join(" · ") ||
              "—",
            l.method,
            money(l.usd),
          ]);
        }
        rows.push([
          `Total ${g.typeLabel}`,
          "",
          "",
          "",
          "",
          "",
          `${g.totals.count} ligne(s)`,
          money(g.totals.amount),
        ]);
      }
      rows.push([
        "TOTAL GÉNÉRAL",
        "",
        "",
        "",
        "",
        "",
        `${sales.lines.length} ligne(s)`,
        money(sales.linesTotal),
      ]);
      return {
        meta: {
          ...baseMeta,
          kpis: [
            { label: "CA encaissé", value: money(sales.kpis.ca) },
            { label: "Tickets", value: String(sales.kpis.tickets) },
            { label: "Articles (qté)", value: String(sales.kpis.qtySold) },
            { label: "Ticket moyen", value: money(sales.kpis.avgTicket) },
          ],
        },
        table: {
          headers: [
            "Jour",
            "Branche",
            "Réf.",
            "Reçu",
            "Articles",
            "Participants",
            "Mode",
            "Montant",
          ],
          rows,
        },
      };
    }

    if (tab === "achats" && purchases) {
      const rows: (string | number)[][] = [];
      for (const g of purchases.groupsByBranchType) {
        rows.push([`— ${g.typeLabel.toUpperCase()} —`, "", "", ""]);
        for (const p of g.lines) {
          rows.push([p.name, p.category, p.inQty, p.outQty]);
        }
        rows.push([
          `Total ${g.typeLabel}`,
          `${g.totals.products} produit(s)`,
          g.totals.qtyIn,
          g.totals.qtyOut,
        ]);
      }
      rows.push([
        "TOTAL GÉNÉRAL",
        "",
        purchases.kpis.qtyIn,
        purchases.kpis.qtyOut,
      ]);
      return {
        meta: {
          ...baseMeta,
          kpis: [
            { label: "Entrées", value: formatQty(purchases.kpis.qtyIn) },
            { label: "Sorties", value: formatQty(purchases.kpis.qtyOut) },
            { label: "Solde flux", value: formatQty(purchases.kpis.net) },
          ],
        },
        table: {
          headers: ["Produit", "Catégorie", "Entrées", "Sorties"],
          rows,
        },
      };
    }

    if (tab === "stock" && stock) {
      const rows: (string | number)[][] = [];
      for (const g of stock.groupsByBranchType) {
        rows.push([
          `— ${g.typeLabel.toUpperCase()} —`,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        for (const l of g.lines) {
          rows.push([
            l.day,
            l.branchName,
            l.productName,
            l.category,
            l.kindLabel,
            l.kind === "SORTIE" ? -l.quantity : l.quantity,
            l.source,
            l.userName,
            l.note,
          ]);
        }
        rows.push([
          `Total ${g.typeLabel}`,
          "",
          "",
          "",
          "",
          `E +${g.totals.qtyIn} / S −${g.totals.qtyOut} / A ${g.totals.qtyAdj}`,
          "",
          "",
          `${g.totals.movements} mvt(s)`,
        ]);
      }
      rows.push([
        "TOTAL GÉNÉRAL",
        "",
        "",
        "",
        "",
        `E +${stock.kpis.qtyIn} / S −${stock.kpis.qtyOut} / A ${stock.kpis.qtyAdj}`,
        "",
        "",
        `${stock.kpis.movements} mvt(s)`,
      ]);
      return {
        meta: {
          ...baseMeta,
          kpis: [
            { label: "Entrées", value: formatQty(stock.kpis.qtyIn) },
            { label: "Sorties", value: formatQty(stock.kpis.qtyOut) },
            { label: "Ajustements", value: formatQty(stock.kpis.qtyAdj) },
            { label: "Mouvements", value: formatQty(stock.kpis.movements) },
          ],
        },
        table: {
          headers: [
            "Jour",
            "Branche",
            "Produit",
            "Catégorie",
            "Type",
            "Qté",
            "Source",
            "Utilisateur",
            "Note",
          ],
          rows,
        },
      };
    }

    if (tab === "articles" && articles) {
      const rows: (string | number)[][] = [];
      for (const g of articles.groupsByBranchType) {
        rows.push([
          `— ${g.typeLabel.toUpperCase()} —`,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        for (const a of g.lines) {
          rows.push([
            a.day,
            a.branchName,
            a.name,
            a.category,
            a.qty,
            a.qtyDelta,
            money(a.revenue),
            a.stockOut,
          ]);
        }
        rows.push([
          `Total ${g.typeLabel}`,
          "",
          `${g.totals.articles} article(s)`,
          "",
          g.totals.qty,
          "",
          money(g.totals.revenue),
          g.totals.stockOut,
        ]);
      }
      rows.push([
        "TOTAL GÉNÉRAL",
        "",
        `${articles.kpis.articles} article(s)`,
        "",
        articles.kpis.qty,
        "",
        money(articles.kpis.revenue),
        articles.kpis.stockOut,
      ]);
      return {
        meta: {
          ...baseMeta,
          kpis: [
            { label: "Articles actifs", value: formatQty(articles.kpis.articles) },
            { label: "Qté vendue", value: formatQty(articles.kpis.qty) },
            { label: "CA articles", value: money(articles.kpis.revenue) },
            { label: "Sorties stock", value: formatQty(articles.kpis.stockOut) },
          ],
        },
        table: {
          headers: [
            "Jour",
            "Branche",
            "Article",
            "Catégorie",
            "Vendus",
            "Δ %",
            "CA",
            "Sorties",
          ],
          rows,
        },
      };
    }

    if (tab === "financier" && finance) {
      const rows: (string | number)[][] = [];
      for (const g of finance.groupsByBranchType) {
        rows.push([`— ${g.typeLabel.toUpperCase()} —`, "", "", "", "", "", ""]);
        for (const l of g.lines) {
          rows.push([
            l.day,
            l.branchName,
            l.label,
            l.receiptNumber ?? "",
            l.itemsLabel,
            l.method,
            money(l.usd),
          ]);
        }
        rows.push([
          `Total ${g.typeLabel}`,
          "",
          "",
          "",
          "",
          `${g.totals.count} ligne(s)`,
          money(g.totals.amount),
        ]);
      }
      rows.push([
        "TOTAL GÉNÉRAL",
        "",
        "",
        "",
        "",
        `${finance.lines.length} ligne(s)`,
        money(finance.linesTotal),
      ]);
      return {
        meta: {
          ...baseMeta,
          kpis: [
            { label: "Revenus", value: money(finance.kpis.revenue) },
            { label: "Entrées stock", value: formatQty(finance.kpis.qtyIn) },
            { label: "Sorties stock", value: formatQty(finance.kpis.qtyOut) },
            { label: "Rev. / sortie", value: money(finance.kpis.coverage) },
          ],
        },
        table: {
          headers: [
            "Jour",
            "Branche",
            "Réf.",
            "Reçu",
            "Articles",
            "Mode",
            "Montant",
          ],
          rows,
        },
      };
    }

    return null;
  }

  function handleExport(kind: "pdf" | "excel") {
    const payload = buildExportPayload();
    if (!payload) {
      toast.error("Chargez un rapport avant d’exporter.");
      return;
    }
    const ok =
      kind === "pdf"
        ? exportOrgReportPdf(payload.meta, payload.table)
        : exportOrgReportExcel(payload.meta, payload.table);
    if (!ok && kind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(kind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé");
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ANALYSES & RAPPORTS
          </h1>
          <p className="text-sm text-muted-foreground">
            {props.orgName} — sélectionnez une ou plusieurs branches
          </p>
          {rates ? (
            <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">
              {rates}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "gap-1.5",
              (!hasData || pending) && "pointer-events-none opacity-50",
            )}
            aria-disabled={!hasData || pending || undefined}
            onClick={() => {
              if (!hasData || pending) return;
              handleExport("pdf");
            }}
          >
            <FileDown className="size-4" />
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "gap-1.5",
              (!hasData || pending) && "pointer-events-none opacity-50",
            )}
            aria-disabled={!hasData || pending || undefined}
            onClick={() => {
              if (!hasData || pending) return;
              handleExport("excel");
            }}
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button
            variant="ghost"
            className="gap-1.5"
            render={<Link href={`/admin/organizations/${props.organizationId}`} />}
          >
            <ArrowLeft className="size-4" />
            Organisation
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Branches</p>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
        {props.branches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune branche accessible.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {props.branches.map((b) => {
              const on = selected.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBranch(b.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {b.name}
                  <span className="ml-1 opacity-70">
                    · {typeLabel[b.type] ?? b.type}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            [7, "7 jours"],
            [30, "30 jours"],
            [90, "90 jours"],
          ].map(([d, label]) => (
            <button
              key={String(d)}
              type="button"
              onClick={() => {
                const range = defaultReportRange(Number(d));
                setFrom(range.from);
                setTo(range.to);
                load(tab, range.from, range.to);
              }}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/80"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const t = toIsoDate(new Date());
              setFrom(t);
              setTo(t);
              load(tab, t, t);
            }}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/80"
          >
            Aujourd’hui
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="org-from">Du</Label>
            <Input
              id="org-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-to">Au</Label>
            <Input
              id="org-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className={cn(
              (pending || selected.length === 0) &&
                "pointer-events-none opacity-50",
            )}
            aria-disabled={pending || selected.length === 0 || undefined}
            onClick={() => {
              if (pending || selected.length === 0) return;
              load();
            }}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Chargement…
              </>
            ) : (
              "Appliquer"
            )}
          </Button>
          <p className="text-xs text-muted-foreground sm:ml-auto sm:self-center">
            {selected.length} branche{selected.length > 1 ? "s" : ""} · vs
            période précédente
          </p>
        </div>
      </section>

      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchTab(item.id)}
            disabled={pending}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {pending && !hasData ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Chargement du rapport…
        </p>
      ) : null}

      {!pending && selected.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Sélectionnez une ou plusieurs branches pour afficher le rapport.
        </p>
      ) : null}

      {tab === "ventes" && sales ? (
        <SalesPanel data={sales} money={money} pending={pending} />
      ) : null}
      {tab === "achats" && purchases ? (
        <PurchasesPanel data={purchases} pending={pending} />
      ) : null}
      {tab === "stock" && stock ? (
        <StockPanel data={stock} pending={pending} />
      ) : null}
      {tab === "articles" && articles ? (
        <ArticlesPanel data={articles} money={money} pending={pending} />
      ) : null}
      {tab === "financier" && finance ? (
        <FinancePanel data={finance} money={money} pending={pending} />
      ) : null}
    </div>
  );
}

function methodSlicesFromLines(
  lines: { method: string; usd: number }[],
  fallback: { name: string; value: number }[] = [],
) {
  const map = new Map<string, number>();
  for (const l of lines) {
    const v = Number(l.usd);
    if (!Number.isFinite(v) || v <= 0) continue;
    const name = String(l.method ?? "").trim() || "Autre";
    map.set(name, (map.get(name) ?? 0) + v);
  }
  if (map.size > 0) {
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }
  return fallback.map((d) => ({
    name: String(d.name ?? "").trim() || "Autre",
    value: Number(d.value) || 0,
  }));
}

function SalesPanel(props: {
  data: SalesData;
  money: (n: number) => string;
  pending: boolean;
}) {
  const { data, money } = props;
  const methodSlices = methodSlicesFromLines(data.lines, data.caByMethod);
  return (
    <div className={cn("space-y-5", props.pending && "opacity-60")}>
      <KpiGrid
        items={[
          {
            label: "CA encaissé",
            value: money(data.kpis.ca),
            delta: data.kpis.caDelta,
          },
          {
            label: "Tickets / ventes",
            value: String(data.kpis.tickets),
            delta: data.kpis.ticketsDelta,
          },
          {
            label: "Articles (qté)",
            value: String(data.kpis.qtySold),
          },
          {
            label: "Ticket moyen",
            value: money(data.kpis.avgTicket),
            hint: `${data.kpis.paymentsCount} paiements · ${data.kpis.branchCount} branche(s)`,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="CA par jour"
          description={`${data.period.from} → ${data.period.to}`}
          className="lg:col-span-3"
        >
          <TrendAreaChart
            data={data.caByDay.map((d) => ({
              day: d.day,
              value: d.value,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Modes de paiement"
          description="Répartition des encaissements"
          className="lg:col-span-2"
        >
          <DonutChart
            key={methodSlices.map((d) => `${d.name}:${d.value}`).join("|")}
            data={methodSlices}
          />
        </ChartCard>
        <ChartCard title="CA par branche" className="lg:col-span-5">
          <SimpleBarChart
            data={data.caByBranch.map((d) => ({
              name: d.name,
              value: d.value,
            }))}
          />
        </ChartCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Détail des encaissements</h2>
          <p className="text-xs text-muted-foreground">
            Rupture par type de branche · Total {money(data.linesTotal)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Jour</th>
                <th className="px-3 py-2 font-medium">Branche</th>
                <th className="px-3 py-2 font-medium">Réf.</th>
                <th className="px-3 py-2 font-medium">Articles</th>
                <th className="px-3 py-2 font-medium">Participants</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {data.groupsByBranchType.map((g) => (
                <Fragment key={g.type}>
                  <tr className="border-t border-border bg-muted/60">
                    <td
                      colSpan={7}
                      className="px-3 py-2 text-xs font-bold tracking-wide uppercase"
                    >
                      {g.typeLabel}
                      <span className="ml-2 font-normal normal-case text-muted-foreground">
                        · {g.totals.count} ligne(s)
                      </span>
                    </td>
                  </tr>
                  {g.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {l.day}
                      </td>
                      <td className="px-3 py-2 font-medium">{l.branchName}</td>
                      <td className="px-3 py-2">
                        {l.label}
                        {l.receiptNumber ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · #{l.receiptNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                        {l.itemsLabel}
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-muted-foreground">
                        {l.participants.length > 0 ? (
                          <div className="space-y-0.5 text-xs">
                            {l.participants.map((p) => (
                              <div key={`${l.id}-${p.role}`}>
                                <span className="font-medium text-foreground">
                                  {p.role}
                                </span>
                                {" : "}
                                {p.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">{l.method}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(l.usd)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/30">
                    <td
                      colSpan={6}
                      className="px-3 py-2.5 text-sm font-semibold"
                    >
                      Total {g.typeLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      {money(g.totals.amount)}
                    </td>
                  </tr>
                </Fragment>
              ))}
              {data.lines.length > 0 ? (
                <tr className="border-t-2 border-border bg-muted/50">
                  <td
                    colSpan={6}
                    className="px-3 py-3 text-sm font-bold uppercase tracking-wide"
                  >
                    Total général
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">
                    {money(data.linesTotal)}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Aucun encaissement sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PurchasesPanel(props: { data: PurchasesData; pending: boolean }) {
  const { data } = props;
  return (
    <div className={cn("space-y-5", props.pending && "opacity-60")}>
      <KpiGrid
        items={[
          {
            label: "Entrées stock",
            value: formatQty(data.kpis.qtyIn),
            delta: data.kpis.qtyInDelta,
            hint: `${data.kpis.linesIn} livraison(s)`,
          },
          {
            label: "Sorties / décomptes",
            value: formatQty(data.kpis.qtyOut),
            delta: data.kpis.qtyOutDelta,
            hint: `${data.kpis.linesOut} mouvement(s)`,
          },
          {
            label: "Solde flux",
            value: formatQty(data.kpis.net),
            delta: data.kpis.netDelta,
            hint: "Entrées − sorties",
          },
          {
            label: "Couverture",
            value:
              data.kpis.qtyOut > 0
                ? `${Math.round((data.kpis.qtyIn / data.kpis.qtyOut) * 100)} %`
                : "—",
            hint: `${data.kpis.branchCount} branche(s)`,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Entrées vs sorties"
          description="Flux stock agrégés (hôtel + commerce)"
          className="lg:col-span-3"
        >
          <DualBarChart data={data.flowByDay} />
        </ChartCard>
        <ChartCard
          title="Top produits"
          description="Volume d’entrées"
          className="lg:col-span-2"
        >
          <SimpleBarChart
            data={data.byProduct.slice(0, 8).map((p) => ({
              name: p.name.slice(0, 14),
              value: p.inQty,
            }))}
            color="#10b981"
          />
        </ChartCard>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Produits par type de branche</h2>
          <p className="text-xs text-muted-foreground">
            Rupture par type · totaux à chaque groupe
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Produit</th>
              <th className="px-4 py-3 text-left font-medium">Catégorie</th>
              <th className="px-4 py-3 text-right font-medium">Entrées</th>
              <th className="px-4 py-3 text-right font-medium">Sorties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.groupsByBranchType.map((g) => (
              <Fragment key={g.type}>
                <tr className="bg-muted/60">
                  <td
                    colSpan={4}
                    className="px-4 py-2 text-xs font-bold tracking-wide uppercase"
                  >
                    {g.typeLabel}
                    <span className="ml-2 font-normal normal-case text-muted-foreground">
                      · {g.totals.products} produit(s)
                    </span>
                  </td>
                </tr>
                {g.lines.map((p, index) => (
                  <tr key={`${g.type}-${p.productKey}-${index}`}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.category}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                      +{p.inQty}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">
                      −{p.outQty}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30">
                  <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold">
                    Total {g.typeLabel}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-emerald-600">
                    +{g.totals.qtyIn}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-rose-600">
                    −{g.totals.qtyOut}
                  </td>
                </tr>
              </Fragment>
            ))}
            {data.byProduct.length > 0 ? (
              <tr className="bg-muted/50">
                <td
                  colSpan={2}
                  className="px-4 py-3 text-sm font-bold uppercase tracking-wide"
                >
                  Total général
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-emerald-600">
                  +{data.kpis.qtyIn}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-rose-600">
                  −{data.kpis.qtyOut}
                </td>
              </tr>
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aucun mouvement sur la période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockPanel(props: { data: StockData; pending: boolean }) {
  const { data } = props;
  return (
    <div className={cn("space-y-5", props.pending && "opacity-60")}>
      <KpiGrid
        items={[
          {
            label: "Entrées",
            value: formatQty(data.kpis.qtyIn),
            delta: data.kpis.qtyInDelta,
            hint: `${data.kpis.linesIn} mouvement(s)`,
          },
          {
            label: "Sorties",
            value: formatQty(data.kpis.qtyOut),
            delta: data.kpis.qtyOutDelta,
            hint: `${data.kpis.linesOut} mouvement(s)`,
          },
          {
            label: "Ajustements",
            value: formatQty(data.kpis.qtyAdj),
            hint: "Corrections de stock",
          },
          {
            label: "Solde flux",
            value: formatQty(data.kpis.net),
            delta: data.kpis.netDelta,
            hint: `${data.kpis.movements} mvts · ${data.kpis.branchCount} branche(s)`,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Entrées vs sorties"
          description="Flux journaliers agrégés"
          className="lg:col-span-3"
        >
          <DualBarChart data={data.flowByDay} />
        </ChartCard>
        <ChartCard
          title="Par branche"
          description="Volume d’entrées"
          className="lg:col-span-2"
        >
          <SimpleBarChart
            data={data.byBranch.slice(0, 8).map((b) => ({
              name: b.name.slice(0, 14),
              value: b.inQty,
            }))}
            color="#10b981"
          />
        </ChartCard>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Synthèse par produit</h2>
          <p className="text-xs text-muted-foreground">
            Entrées, sorties et ajustements
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Catégorie</th>
                <th className="px-3 py-2 text-right font-medium">Entrées</th>
                <th className="px-3 py-2 text-right font-medium">Sorties</th>
                <th className="px-3 py-2 text-right font-medium">Ajust.</th>
              </tr>
            </thead>
            <tbody>
              {data.byProduct.map((p) => (
                <tr key={p.productKey} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.category}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                    +{p.inQty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                    −{p.outQty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.adjQty}
                  </td>
                </tr>
              ))}
              {data.byProduct.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Aucun mouvement sur la période.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Détail des mouvements</h2>
          <p className="text-xs text-muted-foreground">
            Rupture par type de branche · {data.lines.length} ligne
            {data.lines.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Jour</th>
                <th className="px-3 py-2 font-medium">Branche</th>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Qté</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Utilisateur</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.groupsByBranchType.map((g) => (
                <Fragment key={g.type}>
                  <tr className="border-t border-border bg-muted/60">
                    <td
                      colSpan={8}
                      className="px-3 py-2 text-xs font-bold tracking-wide uppercase"
                    >
                      {g.typeLabel}
                      <span className="ml-2 font-normal normal-case text-muted-foreground">
                        · {g.totals.movements} mvt(s)
                      </span>
                    </td>
                  </tr>
                  {g.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {l.day}
                      </td>
                      <td className="px-3 py-2 font-medium">{l.branchName}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.category}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            l.kind === "ENTREE" && "text-emerald-600",
                            l.kind === "SORTIE" && "text-rose-600",
                            l.kind === "AJUSTEMENT" && "text-amber-600",
                          )}
                        >
                          {l.kindLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {l.kind === "SORTIE"
                          ? `−${l.quantity}`
                          : `+${l.quantity}`}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {l.source}
                      </td>
                      <td className="px-3 py-2">{l.userName}</td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">
                        {l.note}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/30">
                    <td
                      colSpan={4}
                      className="px-3 py-2.5 text-sm font-semibold"
                    >
                      Total {g.typeLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">
                      <span className="text-emerald-600">
                        +{g.totals.qtyIn}
                      </span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-rose-600">−{g.totals.qtyOut}</span>
                      {g.totals.qtyAdj > 0 ? (
                        <>
                          <span className="mx-1 text-muted-foreground">/</span>
                          <span className="text-amber-600">
                            {g.totals.qtyAdj}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td
                      colSpan={3}
                      className="px-3 py-2.5 text-right text-xs text-muted-foreground"
                    >
                      Solde {formatQty(g.totals.net)} · {g.totals.movements}{" "}
                      mvt(s)
                    </td>
                  </tr>
                </Fragment>
              ))}
              {data.lines.length > 0 ? (
                <tr className="border-t-2 border-border bg-muted/50">
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-sm font-bold uppercase tracking-wide"
                  >
                    Total général
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold tabular-nums">
                    <span className="text-emerald-600">
                      +{data.kpis.qtyIn}
                    </span>
                    <span className="mx-1 text-muted-foreground">/</span>
                    <span className="text-rose-600">−{data.kpis.qtyOut}</span>
                    {data.kpis.qtyAdj > 0 ? (
                      <>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <span className="text-amber-600">
                          {data.kpis.qtyAdj}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td
                    colSpan={3}
                    className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground"
                  >
                    Solde {formatQty(data.kpis.net)} · {data.kpis.movements}{" "}
                    mvt(s)
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Aucun mouvement de stock sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ArticlesPanel(props: {
  data: ArticlesData;
  money: (n: number) => string;
  pending: boolean;
}) {
  const { data, money } = props;
  return (
    <div className={cn("space-y-5", props.pending && "opacity-60")}>
      <KpiGrid
        items={[
          {
            label: "Articles actifs",
            value: formatQty(data.kpis.articles),
          },
          {
            label: "Qté vendue",
            value: formatQty(data.kpis.qty),
            delta: data.kpis.qtyDelta,
          },
          {
            label: "CA articles",
            value: money(data.kpis.revenue),
          },
          {
            label: "Sorties stock",
            value: formatQty(data.kpis.stockOut),
            hint: `${data.kpis.branchCount} branche(s)`,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Ventes / jour"
          description="Volumes d’articles vendus"
          className="lg:col-span-3"
        >
          <TrendAreaChart
            data={data.soldByDay}
            color="#8b5cf6"
            valueLabel="Qté"
          />
        </ChartCard>
        <ChartCard
          title="Par catégorie"
          description="Mix des quantités"
          className="lg:col-span-2"
        >
          <DonutChart data={data.byCategory} />
        </ChartCard>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Articles par type de branche</h2>
          <p className="text-xs text-muted-foreground">
            Rupture par type · totaux à chaque groupe
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Jour</th>
                <th className="px-4 py-3 text-left font-medium">Branche</th>
                <th className="px-4 py-3 text-left font-medium">Article</th>
                <th className="px-4 py-3 text-left font-medium">Catégorie</th>
                <th className="px-4 py-3 text-right font-medium">Vendus</th>
                <th className="px-4 py-3 text-right font-medium">Δ</th>
                <th className="px-4 py-3 text-right font-medium">CA</th>
                <th className="px-4 py-3 text-right font-medium">Sorties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.groupsByBranchType.map((g) => (
                <Fragment key={g.type}>
                  <tr className="bg-muted/60">
                    <td
                      colSpan={8}
                      className="px-4 py-2 text-xs font-bold tracking-wide uppercase"
                    >
                      {g.typeLabel}
                      <span className="ml-2 font-normal normal-case text-muted-foreground">
                        · {g.totals.articles} article(s)
                      </span>
                    </td>
                  </tr>
                  {g.lines.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {a.day}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{a.branchName}</td>
                      <td className="px-4 py-2.5 font-medium">{a.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.category}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {a.qty}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {a.qtyDelta > 0 ? "+" : ""}
                        {a.qtyDelta}%
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {money(a.revenue)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {a.stockOut}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30">
                    <td
                      colSpan={4}
                      className="px-4 py-2.5 text-sm font-semibold"
                    >
                      Total {g.typeLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums">
                      {g.totals.qty}
                    </td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums">
                      {money(g.totals.revenue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums">
                      {g.totals.stockOut}
                    </td>
                  </tr>
                </Fragment>
              ))}
              {data.groupsByBranchType.length > 0 ? (
                <tr className="bg-muted/50">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm font-bold uppercase tracking-wide"
                  >
                    Total général
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                    {data.kpis.qty}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                    {money(data.kpis.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                    {data.kpis.stockOut}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucune vente d’articles sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FinancePanel(props: {
  data: FinanceData;
  money: (n: number) => string;
  pending: boolean;
}) {
  const { data, money } = props;
  const methodSlices = methodSlicesFromLines(data.lines, data.revenueByMethod);
  return (
    <div className={cn("space-y-5", props.pending && "opacity-60")}>
      <KpiGrid
        items={[
          {
            label: "Revenus",
            value: money(data.kpis.revenue),
            delta: data.kpis.revenueDelta,
          },
          {
            label: "Entrées stock",
            value: formatQty(data.kpis.qtyIn),
            delta: data.kpis.qtyInDelta,
          },
          {
            label: "Sorties stock",
            value: formatQty(data.kpis.qtyOut),
            delta: data.kpis.qtyOutDelta,
          },
          {
            label: "Rev. / sortie",
            value: money(data.kpis.coverage),
            hint: `${data.kpis.branchCount} branche(s)`,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Revenus & flux stock"
          description="Comparaison journalière agrégée"
          className="lg:col-span-3"
        >
          <FinanceComboChart data={data.flowByDay} />
        </ChartCard>
        <ChartCard
          title="Paiements"
          description="Méthodes d’encaissement"
          className="lg:col-span-2"
        >
          <DonutChart
            key={methodSlices.map((d) => `${d.name}:${d.value}`).join("|")}
            data={methodSlices}
          />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="CA quotidien" description="Courbe des encaissements">
          <TrendAreaChart data={data.revenueByDay} valueLabel="CA $" />
        </ChartCard>
        <ChartCard
          title="Mix folio"
          description="Répartition des lignes (nuit, F&B…)"
        >
          {data.folioByKind.length > 0 ? (
            <SimpleBarChart data={data.folioByKind} color="#f59e0b" />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aucune ligne de folio sur la période.
            </p>
          )}
        </ChartCard>
      </div>

      {data.revenueByBranch.length > 0 ? (
        <ChartCard title="Revenus par branche" description="CA agrégé">
          <SimpleBarChart
            data={data.revenueByBranch.map((d) => ({
              name: d.name,
              value: d.value,
            }))}
          />
        </ChartCard>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Détail des encaissements</h2>
          <p className="text-xs text-muted-foreground">
            Rupture par type de branche · Total {money(data.linesTotal)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Jour</th>
                <th className="px-3 py-2 font-medium">Branche</th>
                <th className="px-3 py-2 font-medium">Réf.</th>
                <th className="px-3 py-2 font-medium">Articles</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {data.groupsByBranchType.map((g) => (
                <Fragment key={g.type}>
                  <tr className="border-t border-border bg-muted/60">
                    <td
                      colSpan={6}
                      className="px-3 py-2 text-xs font-bold tracking-wide uppercase"
                    >
                      {g.typeLabel}
                      <span className="ml-2 font-normal normal-case text-muted-foreground">
                        · {g.totals.count} ligne(s)
                      </span>
                    </td>
                  </tr>
                  {g.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {l.day}
                      </td>
                      <td className="px-3 py-2 font-medium">{l.branchName}</td>
                      <td className="px-3 py-2">
                        {l.label}
                        {l.receiptNumber ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · #{l.receiptNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                        {l.itemsLabel}
                      </td>
                      <td className="px-3 py-2">{l.method}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(l.usd)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/30">
                    <td
                      colSpan={5}
                      className="px-3 py-2.5 text-sm font-semibold"
                    >
                      Total {g.typeLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      {money(g.totals.amount)}
                    </td>
                  </tr>
                </Fragment>
              ))}
              {data.lines.length > 0 ? (
                <tr className="border-t-2 border-border bg-muted/50">
                  <td
                    colSpan={5}
                    className="px-3 py-3 text-sm font-bold uppercase tracking-wide"
                  >
                    Total général
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">
                    {money(data.linesTotal)}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Aucun encaissement sur la période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
