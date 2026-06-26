// Group: Contact Page
const { test, expect } = require("@playwright/test");

test.describe("Contact Page", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/contact.html"); });

  test("shows the heading and all form fields", async ({ page }) => {
    await expect(page.getByTestId("contact-h1-1")).toBeVisible();
    for (const id of [
      "name-text-1", "email-email-1", "subject-text-1",
      "message-textarea-1", "send-button-1", "clear-button-1",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test("accepts input into the form", async ({ page }) => {
    await page.getByTestId("name-text-1").fill("Playwright Bot");
    await page.getByTestId("email-email-1").fill("bot@example.com");
    await page.getByTestId("message-textarea-1").fill("Hello from CI");
    await expect(page.getByTestId("name-text-1")).toHaveValue("Playwright Bot");
    await expect(page.getByTestId("email-email-1")).toHaveValue("bot@example.com");
  });

  test("lists alternative contact links", async ({ page }) => {
    await expect(page.getByTestId("github-com-danielchesla-link-1")).toBeVisible();
    await expect(page.getByTestId("connect-on-linkedin-link-1")).toBeVisible();
    await expect(page.getByTestId("download-executive-resume-link-1")).toBeVisible();
  });
});
