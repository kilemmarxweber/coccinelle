import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datesOverlap } from "@/lib/hotel/availability";

describe("datesOverlap", () => {
  it("detects overlapping half-open ranges", () => {
    const a0 = new Date("2026-08-10T00:00:00.000Z");
    const a1 = new Date("2026-08-12T00:00:00.000Z");
    const b0 = new Date("2026-08-11T00:00:00.000Z");
    const b1 = new Date("2026-08-13T00:00:00.000Z");
    assert.equal(datesOverlap(a0, a1, b0, b1), true);
  });

  it("allows back-to-back nights (checkout = next check-in)", () => {
    const a0 = new Date("2026-08-10T00:00:00.000Z");
    const a1 = new Date("2026-08-12T00:00:00.000Z");
    const b0 = new Date("2026-08-12T00:00:00.000Z");
    const b1 = new Date("2026-08-14T00:00:00.000Z");
    assert.equal(datesOverlap(a0, a1, b0, b1), false);
  });

  it("rejects fully disjoint ranges", () => {
    const a0 = new Date("2026-08-10T00:00:00.000Z");
    const a1 = new Date("2026-08-11T00:00:00.000Z");
    const b0 = new Date("2026-08-12T00:00:00.000Z");
    const b1 = new Date("2026-08-13T00:00:00.000Z");
    assert.equal(datesOverlap(a0, a1, b0, b1), false);
  });
});
