// Group: Mentoring/Training Labs — with a subsection per lab page.
const { test, expect } = require("@playwright/test");

test.describe("Mentoring/Training Labs", () => {
  test("dropdown opens and lists every lab page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-mentoring-training-labs-link-1").click();
    for (const id of [
      "nav-genai-experiment-link-1", "nav-weather-api-link-1", "nav-loan-calculator-link-1",
      "nav-401k-calculator-link-1", "nav-compound-interest-link-1", "nav-math-project-link-1",
      "nav-tictactoe-link-1", "nav-photos-link-1", "nav-playwright-tests-link-1",
      "nav-20-questions-link-1",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test.describe("GenAI Experiment", () => {
    test("loads with options and the generate button", async ({ page }) => {
      await page.goto("/imagegen.html");
      await expect(page.getByTestId("image-generator-h1-1")).toBeVisible();
      for (const id of ["background-select-1", "style-select-1", "mix-select-1", "realism-select-1", "generatebtn-button-1"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });
  });

  test.describe("Weather API", () => {
    test("loads with the zip input and search button", async ({ page }) => {
      await page.goto("/weather.html");
      await expect(page.getByTestId("weather-h1-1")).toBeVisible();
      await expect(page.getByTestId("zip-code-text-1")).toBeVisible();
      await expect(page.getByTestId("get-weather-button-1")).toBeVisible();
    });
  });

  test.describe("Loan Calculator", () => {
    test("loads with inputs and the calculate button", async ({ page }) => {
      await page.goto("/loan.html");
      await expect(page.getByTestId("loan-amortization-calculator-h1-1")).toBeVisible();
      for (const id of ["sale-price-number-1", "annual-interest-rate-number-1", "loan-term-years-number-1", "calculate-button-1"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });
  });

  test.describe("401k Calculator", () => {
    test("loads with inputs and the calculate button", async ({ page }) => {
      await page.goto("/401k.html");
      await expect(page.getByTestId("401k-calculator-h1-1")).toBeVisible();
      for (const id of ["salary-number-1", "currentage-number-1", "retireage-number-1", "calculate-button-1"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });
  });

  test.describe("Compound Interest", () => {
    test("loads with inputs and the calculate button", async ({ page }) => {
      await page.goto("/compound.html");
      await expect(page.getByTestId("compound-interest-calculator-h1-1")).toBeVisible();
      for (const id of ["principal-number-1", "rate-number-1", "years-number-1", "calculate-button-1"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });

    test("calculates and reveals the results", async ({ page }) => {
      await page.goto("/compound.html");
      await page.getByTestId("principal-number-1").fill("1000");
      await page.getByTestId("rate-number-1").fill("5");
      await page.getByTestId("years-number-1").fill("10");
      await page.getByTestId("calculate-button-1").click();
      // Results start hidden (display:none) and appear after calculating.
      await expect(page.getByTestId("results-div-1")).toBeVisible();
      await expect(page.getByTestId("future-value-div-1")).toBeVisible();
    });
  });

  test.describe("Math Project", () => {
    test("loads with number inputs and the calculate button", async ({ page }) => {
      await page.goto("/Mathpage.html");
      await expect(page.getByTestId("basic-statistics-calculator-h1-1")).toBeVisible();
      for (const id of ["first-number-number-1", "second-number-number-1", "third-number-number-1", "calcbutton-button-1"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
    });
  });

  test.describe("TicTacToe", () => {
    test("loads with the board and reset controls", async ({ page }) => {
      await page.goto("/TicTacToe.html");
      await expect(page.getByTestId("tictactoe-h1-1")).toBeVisible();
      await expect(page.getByTestId("reset-game-button-1")).toBeVisible();
      await expect(page.getByTestId("reset-scores-button-1")).toBeVisible();
    });
  });

  test.describe("Photos", () => {
    test("loads with the gallery heading", async ({ page }) => {
      await page.goto("/photos.html");
      await expect(page.getByTestId("photos-h1-1")).toBeVisible();
    });
  });

  test.describe("20 Questions", () => {
    test("loads with the heading and Start Game button", async ({ page }) => {
      await page.goto("/20questions.html");
      await expect(page.getByTestId("twenty-questions-h1-1")).toBeVisible();
      await expect(page.getByTestId("start-game-button-1")).toBeVisible();
    });

    test("starting the game shows the first question, answer buttons, and progress", async ({ page }) => {
      // Stub the serverless function so this test is deterministic and never
      // makes a real network call to Pollinations.ai in CI.
      await page.route("**/api/twenty-questions", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ type: "question", text: "Is it alive?" }),
        });
      });

      await page.goto("/20questions.html");
      await page.getByTestId("start-game-button-1").click();

      await expect(page.getByTestId("question-text-1")).toHaveText("Is it alive?");
      for (const id of [
        "answer-yes-button-1", "answer-no-button-1", "answer-dontknow-button-1",
        "answer-probably-button-1", "answer-probablynot-button-1",
      ]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      await expect(page.getByTestId("progress-text-1")).toHaveText("Question 1 of 20");
    });
  });
});
