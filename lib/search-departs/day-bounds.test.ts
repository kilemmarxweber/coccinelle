import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayBounds, startOfToday } from "./day-bounds";

describe("dayBounds (U05)", () => {
  it("parse YYYY-MM-DD en bornes locales [start, end)", () => {
    const { start, end } = dayBounds("2026-08-05");
    assert.equal(start.getFullYear(), 2026);
    assert.equal(start.getMonth(), 7);
    assert.equal(start.getDate(), 5);
    assert.equal(start.getHours(), 0);
    assert.equal(end.getDate(), 6);
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  });

  it("refuse une date invalide", () => {
    assert.throws(() => dayBounds("not-a-date"), /Date invalide/);
  });
});

describe("startOfToday (U05)", () => {
  it("retourne minuit local du jour courant", () => {
    const s = startOfToday();
    const now = new Date();
    assert.equal(s.getFullYear(), now.getFullYear());
    assert.equal(s.getMonth(), now.getMonth());
    assert.equal(s.getDate(), now.getDate());
    assert.equal(s.getHours(), 0);
    assert.equal(s.getMinutes(), 0);
  });
});
