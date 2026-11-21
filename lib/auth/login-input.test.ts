import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginInputError } from "./login-input";

describe("login input", () => {
  it("accepte un email et un mot de passe ordinaires", () => {
    assert.equal(loginInputError("kilem@exemple.cd", "Mot de passe 1"), null);
  });

  it("refuse une injection dans l’email", () => {
    assert.ok(loginInputError("a' OR 1=1 --@x.com", "secret"));
    assert.ok(loginInputError("a@x.com; DROP TABLE user", "secret"));
  });

  it("refuse un mot de passe vide ou un octet nul", () => {
    assert.ok(loginInputError("a@x.com", ""));
    assert.ok(loginInputError("a@x.com", "ok\0"));
  });
});
