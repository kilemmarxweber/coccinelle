import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateInternalBarcode,
  isValidBarcode,
  normalizeBarcode,
  parseBarcodeInput,
} from "./barcode";

describe("hotel barcode", () => {
  it("normalise espaces et casse", () => {
    assert.equal(normalizeBarcode("  5901234123457 "), "5901234123457");
    assert.equal(normalizeBarcode("cc-abc"), "CC-ABC");
    assert.equal(normalizeBarcode("   "), null);
    assert.equal(normalizeBarcode(null), null);
  });

  it("valide EAN / codes internes", () => {
    assert.equal(isValidBarcode("5901234123457"), true);
    assert.equal(isValidBarcode("CCABCD123XYZ"), true);
    assert.equal(isValidBarcode("ab"), false);
    assert.equal(isValidBarcode(""), false);
  });

  it("parseBarcodeInput rejette les caractères interdits", () => {
    assert.equal(parseBarcodeInput(""), null);
    assert.throws(() => parseBarcodeInput("!!"), /invalide/i);
  });

  it("génère un code interne CC…", () => {
    const code = generateInternalBarcode("a1b2c3d4-eeee-ffff-0000-1111");
    assert.match(code, /^CCA1B2[A-Z0-9]+$/);
    assert.ok(isValidBarcode(code));
  });
});
