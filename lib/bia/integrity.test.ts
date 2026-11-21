import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findingFingerprint, saleWithoutStockDrafts } from "./integrity";

describe("bia integrity", () => {
  it("empreinte stable par règle et objet", () => {
    assert.equal(findingFingerprint("VENTE_SANS_SORTIE", "sale-1"), "VENTE_SANS_SORTIE:sale-1");
  });

  it("signale une vente encaissée sans sortie et ignore une vente cohérente", () => {
    const drafts = saleWithoutStockDrafts([
      {
        id: "ok",
        ticketNumber: "TK-1",
        branchId: "b1",
        items: [{ productId: "p1", quantity: 2 }],
        stockMovements: [{ kind: "SORTIE", productId: "p1", quantity: 2 }],
      },
      {
        id: "bad",
        ticketNumber: "TK-2",
        branchId: "b1",
        items: [{ productId: "p2", quantity: 1 }],
        stockMovements: [],
      },
    ]);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.entityId, "bad");
    assert.equal(drafts[0]?.severity, "ELEVEE");
  });
});
