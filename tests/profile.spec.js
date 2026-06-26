// Group: Profile Page (the homepage)
const { test, expect } = require("@playwright/test");

test.describe("Profile Page", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("has the correct page title", async ({ page }) => {
    await expect(page).toHaveTitle(/Daniel Chesla/);
  });

  test("shows the main heading", async ({ page }) => {
    // role-based so it survives hero copy edits
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("injected navigation shows the key links", async ({ page }) => {
    await expect(page.getByTestId("nav-daniel-chesla-home-link-1")).toBeVisible();
    await expect(page.getByTestId("nav-mentoring-training-labs-link-1")).toBeVisible();
    await expect(page.getByTestId("nav-contact-link-1")).toBeVisible();
  });

  test("hero call-to-action links are present", async ({ page }) => {
    await expect(page.getByTestId("view-leadership-impact-link-1")).toBeVisible();
    await expect(page.getByTestId("career-evolution-link-1")).toBeVisible();
  });
});
