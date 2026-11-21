import { type Page, expect } from "@playwright/test";

/** Page Object — campus CAFE YAYO (org + départements). */
export class YayoCampusPage {
  constructor(
    private readonly page: Page,
    private readonly orgId: string,
  ) {}

  orgHome() {
    return `/admin/organizations/${this.orgId}`;
  }

  async gotoOrg() {
    return this.page.goto(this.orgHome());
  }

  async goto(path: string) {
    return this.page.goto(`${this.orgHome()}/${path}`);
  }

  async expectBodyVisible() {
    await expect(this.page.locator("body")).toBeVisible();
  }

  agenceTypeButton() {
    return this.page.getByRole("button", { name: /^Agence$/i });
  }

  cafeBanner() {
    return this.page.getByText(/sans voyage ni chambres/i);
  }
}
