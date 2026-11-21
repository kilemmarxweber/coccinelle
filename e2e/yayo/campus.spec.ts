import { test, expect } from "@playwright/test";
import { YayoCampusPage } from "./pages/campus.page";

/**
 * Recette CDC §20 — scénarios CAFE YAYO.
 * Auth réelle : PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD / PLAYWRIGHT_ORG_ID
 * et optionnellement PLAYWRIGHT_BRANCH_ID pour POS / caisse / stock.
 * Sans credentials : routes ≤ 500 et redirection login.
 */

const orgId = process.env.PLAYWRIGHT_ORG_ID ?? "demo-org";
const branchId = process.env.PLAYWRIGHT_BRANCH_ID ?? "demo-branch";

test.describe("CAFE YAYO campus", () => {
  test("accueil organisation répond", async ({ page }) => {
    const campus = new YayoCampusPage(page, orgId);
    const res = await campus.gotoOrg();
    expect(res?.status() ?? 0).toBeLessThan(500);
    await campus.expectBodyVisible();
  });

  test("caisse centrale, PCA et audit sont routés", async ({ page }) => {
    const campus = new YayoCampusPage(page, orgId);
    for (const path of ["caisse-centrale", "pca", "audit"] as const) {
      const res = await campus.goto(path);
      expect(res?.status() ?? 0, path).toBeLessThan(500);
    }
  });

  test("nouvelle branche campus n’expose pas Agence si profil YAYO", async ({
    page,
  }) => {
    const campus = new YayoCampusPage(page, orgId);
    await campus.goto("branches/new");
    await campus.expectBodyVisible();
    if (await campus.cafeBanner().isVisible().catch(() => false)) {
      await expect(campus.agenceTypeButton()).toHaveCount(0);
    }
  });

  test("POS, caisse et stock département répondent", async ({ page }) => {
    const base = `/admin/organizations/${orgId}/branches/${branchId}`;
    for (const path of [
      `${base}/boutique/pos`,
      `${base}/caisse`,
      `${base}/boutique/stock`,
      `${base}/bons-commande`,
    ] as const) {
      const res = await page.goto(path);
      expect(res?.status() ?? 0, path).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("backup / restore est documenté (check manuel)", async ({ page }) => {
    // Livrable CDC §19 : procédure hors code applicatif.
    await page.goto(`/admin/organizations/${orgId}`);
    await expect(page.locator("body")).toBeVisible();
  });
});
