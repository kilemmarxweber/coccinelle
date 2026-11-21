import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pcaTargetPct, resolvePcaPeriod } from "./pca-period";

const now = new Date(2026, 10, 21, 15, 30, 0);

describe("période PCA", () => {
  it("ouvre le mois en cours par défaut", () => {
    const period = resolvePcaPeriod({}, now);
    assert.equal(period.view, "mois");
    assert.equal(period.periodLabel, "Novembre 2026");
    assert.equal(period.rangeLabel, "1 – 21 novembre 2026");
    assert.equal(period.from.getDate(), 1);
    assert.equal(period.to.getDate(), 21);
    assert.equal(period.includesToday, true);
    assert.equal(period.seriesGrain, "jour");
    assert.equal(period.monthsInPeriod, 0.7);
  });

  it("prend un mois passé en entier", () => {
    const period = resolvePcaPeriod({ vue: "mois", annee: "2025", mois: "2" }, now);
    assert.equal(period.rangeLabel, "1 – 28 février 2025");
    assert.equal(period.to.getDate(), 28);
    assert.equal(period.includesToday, false);
    assert.equal(period.dayKpiLabel, "Dernier jour");
  });

  it("refuse un mois futur et une année hors limites", () => {
    const future = resolvePcaPeriod({ vue: "mois", annee: "2026", mois: "12" }, now);
    assert.equal(future.month, 11);
    const later = resolvePcaPeriod({ vue: "annee", annee: "2035" }, now);
    assert.equal(later.year, 2026);
    assert.equal(later.to.getMonth(), 10);
  });

  it("couvre une année passée du 1er janvier au 31 décembre", () => {
    const period = resolvePcaPeriod({ vue: "annee", annee: "2024" }, now);
    assert.equal(period.periodLabel, "Année 2024");
    assert.equal(period.rangeLabel, "1 janvier – 31 décembre 2024");
    assert.equal(period.seriesGrain, "mois");
    assert.equal(period.monthsInPeriod, 12);
    assert.equal(period.periodKpiLabel, "Ventes de l'année");
  });

  it("isole une journée et refuse un jour futur", () => {
    const period = resolvePcaPeriod(
      { vue: "jour", annee: "2026", mois: "11", jour: "21" },
      now,
    );
    assert.equal(period.periodLabel, "21 novembre 2026");
    assert.equal(period.reportKind, "Rapport du jour");
    assert.equal(period.span, 1);
    assert.equal(period.from.getDate(), 21);
    assert.equal(period.to.getDate(), 21);
    const future = resolvePcaPeriod(
      { vue: "jour", annee: "2026", mois: "11", jour: "30" },
      now,
    );
    assert.equal(future.day, 21);
  });

  it("prend N jours jusqu’au jour choisi, y compris sur deux mois", () => {
    const week = resolvePcaPeriod(
      { vue: "jours", annee: "2026", mois: "11", jour: "21", n: "7" },
      now,
    );
    assert.equal(week.span, 7);
    assert.equal(week.rangeLabel, "15 – 21 novembre 2026");
    assert.equal(week.periodLabel, "15 – 21 novembre 2026");
    assert.equal(week.periodKpiLabel, "Ventes de la période");
    const across = resolvePcaPeriod(
      { vue: "jours", annee: "2026", mois: "11", jour: "3", n: "10" },
      now,
    );
    assert.equal(across.rangeLabel, "25 octobre – 3 novembre 2026");
    assert.equal(across.from.getMonth(), 9);
    const huge = resolvePcaPeriod(
      { vue: "jours", annee: "2026", mois: "11", jour: "21", n: "900" },
      now,
    );
    assert.equal(huge.span, 366);
  });

  it("proratise l’année en cours et laisse dépasser 100 %", () => {
    const year = resolvePcaPeriod({ vue: "annee", annee: "2026" }, now);
    assert.equal(year.monthsInPeriod, 10.7);
    assert.equal(pcaTargetPct(250, 200, 1), 125);
    assert.equal(pcaTargetPct(36, 200, 0.7), 26);
    assert.equal(pcaTargetPct(36, 200, 1), 18);
    assert.equal(pcaTargetPct(0, 200, 1), 0);
    assert.equal(pcaTargetPct(50, 0, 1), null);
  });

  it("plafonne l’objectif à 100 % sur 1 ou 2 jours", () => {
    const two = resolvePcaPeriod(
      { vue: "jours", annee: "2026", mois: "11", jour: "21", n: "2" },
      now,
    );
    assert.equal(two.span, 2);
    assert.equal(two.rangeLabel, "20 – 21 novembre 2026");
    assert.equal(pcaTargetPct(36, 200, two.monthsInPeriod, two.span), 100);
    assert.equal(pcaTargetPct(4.5, 245, 1 / 30, 1), 55);
    assert.equal(pcaTargetPct(0, 200, two.monthsInPeriod, 2), 0);
    assert.equal(pcaTargetPct(250, 200, 1, 7), 125);
  });
});
