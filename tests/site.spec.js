// Smoke tests for danielchesla.com, targeting the data-testid attributes
// added by the add-testids skill.
const { test, expect } = require("@playwright/test");

test.describe("Homepage", () => {
  test("has the correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Daniel Chesla/);
  });

  test("injected navigation shows the key links", async ({ page }) => {
    await page.goto("/");
    // The nav is injected client-side by include-loader.js; getByTestId auto-waits.
    await expect(page.getByTestId("nav-daniel-chesla-home-link-1")).toBeVisible();
    await expect(page.getByTestId("nav-mentoring-training-labs-link-1")).toBeVisible();
    await expect(page.getByTestId("nav-contact-link-1")).toBeVisible();
  });

  test("hero call-to-action links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("view-leadership-impact-link-1")).toBeVisible();
    await expect(page.getByTestId("career-evolution-link-1")).toBeVisible();
  });
});

test.describe("Labs menu", () => {
  test("opens and lists lab experiments", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-mentoring-training-labs-link-1").click();
    await expect(page.getByTestId("nav-genai-experiment-link-1")).toBeVisible();
    await expect(page.getByTestId("nav-claude-iss-tracker-link-1")).toBeVisible();
  });
});

test.describe("Contact page", () => {
  test("renders all form fields", async ({ page }) => {
    await page.goto("/contact.html");
    for (const id of [
      "name-text-1", "email-email-1", "subject-text-1",
      "message-textarea-1", "send-button-1",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test("accepts input into the form", async ({ page }) => {
    await page.goto("/contact.html");
    await page.getByTestId("name-text-1").fill("Playwright Bot");
    await page.getByTestId("email-email-1").fill("bot@example.com");
    await page.getByTestId("message-textarea-1").fill("Hello from CI");
    await expect(page.getByTestId("name-text-1")).toHaveValue("Playwright Bot");
    await expect(page.getByTestId("email-email-1")).toHaveValue("bot@example.com");
  });
});

test.describe("Image generator", () => {
  test("shows the option selects and the generate button", async ({ page }) => {
    await page.goto("/imagegen.html");
    for (const id of [
      "background-select-1", "style-select-1", "mix-select-1",
      "realism-select-1", "generatebtn-button-1",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });
});
