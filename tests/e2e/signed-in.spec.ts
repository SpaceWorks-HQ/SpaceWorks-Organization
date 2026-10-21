import { expect, test, type Page } from "@playwright/test";

// Signed-in journeys over the demo data from `npm run db:seed-demo` (plus `db:seed-reports`).
// The demo password comes from DEMO_PASSWORD; without it these tests are skipped.
const password = process.env.DEMO_PASSWORD;
test.skip(!password, "DEMO_PASSWORD is not set; seed the demo data to run signed-in journeys.");

async function signIn(page: Page, email: string) {
  // Type only after hydration, or React resets the controlled fields.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password!);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
}

test("an owner records an expense, sees it in the accounts and voids it", async ({ page }) => {
  await signIn(page, "owner@demo.test");
  await page.goto("/dashboard/tinkerspace/accounts");
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible();

  const category = `E2E supplies ${Date.now()}`;
  await page.getByRole("button", { name: "Payment made" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category").fill(category);
  await dialog.getByLabel("Amount").fill("1234.50");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();

  const statement = page.getByRole("table").first();
  await expect(statement.getByRole("row", { name: new RegExp(category) })).toContainText("₹1,234.50");

  const entry = page.locator("li", { hasText: category });
  await entry.getByRole("button", { name: "Void" }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByLabel("Reason").fill("End-to-end test");
  await confirm.getByRole("button", { name: "Void entry" }).click();
  await expect(entry).toContainText("Voided");
  await expect(statement.getByRole("row", { name: new RegExp(category) })).toHaveCount(0);
});

test("an owner sees the member list", async ({ page }) => {
  await signIn(page, "owner@demo.test");
  await page.goto("/dashboard/spaceworks/members");
  await expect(page.getByRole("heading", { name: "Members", level: 1 })).toBeVisible();
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toBeVisible();
});

test("a viewer is sent back from the accounts and never offered them", async ({ page }) => {
  await signIn(page, "viewer@demo.test");
  await page.goto("/dashboard/spaceworks/accounts");
  await expect(page).toHaveURL(/\/dashboard\/spaceworks$/);
  await expect(page.getByRole("link", { name: "Accounts" })).toHaveCount(0);
});

test("a member's portal lists their organisations", async ({ page }) => {
  await signIn(page, "applicant@demo.test");
  await page.goto("/account/organisations");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Ideologists|Kunj/).first()).toBeVisible();
});
