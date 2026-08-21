import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceCeilingUsd,
  computePayslipTotals,
  defaultPayTreatment,
} from "./engine";
import { canNotifyAbsence, parseWorkWeek, workingYmdsInMonth } from "./dates";
import { DEFAULT_WORK_WEEK } from "./constants";

describe("paie journalière — formules §4", () => {
  it("bulletin : 26 ouvrés, 1 absent non justifié, 1 justifié, 1 congé, avance 40 $ → net 210", () => {
    const t = computePayslipTotals({
      expectedDays: 26,
      unpaidAbsenceDays: 1,
      dailyRateUsd: 10,
      advancesUsd: 40,
    });
    assert.equal(t.grossUsd, 260);
    assert.equal(t.absenceDeductionUsd, 10);
    assert.equal(t.advancesUsd, 40);
    assert.equal(t.netUsd, 210);
    assert.equal(t.paidDays, 25);
  });

  it("justifié / prévenu / congé ne coupent pas (UNPAID seul déduit)", () => {
    assert.equal(defaultPayTreatment("PRESENT"), "PAID");
    assert.equal(defaultPayTreatment("LEAVE"), "PAID");
    assert.equal(defaultPayTreatment("ABSENT_NOTIFIED"), "PAID");
    assert.equal(defaultPayTreatment("ABSENT"), "UNPAID");
    assert.equal(defaultPayTreatment("REST"), "NONE");
  });

  it("plafond avance : 10 jours × 10 $ , 50 % → 50 $ max, déjà 0", () => {
    assert.equal(
      advanceCeilingUsd({
        earnedUsd: 100,
        alreadyAdvancedUsd: 0,
        advanceCapPct: 0.5,
      }),
      50,
    );
    assert.equal(
      advanceCeilingUsd({
        earnedUsd: 100,
        alreadyAdvancedUsd: 0,
        advanceCapPct: 0.5,
      }) >= 60,
      false,
    );
    assert.equal(
      advanceCeilingUsd({
        earnedUsd: 100,
        alreadyAdvancedUsd: 40,
        advanceCapPct: 0.5,
      }),
      50,
    );
    assert.equal(
      advanceCeilingUsd({
        earnedUsd: 100,
        alreadyAdvancedUsd: 60,
        advanceCapPct: 0.5,
      }),
      40,
    );
  });

  it("avance 60 $ refusée, 40 $ dans le plafond 50 % de 100 $", () => {
    const cap = advanceCeilingUsd({
      earnedUsd: 100,
      alreadyAdvancedUsd: 0,
      advanceCapPct: 0.5,
    });
    assert.equal(60 > cap, true);
    assert.equal(40 <= cap, true);
    const after40 = computePayslipTotals({
      expectedDays: 10,
      unpaidAbsenceDays: 0,
      dailyRateUsd: 10,
      advancesUsd: 40,
    });
    assert.equal(after40.netUsd, 60);
  });

  it("calendrier lun–sam : dimanche hors brut", () => {
    const week = parseWorkWeek(["MON", "TUE", "WED", "THU", "FRI", "SAT"]);
    assert.deepEqual(week, DEFAULT_WORK_WEEK);
    const days = workingYmdsInMonth({
      year: 2026,
      month: 8,
      workWeek: week,
      timeZone: "Africa/Kinshasa",
    });
    assert.equal(days.includes("2026-08-02"), false);
    assert.equal(days.includes("2026-08-03"), true);
  });

  it("préavis : avant 18 h la veille → autorisé", () => {
    assert.equal(
      canNotifyAbsence({
        workYmd: "2026-08-21",
        now: new Date("2026-08-20T16:00:00.000Z"),
        timeZone: "Africa/Kinshasa",
        notifyBeforeHour: 18,
      }),
      true,
    );
    assert.equal(
      canNotifyAbsence({
        workYmd: "2026-08-21",
        now: new Date("2026-08-20T18:30:00.000Z"),
        timeZone: "UTC",
        notifyBeforeHour: 18,
      }),
      false,
    );
  });
});
