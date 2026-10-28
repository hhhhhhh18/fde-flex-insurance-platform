import { expect, test } from "@playwright/test";

test.describe("operations", () => {
  test("underwriting queue is read-only for applicants and actionable for reviewers", async ({ page }) => {
    await page.goto("/underwriting", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Underwriting queue");

    // Default demo role is APPLICANT: no decision controls, an explicit notice instead.
    await expect(page.getByText("Decision requires the Risk reviewer or Admin role").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Record decision" })).toHaveCount(0);

    await page.locator("#role-switcher").selectOption("RISK_REVIEWER");
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Read-only view")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Record decision" }).first()).toBeVisible();
  });

  test("exception explorer filters findings and shows evidence", async ({ page }) => {
    await page.goto("/exceptions", { waitUntil: "networkidle" });

    const all = await page.locator("tbody tr").count();
    expect(all).toBeGreaterThan(0);

    await page.locator("#severity-filter").selectOption("HIGH");
    const high = await page.locator("tbody tr").count();
    expect(high).toBeLessThanOrEqual(all);

    await page.locator("#truth-filter").selectOption("unlabelled");
    await expect(page.getByText("No findings match these filters")).toBeVisible();

    await page.locator("#truth-filter").selectOption("all");
    await page.locator("#severity-filter").selectOption("all");
    await page.locator("tbody tr").first().click();
    await expect(page.getByText("Suggested remediation", { exact: true })).toBeVisible();
    await expect(page.getByText("Expected", { exact: true })).toBeVisible();
    await expect(page.getByText("Observed", { exact: true })).toBeVisible();
  });

  test("reports show totals and export CSV and SQL", async ({ page, request }) => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    await expect(page.getByText("Quote decisions")).toBeVisible();
    await expect(page.getByText("Findings by issue type")).toBeVisible();
    await expect(page.getByRole("link", { name: "Master data (SQL)" })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "CSV", exact: true }).first().click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^insurancelab-.+-\d{4}-\d{2}-\d{2}\.csv$/);

    const sql = await request.get("/api/exports/data?entity=all&format=sql");
    expect(sql.status()).toBe(200);
    expect(sql.headers()["content-type"]).toContain("application/sql");
    expect(await sql.text()).toContain('INSERT INTO "Product"');

    const json = await request.get("/api/exports/data?entity=quotes&format=json");
    expect(json.status()).toBe(200);
    // The JSON export is keyed by entity name, e.g. { "quotes": [...] }.
    const body = (await json.json()) as Record<string, unknown[]>;
    expect(Array.isArray(body.quotes)).toBe(true);
    expect(body.quotes.length).toBeGreaterThan(0);
  });
});
