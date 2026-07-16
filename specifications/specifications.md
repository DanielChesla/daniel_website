# Website Specification

## 1. Project Overview

This specification describes a **new page** to be added to Daniel Chesla's existing personal portfolio website (a static HTML/CSS/JS site deployed on Vercel, with select Vercel serverless functions in `/api`). The new page is a **"20 Questions" AI guessing game**: the AI asks the user a series of yes/no questions and attempts to guess what the user is thinking of, similar in spirit to the classic Akinator game.

The page is one of several existing "Mentoring/Training Labs" experiment pages (e.g., `weather.html`, `tides.html`, `loan.html`, `imagegen.html`) that are linked from the site's nav dropdown and serve as demonstrations of practical skills (API integration, automation, AI usage) for mentoring/training purposes. This new page must follow the same conventions as those existing pages: shared header/footer includes, the site's dark visual theme, `data-testid` attributes for Playwright testing, and inclusion of the site's analytics script.

**New/modified files expected:**
- `20questions.html` — new page (root of the site, alongside `tides.html`, `weather.html`, etc.)
- `20questions.js` — new client-side script (same pattern as `tides.js`), handling game state, UI rendering, and calls to the serverless function
- `api/twenty-questions.js` — new Vercel serverless function (Node.js runtime) that calls the Pollinations.ai free text API and returns the next question or guess
- `includes/header.html` — add a new nav dropdown item linking to `20questions.html`
- `tests/labs.spec.js` — add a new test entry to the "dropdown lists every lab page" test, plus a new `test.describe("20 Questions", ...)` block
- `style1.css` (or a page-scoped `<style>` block in `20questions.html`, matching the pattern used in `tides.html`) — any new styles needed (progress bar, game card, share button)

## 2. Goals and Success Criteria

- **G-001:** Provide an engaging, replayable AI-powered guessing game as a portfolio/mentoring demonstration.
- **G-002:** Demonstrate practical AI integration skills (prompt engineering, confidence-based decision making, structured LLM output) using a completely free, keyless API — no API keys, no cost to the site owner.
- **G-003:** Maintain full visual and structural consistency with the rest of the site (dark theme, shared nav/footer, Bootstrap 5.3.3, `data-testid` conventions).
- **G-004:** Keep the feature simple to maintain: no database, no authentication, no server-side session storage.

**Success criteria:**
- A user can play a full round of the game (start → up to 20 questions → guess → correct/incorrect resolution → share/play again) without errors on both desktop and mobile.
- The page is reachable from the Mentoring/Training Labs nav dropdown and passes a Playwright smoke test.
- No API keys or paid services are required to run the feature.

## 3. Target Audience

- Visitors to Daniel Chesla's personal/professional portfolio site: recruiters, colleagues, mentees, and other technologists browsing his "Mentoring/Training Labs" projects.
- Casual visitors looking for a fun, quick interactive experience (a few minutes per round).
- No specialized technical knowledge is required to play; the "About This Lab" section is aimed at technically curious visitors wanting to understand how it works.

## 4. User Stories

- **US-001:** As a visitor, I want to start a game of 20 Questions so that I can see if the AI can guess what I'm thinking of.
- **US-002:** As a visitor, I want to answer each question with Yes / No / Don't Know / Probably / Probably Not so that I can respond accurately even when unsure.
- **US-003:** As a visitor, I want to see a progress indicator (e.g., "Question 7 of 20") so that I know how far along the game is.
- **US-004:** As a visitor, when the AI makes a guess, I want to confirm whether it's correct so the game can respond appropriately.
- **US-005:** As a visitor, if the AI's first guess is wrong, I want it to get one more attempt before giving up.
- **US-006:** As a visitor, when the game ends, I want a clear win/lose message and the option to play again immediately.
- **US-007:** As a visitor, I want to share my result via my device's native share sheet (text, social apps, etc.) so I can challenge friends.
- **US-008:** As a visitor, if something goes wrong (API error), I want the game to retry automatically before bothering me with an error.
- **US-009:** As a technically curious visitor, I want to read a short explanation of how the game works under the hood (AI provider, serverless function, prompt engineering, confidence-based guessing) as part of the mentoring/training lab context.

## 5. Pages and Navigation

- **New page:** `20questions.html`
  - **Page title:** "20 Questions · Can AI Guess What You're Thinking?"
  - **Nav placement:** Added as a new item in the existing "Mentoring/Training Labs" dropdown in `includes/header.html`, alongside Weather API, Tides, Loan Calculator, etc. Suggested label: `🎯 20 Questions` (an emoji prefix is consistent with existing entries like `🌊 7-Mile Bridge Tides` and `🎭 Playwright Tests`).
  - Uses the shared `#header-include` / `#footer-include` mechanism via `include-loader.js`, exactly like all other pages.
- No changes to other existing pages' content are required, other than the header nav update.

## 6. Functional Requirements

### Game Setup
- **FR-001:** The page must show a start/intro screen before any game begins, explaining the rules in plain English (e.g., "Think of a person, place, animal, or object — real or fictional. Answer honestly and I'll try to guess it in 20 questions or less!") and a prominent "Start Game" button.
- **FR-002:** The scope of things the AI can guess is unrestricted across: people (real or fictional), places, animals, and objects. The user does not pre-select a category; the AI must narrow this down itself through questioning.

### Question Flow
- **FR-003:** After starting, the game asks one yes/no question at a time, up to a maximum of 20 questions total across the entire round (including both guess attempts' worth of questioning).
- **FR-004:** Each question must be answerable with exactly these five options: **Yes**, **No**, **Don't Know**, **Probably**, **Probably Not**.
- **FR-005:** The game must display a progress indicator showing the current question number out of the maximum (e.g., a progress bar plus text like "Question 7 of 20").
- **FR-006:** The AI decides dynamically (via the serverless function/LLM call) whether to ask another question or make a guess, based on the accumulated question/answer history. It is not required to use all 20 questions before guessing — it may guess as soon as it determines it has enough information.
- **FR-006a:** While waiting for the serverless function to return the next question or guess, the UI must display a "thinking" loading state whose copy communicates that the free upstream service can occasionally be slow (verified: typically a few seconds, but occasionally 20–30 seconds under the keyless anonymous tier — see TECH-008/TECH-008a), e.g., "The AI is thinking… this free service can occasionally take up to 30 seconds." This is a UI-level expectation-setting requirement, not a hard timeout on gameplay.

### Guessing
- **FR-007:** When the AI is ready to guess, the game must display the guess (e.g., "Is it a golden retriever?") and ask the user to confirm: "Yes, that's correct!" or "No, that's not it."
- **FR-008:** If the first guess is confirmed correct, the game moves to the **Win** end state (see FR-010).
- **FR-009:** If the first guess is confirmed incorrect, the AI gets exactly one more attempt. Before making its final guess, the AI may (at its discretion, via the LLM) ask additional yes/no questions to refine its answer, provided the total question count across the round does not exceed 20. It then makes a second and final guess, which the user again confirms as correct or incorrect.
- **FR-009a:** If the total question count reaches 20 before the AI has made any guess, the serverless function must force a guess response instead of another question on that turn.
- **FR-009b:** If the total question count reaches 20 after a first wrong guess but before a second guess, the serverless function must force the second/final guess at that point.

### End States
- **FR-010 (Win):** If either guess is confirmed correct, display a celebratory "I got it! 🎉" message showing the AI's correct answer, along with a "Play Again" button and a "Share Result" button.
- **FR-011 (Loss):** If both guesses are confirmed incorrect, display a lighthearted "You win! I'm stumped 🤔" message, prompt the user to type/reveal what they were actually thinking of (free-text input, display-only — not sent anywhere or validated), and show "Play Again" and "Share Result" buttons.
- **FR-012:** "Play Again" fully resets all client-side game state and returns the user to the start/intro screen (FR-001), ready for a new round.

### Sharing
- **FR-013:** A "Share Result" button must use the Web Share API (`navigator.share`) where supported, allowing the user to share a short text summary directly to their device's native share sheet (messaging apps, social apps, etc.).
- **FR-014:** If the Web Share API is not supported (e.g., most desktop browsers), the button must fall back to copying the same share text to the clipboard and showing a brief confirmation (e.g., "Copied!" — matching the existing pattern used in `imagegen.html`'s "Copy Prompt" button).
- **FR-015:** Share text content should differ based on outcome, for example:
  - Win: "🤖 I played 20 Questions against AI on Daniel Chesla's site — it correctly guessed [answer] in [N] questions! Think you can stump it? [page URL]"
  - Loss: "🤖 I stumped the AI in 20 Questions on Daniel Chesla's site! It couldn't guess what I was thinking of. Can you beat it? [page URL]"

### Error Handling
- **FR-016:** If a call to `/api/twenty-questions` fails or times out, the client must automatically retry up to 2 additional times (3 total attempts), using an **increasing backoff delay** between attempts (e.g., ~1.5s before the 2nd attempt, ~3s before the 3rd) rather than retrying immediately back-to-back, without requiring user action. Backoff (instead of immediate retries) is required because the upstream free-tier API can itself be a source of transient slowness under its anonymous/keyless rate-limit tier (see TECH-008), and immediate repeated retries would only add to that contention.
- **FR-017:** If all automatic retries fail, display a friendly error message (e.g., "Hmm, having trouble thinking of a question. Please try again.") along with a manual "Retry" button that re-issues the same request.

### State Management
- **FR-018:** The game must be entirely client-side/stateless from a server perspective: the browser holds the full question/answer history in memory (a JavaScript array) for the current round and sends the complete relevant history with each request to the serverless function. No server-side session, database, or persistent storage is used.
- **FR-019:** Refreshing or navigating away from the page discards all game state. There is no save/resume feature.
- **FR-020:** No gameplay data (questions, answers, guesses, outcomes) is logged, stored, or transmitted anywhere beyond the single in-flight API request/response needed to get the next question or guess. Standard site-wide analytics (`/analytics.js`, Vercel Analytics) may record page views/navigation events only, consistent with all other pages — it must not be used to log gameplay content.

## 7. Content Requirements

- **C-001:** Intro/start screen copy explaining the rules in a friendly, casual tone (see FR-001 example).
- **C-002:** An "About This Lab" section/card (positioned below the game or in a sidebar, similar to the "About this data" card on `tides.html`) explaining:
  - The game is powered by **Pollinations.ai's free, keyless text API** — no API keys, no account, and no cost, the same provider used by the site's "GenAI Experiment" (`imagegen.html`) image generator. The underlying text model should be described as **Pollinations.ai's own hosted free text model** (the API's `model: "openai"` parameter value is Pollinations' internal alias for its hosted model, verified to not be an official OpenAI product/model — copy must not claim this is powered by "OpenAI" directly).
  - Each turn calls a **Vercel serverless function** that sends the game's question/answer history to the AI and asks it to decide the next best yes/no question — or to make a guess — demonstrating basic **prompt engineering**.
  - The AI uses **confidence-based reasoning** to decide when it has enough information to guess rather than asking all 20 questions every time.
  - Framing this as part of Daniel's "Mentoring/Training Labs" series demonstrating practical AI integration techniques.
- **C-003:** In-game copy for question display, answer buttons, guess confirmation prompts, win/loss messages, and share button labels, all in a friendly, lighthearted tone consistent with a casual game (not corporate/formal copy).
- **C-004:** Meta tags for SEO (see UI-009 / Section 11) describing the page for search engines and social sharing previews.

## 8. Visual Design

- **UI-001:** The page must match the site's existing **dark theme**: navy/near-black gradient background (`--bg`, `--bg-soft` from `style1.css`), light-blue accent color (`--accent` / `--accent-strong`), Inter font family, and the same rounded-corner "glass" card style used elsewhere (`.premium-card`, `.metric-card` styling conventions).
- **UI-002:** Reuse existing Bootstrap 5.3.3 + `style1.css` utility classes and components wherever possible (`.btn-accent`, `.btn-ghost`, `.section-kicker`, `.section-title`, `.premium-card`, container/row/col grid) rather than introducing a new design language.
- **UI-003:** A page-scoped `<style>` block (matching the pattern in `tides.html`) may be added for game-specific elements not already covered by `style1.css`: the progress bar, the question card, answer button group, and share button.
- **UI-004:** The progress bar should use Bootstrap's `.progress` / `.progress-bar` components, styled with the accent color, and paired with text like "Question 7 of 20".
- **UI-005:** Answer buttons (Yes / No / Don't Know / Probably / Probably Not) should be large, clearly distinguishable, and arranged in an easily tappable row/grid (works well on both mobile and desktop).
- **UI-006:** All interactive and content elements must include `data-testid` attributes following the site's existing naming convention (see `header.html`, `tides.html`, etc.), to support Playwright testing.
- **UI-007:** The nav dropdown entry should include an emoji prefix consistent with existing entries (suggested: `🎯 20 Questions`).

## 9. Responsive Behavior

- **RESP-001:** The page must be fully usable on mobile viewports (≥320px width) and desktop, matching the responsive behavior of the rest of the site (Bootstrap grid breakpoints already in use).
- **RESP-002:** Answer buttons must stack or wrap appropriately on narrow screens rather than overflowing or becoming unreadable.
- **RESP-003:** The progress bar and question card must remain legible and appropriately sized across breakpoints.
- **RESP-004:** The Web Share API button (FR-013) is expected to be most relevant on mobile devices where native share sheets are commonly supported; the clipboard fallback (FR-014) ensures desktop users still get equivalent functionality.

## 10. Accessibility Requirements

- **ACC-001:** All game state changes (new question, guess, win/loss message) that update dynamically must be announced to assistive technology using an ARIA live region (e.g., `aria-live="polite"` on the question/result container).
- **ACC-002:** All buttons (answer options, Start Game, Play Again, Share Result, Retry) must be fully keyboard-operable and have visible focus states.
- **ACC-003:** Color contrast for text and interactive elements must meet WCAG AA against the dark background, consistent with the rest of the site's existing palette.
- **ACC-004:** The progress bar must include appropriate ARIA attributes (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`) reflecting current question count.
- **ACC-005:** Images/icons/emoji used decoratively (e.g., 🎯, 🎉, 🤔) must not be the sole means of conveying information — always paired with text.

## 11. Technical Requirements

### Front End
- **TECH-001:** Plain HTML/CSS/JavaScript, no build step, consistent with the rest of the site (`package.json` build script is a no-op; this is a static site).
- **TECH-002:** Bootstrap 5.3.3 (via existing CDN links) and `style1.css` reused as-is; Google Fonts `Inter` already loaded site-wide.
- **TECH-003:** Game logic lives in a new `20questions.js` file (loaded via `<script src="20questions.js">`), following the separation-of-concerns pattern used by `tides.js`.
- **TECH-004:** The page must include `<script src="include-loader.js"></script>` and `<script type="module" src="/analytics.js"></script>` exactly as all other pages do.

### Back End (Serverless Function)
- **TECH-005:** A new Vercel serverless function at `api/twenty-questions.js`, using `export const config = { runtime: "nodejs" };` (same convention as `api/astros.js`).
- **TECH-005a:** The function's `config` export must additionally set a **30-second maximum execution duration** (e.g., `maxDuration: 30`) **if supported by the deployment platform/plan**, so the platform does not terminate the request before the upstream timeout in TECH-008 can complete. If the platform does not support overriding this on the current plan, this is a known limitation to flag during implementation rather than a blocker (no new `vercel.json`/`vercel.ts` file is required solely for this — prefer the per-function `config` export if it achieves the same result).
- **TECH-006:** The function accepts `POST` requests with a JSON body describing the current game state, for example:
  ```json
  {
    "history": [
      { "question": "Is it alive?", "answer": "yes" },
      { "question": "Is it a person?", "answer": "no" }
    ],
    "guessesSoFar": ["a golden retriever"]
  }
  ```
- **TECH-007:** The function must construct a prompt instructing the LLM to act as a 20-Questions guesser, review the history, and respond with **strict, parseable JSON** in one of these shapes:
  - `{ "type": "question", "text": "Is it man-made?" }`
  - `{ "type": "guess", "text": "a golden retriever" }`
  The request to Pollinations.ai must include **`"response_format": { "type": "json_object" }`** (verified supported by Pollinations.ai's `POST https://text.pollinations.ai/openai` endpoint) in addition to prompt-level instructions, to improve the reliability of getting clean, parseable JSON back. The function must still validate/parse this JSON server-side before returning it to the client, and return a clear error (HTTP 502) if the LLM output can't be parsed, so the client's retry logic (FR-016) can engage.
- **TECH-008:** The function must call **Pollinations.ai's free text API** (no API key required) server-side, using a **server-side upstream timeout of approximately 28 seconds** (via `AbortController`, following the same pattern as `api/astros.js` but extended well beyond that example's 8-second default) to avoid hanging requests indefinitely. This value is based on verified testing: Pollinations.ai's anonymous/keyless tier typically responds in a few seconds, but can occasionally take **20–30 seconds** under its own rate-limit queuing behavior, so an 8–10 second timeout would misfire as a failure on otherwise-successful requests.
- **TECH-009:** The function must set permissive CORS headers (`Access-Control-Allow-Origin: *`, handle `OPTIONS` preflight) matching the existing `api/astros.js` pattern, and must NOT cache responses (each game turn is unique) — no `Cache-Control` header, or explicitly `no-store`.
- **TECH-010:** The function must enforce the 20-question cap and forced-guess rules (FR-009a, FR-009b) server-side (not just trust the client), by including the current question count in the prompt/logic and overriding the AI's response type to `"guess"` once the cap is reached.
- **TECH-011:** No environment variables, API keys, or secrets are required for this feature. **Verified:** `POST https://text.pollinations.ai/openai` was directly tested with no `Authorization` header and no `referrer` parameter, and returned successful `200` responses with `"user_tier": "anonymous"` — confirming keyless/anonymous access currently works as assumed. Registering for a free Pollinations account (their "Seed" tier) is optional and not required by this feature.

### Data & Privacy
- **TECH-012:** No database, no cookies (beyond whatever the existing sitewide analytics already sets), and no server-side persistence of any kind for this feature.
- **TECH-013:** Game history sent to the Pollinations.ai API contains only the user's yes/no answers and AI-generated question/guess text — no personally identifiable information is collected or transmitted.

## 12. Integrations

- **INT-001:** **Pollinations.ai free text API** — sole third-party integration, called server-side from `api/twenty-questions.js`. No API key required (keyless, same as the existing image generation feature on `imagegen.html`). **Verified 2026-07-16:** anonymous/keyless access to `POST https://text.pollinations.ai/openai` works today; typical response time is a few seconds, but anonymous-tier requests may occasionally take 20–30 seconds (see TECH-008/TECH-008a). The text model should be described as Pollinations.ai's own hosted free model, not as an official OpenAI model (see C-002).
- **INT-002:** **Vercel Analytics** (`@vercel/analytics`, already a project dependency) — loaded via the existing `/analytics.js` module script for standard page-view tracking, unchanged from other pages.
- No other integrations (no email, no payment, no external auth) are involved.

## 13. Testing and Acceptance Criteria

- **TEST-001:** Add `nav-20-questions-link-1` (or equivalent `data-testid`) to the nav dropdown item list checked in the existing `tests/labs.spec.js` test `"dropdown opens and lists every lab page"`.
- **TEST-002:** Add a new `test.describe("20 Questions", ...)` block to `tests/labs.spec.js` with at minimum:
  - A test that navigates to `/20questions.html` and asserts the page heading and "Start Game" button are visible.
  - A test that clicks "Start Game" and asserts the first question and answer buttons (Yes/No/Don't Know/Probably/Probably Not) become visible, and the progress indicator shows "Question 1 of 20" (mocking or stubbing the API response as needed to keep the test deterministic and avoid real network calls to Pollinations.ai in CI).
- **TEST-003:** Manual acceptance test: play a full round to a correct guess on the first attempt — verify Win state, share button, and Play Again reset works.
- **TEST-004:** Manual acceptance test: play a full round where both guesses are wrong — verify Loss state, reveal input, share button, and Play Again reset works.
- **TEST-005:** Manual acceptance test: simulate an API failure (e.g., via dev tools network throttling/blocking) — verify 2 automatic retries occur, then the manual error/Retry UI appears and successfully recovers when the network is restored.
- **TEST-006:** Manual acceptance test: verify the page renders and is fully playable on a mobile viewport (e.g., 375px width) and a standard desktop viewport.
- **TEST-007:** Acceptance criteria: all functional requirements in Section 6 are implemented and demonstrably working; the page passes the automated Playwright suite (`npm test`) alongside all existing tests.

## 14. Deployment Requirements

- **DEPLOY-001:** This is a static site with select Vercel serverless functions, currently deployed via Vercel (per existing `api/` folder conventions) and/or GitHub Pages for static assets. The new page and serverless function must follow the exact same deployment path as the existing `api/astros.js`, `api/run-tests.js`, and `api/test-status.js` functions — no environment variables and no new `vercel.ts`/`vercel.json` files are anticipated. The one exception is the per-function `maxDuration` setting described in TECH-005a, which is set within `api/twenty-questions.js`'s own `config` export (consistent with how `runtime` is already configured per-function) rather than via a new project-level config file.
- **DEPLOY-002:** No new npm dependencies are required (Pollinations.ai is called via plain `fetch`, no SDK needed).
- **DEPLOY-003:** Changes should be committed to the `main` branch following the existing commit-message conventions seen in the project's git history.

## 15. Out of Scope

- **OUT-001:** User accounts, authentication, or login of any kind.
- **OUT-002:** Persistent storage of games, statistics, leaderboards, or historical results (server-side or database-backed).
- **OUT-003:** Category pre-selection by the user (the AI must always determine category via questioning).
- **OUT-004:** Support for more than 2 total guess attempts per round.
- **OUT-005:** Any paid or API-key-based LLM provider (OpenAI, Anthropic, Gemini, Groq, OpenRouter, etc.) — Pollinations.ai keyless text API only, per explicit decision.
- **OUT-006:** Multiplayer or real-time collaborative play.
- **OUT-007:** Displaying a numeric confidence score to the end user during gameplay (confidence-based reasoning is explained conceptually in the "About This Lab" copy only, not surfaced as a live UI metric).
- **OUT-008:** Localization/translation — English only, consistent with the rest of the site.
- **OUT-009:** Rate limiting or abuse protection beyond what Vercel provides by default (not required since the API is free and this is a low-traffic personal site).

## 16. Open Questions

- **OQ-001:** Exact wording/tone for the win/loss messages, question prompts, and "About This Lab" copy has not been finalized — draft copy is provided in Sections 6–7 as a starting point, but final copy may be refined during implementation/review.
- **OQ-002 (RESOLVED 2026-07-16):** Confirmed against the official Pollinations.ai API docs (`pollinations/pollinations` repo `APIDOCS.md`) and via direct live request testing: `POST https://text.pollinations.ai/openai` (the OpenAI-compatible chat-completions-style endpoint) is the correct, currently-supported, keyless endpoint to use, and supports `"response_format": { "type": "json_object" }`. Verified behavior/timing details are captured in TECH-007, TECH-008, TECH-008a, TECH-011, and INT-001.
- **OQ-003:** Whether the nav emoji/label (`🎯 20 Questions`) is acceptable, or whether the site owner prefers different wording, is not yet confirmed.
- **OQ-004:** No specific browser support matrix was requested beyond the site's existing implicit baseline (modern evergreen browsers: Chrome, Edge, Safari, Firefox); Playwright CI currently only tests Chromium, consistent with the rest of the site.
