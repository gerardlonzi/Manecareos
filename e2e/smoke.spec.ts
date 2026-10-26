import { expect, test } from "@playwright/test";

test("landing page is public and has Commencer / Se connecter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /commencer/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /se connecter/i }).first()).toBeVisible();
});

test("login and signup pages render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("form")).toBeVisible();
  await page.goto("/signup");
  await expect(page.locator("form")).toBeVisible();
});

for (const path of ["/dashboard", "/staff", "/staff/new", "/missions", "/find-staff", "/activity", "/notifications", "/settings"]) {
  test(`private route ${path} redirects anonymous users to /login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}
