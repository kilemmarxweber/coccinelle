import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeBoardingToken, parseBoardingQrPayload } from "./boarding-token";

/**
 * Tests unitaires du parseur QR (domaine boarding).
 * Les flux Prisma `boardPassenger` sont couverts via le parcours UI / smoke manuel.
 */
describe("boarding parse (U16)", () => {
  const SECRET = "u16-secret";
  const CODE = "PASS-U16-TEST-001";

  it("accepte token signé et code brut", () => {
    const token = encodeBoardingToken(CODE, SECRET);
    const signed = parseBoardingQrPayload(token, SECRET);
    const raw = parseBoardingQrPayload(CODE, SECRET);
    assert.equal(signed.ok, true);
    assert.equal(raw.ok, true);
    if (signed.ok) assert.equal(signed.codeUnique, CODE);
    if (raw.ok) assert.equal(raw.codeUnique, CODE);
  });

  it("refuse payload vide ou inconnu", () => {
    assert.equal(parseBoardingQrPayload("", SECRET).ok, false);
    assert.equal(parseBoardingQrPayload("XYZ-123", SECRET).ok, false);
  });
});
