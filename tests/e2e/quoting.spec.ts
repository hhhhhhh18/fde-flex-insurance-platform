import { expect, test } from "@playwright/test";

test.describe("quote evaluation", () => {
  test("evaluates a quote end to end and persists it", async ({ page, request }) => {
    const before = await (await request.get("/api/quotes?pageSize=1")).json();

    await page.goto("/quotes/new", { waitUntil: "networkidle" });

    await page.getByLabel("Applicant").fill("Aisha");
    await page.locator('[role="listbox"] [role="option"] button').first().click();
    await expect(page.locator("#applicant-help")).toContainText("Selected");

    const products = await (await request.get("/api/products")).json();
    const product = products.items[0];
    await page.locator("#productId").selectOption(product.id);

    const assetOptions = page.locator("#assetId option");
    if ((await assetOptions.count()) > 1) {
      await page.locator("#assetId").selectOption({ index: 1 });
    }

    await page.getByRole("button", { name: "Evaluate quote" }).click();

    await expect(page.getByText("Evaluation result")).toBeVisible();
    await expect(page.getByText("Premium breakdown")).toBeVisible();
    await expect(page.getByText("Coverage lines")).toBeVisible();

    const reference = await page.locator("a[href^='/quotes/']").first().innerText();
    expect(reference).toMatch(/^QTE-\d{4}-\d{5}$/);

    const after = await (await request.get("/api/quotes?pageSize=1")).json();
    expect(after.total).toBe(before.total + 1);
  });

  test("blocks submission until the form is valid", async ({ page }) => {
    await page.goto("/quotes/new", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Evaluate quote" }).click();
    await expect(page.getByText("Select an applicant")).toBeVisible();
    await expect(page.getByText("Evaluation result")).toHaveCount(0);
  });
});
