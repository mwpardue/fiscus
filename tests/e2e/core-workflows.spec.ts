import { expect, test, type Page } from "@playwright/test";

test("protected routes redirect anonymous users to login", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/events");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/events/11111111-1111-4111-8111-111111111111/edit");
  await expect(page).toHaveURL(/\/login$/);
});

test("a new user can sign up and create an account", async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const password = "testing-password-123";
  const accountName = `E2E Account ${Date.now()}`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel("Currency").fill("USD");
  await page.getByLabel("Timezone").fill("America/New_York");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await goToAppPage(page, "Accounts");
  await expect(page).toHaveURL(/\/accounts$/);
  await page.getByLabel("Account name").fill(accountName);
  await page.getByRole("button", { name: "Add account" }).click();

  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole("heading", { name: accountName })).toBeVisible();
  await expect(page.getByLabel(`${accountName} icon`)).toBeVisible();
});

async function goToAppPage(
  page: Page,
  name: "Accounts" | "Dashboard" | "Events"
) {
  const link = page.getByRole("link", { name }).first();

  if (!(await link.isVisible())) {
    await page.getByLabel("Open navigation menu").click();
  }

  await page.getByRole("link", { name }).first().click();
}
