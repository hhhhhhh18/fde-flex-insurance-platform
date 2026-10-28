import { expect, test } from "@playwright/test";

test.describe("dashboard", () => {
  test("renders live KPIs and charts", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Portfolio overview");
    // KPI labels collide with chart captions; match the label text exactly.
    await expect(page.getByText("Quoted premium", { exact: true })).toBeVisible();
    await expect(page.getByText("Issued premium", { exact: true })).toBeVisible();
    await expect(page.getByText("Underwriting referrals", { exact: true })).toBeVisible();

    // Three Recharts surfaces: decision mix, policy status, premium trend.
    await expect(page.locator("svg.recharts-surface")).toHaveCount(3);
    await expect(page.getByRole("img", { name: /Quote decisions/i })).toBeVisible();

    // No starter-page remnants.
    await expect(page.getByText("To get started, edit")).toHaveCount(0);
  });

  test("navigation reaches every record section", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    for (const [label, heading] of [
      ["Applicants", "Applicants"],
      ["Insured assets", "Insured assets"],
      ["Products", "Products"],
      ["Quotes", "Quotes"],
      ["Policies", "Policies"],
      ["Renewals", "Renewals"],
      ["Endorsements", "Endorsements"],
      ["Underwriting", "Underwriting queue"],
      ["Exceptions", "Exception explorer"],
      ["Reports", "Reports"],
    ] as const) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    }
  });
});
