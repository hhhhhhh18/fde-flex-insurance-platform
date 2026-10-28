import { expect, test } from "@playwright/test";

test.describe("record management", () => {
  test("searches applicants and opens a detail record", async ({ page }) => {
    await page.goto("/applicants", { waitUntil: "networkidle" });
    const initialRows = await page.locator("tbody tr").count();
    expect(initialRows).toBeGreaterThan(0);

    await page.getByLabel("Search applicants").fill("Aisha");
    await page.waitForURL(/q=Aisha/);
    await page.waitForLoadState("networkidle");

    const filtered = await page.locator("tbody tr").count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(initialRows);

    await page.locator("tbody tr td a").first().click();
    await page.waitForURL(/\/applicants\/.+/);
    await expect(page.getByText("Back to applicants")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Profile" })).toBeVisible();
  });

  test("paginates quotes and preserves the current page", async ({ page }) => {
    await page.goto("/quotes", { waitUntil: "networkidle" });
    const firstOnPage1 = await page.locator("tbody tr td a").first().innerText();

    await page.getByRole("link", { name: "Next" }).click();
    await page.waitForURL(/page=2/);
    await page.waitForLoadState("networkidle");

    const firstOnPage2 = await page.locator("tbody tr td a").first().innerText();
    expect(firstOnPage2).not.toBe(firstOnPage1);
    await expect(page.getByText(/Showing 21–/)).toBeVisible();
  });

  test("filters assets by type", async ({ page, request }) => {
    const api = await request.get("/api/assets?status=VEHICLE&pageSize=100");
    const payload = (await api.json()) as { total: number };

    await page.goto("/assets", { waitUntil: "networkidle" });
    await page.locator("#filter-status").selectOption("VEHICLE");
    await page.waitForURL(/status=VEHICLE/);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("tbody tr")).toHaveCount(Math.min(payload.total, 20));
  });
});
