import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeBoardingToken,
  parseBoardingQrPayload,
} from "./boarding-token";

const SECRET = "test-boarding-secret";
const CODE = "PASS-0-1733123456789-ABC123";

describe("boarding-token (U08)", () => {
  it("encode un token CCNL1 signé", () => {
    const token = encodeBoardingToken(CODE, SECRET);
    assert.match(token, /^CCNL1\./);
    assert.ok(token.includes(CODE));
  });

  it("parse un token signé valide", () => {
    const token = encodeBoardingToken(CODE, SECRET);
    const parsed = parseBoardingQrPayload(token, SECRET);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.codeUnique, CODE);
      assert.equal(parsed.signed, true);
    }
  });

  it("refuse une signature invalide", () => {
    const token = encodeBoardingToken(CODE, SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    const parsed = parseBoardingQrPayload(tampered, SECRET);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.reason, "invalid_signature");
  });

  it("accepte un code PASS-* brut (pointage manuel)", () => {
    const parsed = parseBoardingQrPayload(CODE, SECRET);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.codeUnique, CODE);
      assert.equal(parsed.signed, false);
    }
  });

  it("refuse un payload vide ou inconnu", () => {
    assert.equal(parseBoardingQrPayload("", SECRET).ok, false);
    assert.equal(parseBoardingQrPayload("FOO-123", SECRET).ok, false);
  });
});
