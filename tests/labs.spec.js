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
      // makes a real network call to Pollinations.ai in CI. The server now
      // returns a batch of up to five questions per request.
      await page.route("**/api/twenty-questions", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ type: "questions", questions: ["Is it alive?"] }),
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

    test("answers a full batch of 4 questions locally with only one API call", async ({ page }) => {
      var calls = 0;
      await page.route("**/api/twenty-questions", async (route) => {
        calls++;
        if (calls === 1) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              type: "questions",
              questions: ["Q1?", "Q2?", "Q3?", "Q4?"],
            }),
          });
          return;
        }
        // Second call (after the batch of 4 is exhausted) -> a guess.
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ type: "guess", text: "a mystery object" }),
        });
      });

      await page.goto("/20questions.html");
      await page.getByTestId("start-game-button-1").click();

      for (let i = 1; i <= 3; i++) {
        await expect(page.getByTestId("question-text-1")).toHaveText("Q" + i + "?");
        await expect(page.getByTestId("progress-text-1")).toHaveText("Question " + i + " of 20");
        await page.getByTestId("answer-yes-button-1").click();
      }

      // Questions 1-3 were all answered locally off the single batch fetch
      // from Start Game — no additional API call yet.
      await expect(page.getByTestId("question-text-1")).toHaveText("Q4?");
      expect(calls).toBe(1);

      // Answering the 4th (final) question in the batch exhausts it and
      // triggers exactly one more API call, which returns the guess.
      await page.getByTestId("answer-yes-button-1").click();
      await expect(page.getByTestId("guess-text-span-1")).toHaveText("a mystery object");
      expect(calls).toBe(2);
    });

    test("forces a guess after 20 questions (5 batches of 4), then makes exactly one final guess if rejected", async ({ page }) => {
      var calls = 0;
      await page.route("**/api/twenty-questions", async (route) => {
        calls++;
        const body = route.request().postDataJSON();
        const askedSoFar = (body.history || []).length;
        const guesses = body.guessesSoFar || [];

        if (guesses.length >= 1) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ type: "guess", text: "the final guess" }),
          });
          return;
        }
        if (askedSoFar >= 20) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ type: "guess", text: "the first guess" }),
          });
          return;
        }
        // Never confident enough to guess early (even from question 8
        // onward) — always returns another batch, so this test deliberately
        // exercises the full worst-case 5-batch + forced-guess call count.
        const remaining = Math.min(4, 20 - askedSoFar);
        const questions = Array.from({ length: remaining }, (_, i) => "Question #" + (askedSoFar + i + 1) + "?");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ type: "questions", questions }),
        });
      });

      await page.goto("/20questions.html");
      await page.getByTestId("start-game-button-1").click();

      for (let i = 0; i < 20; i++) {
        await expect(page.getByTestId("question-text-1")).toBeVisible();
        await page.getByTestId("answer-yes-button-1").click();
      }

      await expect(page.getByTestId("guess-text-span-1")).toHaveText("the first guess");
      // 5 batch-generation calls (checkpoints at 0/4/8/12/16) + 1 forced first-guess call.
      expect(calls).toBe(6);

      await page.getByTestId("guess-incorrect-button-1").click();
      await expect(page.getByTestId("guess-text-span-1")).toHaveText("the final guess");
      // + exactly 1 final-guess call = 7 total (the documented maximum, excluding retries).
      expect(calls).toBe(7);

      await page.getByTestId("guess-correct-button-1").click();
      await expect(page.getByTestId("win-div-1")).toBeVisible();
    });

    test("shows a friendly rate-limit message and retries using the server's retry-after hint", async ({ page }) => {
      var calls = 0;
      await page.route("**/api/twenty-questions", async (route) => {
        calls++;
        if (calls === 1) {
          await route.fulfill({
            status: 429,
            contentType: "application/json",
            body: JSON.stringify({ error: "rate limited", code: "rate_limited", retryAfterMs: 300 }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ type: "questions", questions: ["Is it alive?"] }),
        });
      });

      await page.goto("/20questions.html");
      await page.getByTestId("start-game-button-1").click();

      await expect(page.getByTestId("thinking-text-1")).toContainText("rate-limited");
      await expect(page.getByTestId("question-text-1")).toHaveText("Is it alive?");
      expect(calls).toBe(2);
    });

    test("shows a rate-limit-specific error message after exhausting retries", async ({ page }) => {
      await page.route("**/api/twenty-questions", async (route) => {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ error: "rate limited", code: "rate_limited", retryAfterMs: 50 }),
        });
      });

      await page.goto("/20questions.html");
      await page.getByTestId("start-game-button-1").click();

      await expect(page.getByTestId("error-message-1")).toContainText("busy", { timeout: 15000 });
      await expect(page.getByTestId("retry-button-1")).toBeVisible();
    });

    test("persistent early-guess non-compliance (invalid_response) exhausts retries and shows the manual Retry UI, without looping forever", async ({ page }) => {
      // Simulates the server persistently rejecting a non-compliant early
      // guess (e.g. medium/low/missing confidence) as invalid_response on
      // every attempt. The client's bounded retry flow (FR-016, 3 total
      // attempts) must terminate normally at the generic error/Retry view —
      // never hang or retry indefinitely.
      var calls = 0;
      await page.route("**/api/twenty-questions", async (route) => {
        calls++;
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({
            error: "The AI's response could not be used.",
            code: "invalid_response",
            detail: "model attempted an early guess without declaring high confidence (confidence=medium)",
          }),
        });
      });

      await page.goto("/20questions.html");
      await page.getByTestId("start-game-button-1").click();

      await expect(page.getByTestId("error-message-1")).toContainText("having trouble", { timeout: 15000 });
      await expect(page.getByTestId("retry-button-1")).toBeVisible();
      // Exactly 3 total attempts (1 initial + 2 retries) — proves the loop
      // terminates rather than retrying forever.
      expect(calls).toBe(3);
    });
  });
});
