import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contrastingForeground,
  DEFAULT_CUSTOMER_UI_THEME,
  hasCustomCustomerUi,
  matchingCustomerUiPresetId,
  normalizeHexColor,
  parseCustomerUiTheme,
  serializeCustomerUiForDb,
  themesEqual,
} from "./customer-ui-theme";

describe("customer-ui-theme", () => {
  it("normalise un hex valide", () => {
    assert.equal(normalizeHexColor(" #abCDef ", "#000000"), "#ABCDEF");
  });

  it("retombe sur le fallback si hex invalide", () => {
    assert.equal(normalizeHexColor("orange", "#F3F3F3"), "#F3F3F3");
  });

  it("choisit un texte clair sur accent foncé", () => {
    assert.equal(contrastingForeground("#15803D"), "#FFFFFF");
  });

  it("lit les colonnes branche en priorité sur settings", () => {
    const theme = parseCustomerUiTheme({
      customerUiPrimary: "#2563EB",
      customerUiBackground: null,
      customerUiCard: null,
      settings: {
        customerUi: { primary: "#DC2626", background: "#111111" },
      },
    });
    assert.equal(theme.primary, "#2563EB");
    assert.equal(theme.background, "#F3F3F3");
  });

  it("lit settings.customerUi si les colonnes sont vides", () => {
    const theme = parseCustomerUiTheme({
      settings: {
        customerUi: {
          primary: "#7c3aed",
          background: "#f3f3f3",
          card: "#ffffff",
        },
      },
    });
    assert.equal(theme.primary, "#7C3AED");
    assert.equal(matchingCustomerUiPresetId(theme), "violet");
  });

  it("sérialise le thème Coccinelle en NULL", () => {
    const row = serializeCustomerUiForDb(DEFAULT_CUSTOMER_UI_THEME);
    assert.equal(row.customerUiPrimary, null);
    assert.equal(row.customerUi, null);
    assert.equal(
      hasCustomCustomerUi({
        customerUiPrimary: row.customerUiPrimary,
        customerUiBackground: row.customerUiBackground,
        customerUiCard: row.customerUiCard,
      }),
      false,
    );
  });

  it("sérialise un thème custom en hex", () => {
    const row = serializeCustomerUiForDb({
      primary: "#2563eb",
      background: "#F3F3F3",
      card: "#ffffff",
    });
    assert.equal(row.customerUiPrimary, "#2563EB");
    assert.ok(row.customerUi);
    assert.equal(
      themesEqual(
        row.customerUi,
        parseCustomerUiTheme({
          customerUiPrimary: row.customerUiPrimary,
          customerUiBackground: row.customerUiBackground,
          customerUiCard: row.customerUiCard,
        }),
      ),
      true,
    );
  });
});
