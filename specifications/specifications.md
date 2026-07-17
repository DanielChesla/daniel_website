# Website Specification

## 1. Project Overview

This specification describes a **new page** to be added to Daniel Chesla's existing personal portfolio website (a static HTML/CSS/JS site deployed on Vercel, with select Vercel serverless functions in `/api`). The new page is a **"20 Questions" AI guessing game**: the AI asks the user a series of yes/no questions and attempts to guess what the user is thinking of, similar in spirit to the classic Akinator game.

The page is one of several existing "Mentoring/Training Labs" experiment pages (e.g., `weather.html`, `tides.html`, `loan.html`, `imagegen.html`) that are linked from the site's nav dropdown and serve as demonstrations of practical skills (API integration, automation, AI usage) for mentoring/training purposes. This new page must follow the same conventions as those existing pages: shared header/footer includes, the site's dark visual theme, `data-testid` attributes for Playwright testing, and inclusion of the site's analytics script.

> **Hotfix revision (2026-07-16):** The original design called the serverless function once per single question. It has been revised to a **batched adaptive questioning** architecture (up to five questions requested per AI call, presented one at a time client-side) to reduce the number of calls to the free, keyless upstream API per round and improve resilience to its rate limiting. See the revision notes in Sections 6 and 11 for details. The game remains completely free and keyless — no API key or environment variable was introduced.
>
> **Hotfix revision (2026-07-17):** After the batched architecture above went live, the forced-guess turn at the 20-question cap was failing. Root cause (verified via direct live calls to Pollinations.ai): the underlying reasoning model can consume its entire completion-token budget on hidden chain-of-thought once the prompt carries real history, leaving `message.content` empty. Fixed by adding `reasoning_effort: "low"` to every Pollinations.ai request and making the forced-guess prompt more explicit about the required response shape (see TECH-007c, TECH-010, TEST-012). Still completely free and keyless.

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

### Question Flow (revised 2026-07-16 — batched adaptive questioning hotfix)
> **Revision note:** The original design called the serverless function once per question. Since anonymous/keyless upstream calls can be slow (TECH-008) and this is a low-traffic free-tier integration, the game was changed to request **batches of up to five questions at a time**, reducing the number of AI calls per round from up to 21 to at most 6. FR-003/FR-006/FR-009 below reflect this revised architecture; the user-visible one-question-at-a-time flow, five answer choices, progress bar, and visual design are unchanged.

- **FR-003:** The game is played in **batches of up to five yes/no questions per AI request**, not one AI request per question. At the start of a round, and again every time the client has exhausted the current locally-held batch (checkpoints at 5, 10, and 15 answered questions in the common case), the client requests the next batch (or a guess) from `/api/twenty-questions`. The client then presents the returned questions to the user **one at a time**, purely client-side, with no additional network requests until that batch is exhausted. The round is capped at a maximum of 20 total answered questions (see FR-009a).
- **FR-004:** Each question must be answerable with exactly these five options: **Yes**, **No**, **Don't Know**, **Probably**, **Probably Not** (unchanged).
- **FR-005:** The game must display a progress indicator showing the current question number out of the maximum (e.g., a progress bar plus text like "Question 7 of 20"), updated for every question the user answers — whether it came from a freshly-fetched batch or one already held locally.
- **FR-006:** The AI decides dynamically (via the serverless function/LLM call) whether to return another batch of questions or make a guess, based on the accumulated question/answer history. It is not required to use all 20 questions before guessing — it may guess as soon as it determines it has enough information, at the start of any batch-request checkpoint.
- **FR-006a:** While waiting for the serverless function to return the next batch or guess, the UI must display a "thinking" loading state whose copy communicates that the free upstream service can occasionally be slow (verified: typically a few seconds, but occasionally 20–30 seconds under the keyless anonymous tier — see TECH-008/TECH-008a), e.g., "The AI is thinking… this free service can occasionally take up to 30 seconds." This is a UI-level expectation-setting requirement, not a hard timeout on gameplay.
- **FR-006b (NEW):** Whenever the AI chooses to return questions rather than a guess, the response must contain **exactly `min(5, 20 - questionsAskedSoFar)` new, unique questions** (enforced server-side, see TECH-007/TECH-010). This guarantees that, in the worst case (the AI never guesses early), the round reaches 20 answered questions via **at most four** batch-generation calls.
- **FR-006c (NEW):** While waiting out a rate-limit retry delay (see FR-016), the UI must show a distinct, friendly waiting message (e.g., "The AI service is being rate-limited right now — I'll try again in a few seconds.") in place of the generic "thinking" copy, so the user understands why the wait is longer than usual.

### Guessing
- **FR-007:** When the AI is ready to guess, the game must display the guess (e.g., "Is it a golden retriever?") and ask the user to confirm: "Yes, that's correct!" or "No, that's not it."
- **FR-008:** If the first guess is confirmed correct, the game moves to the **Win** end state (see FR-010).
- **FR-009 (revised 2026-07-16):** If the first guess is confirmed incorrect, the client makes exactly **one final API request**, sending the complete history plus the rejected guess (via `guessesSoFar`). The serverless function must respond directly with the second and final guess on that call — it may no longer ask additional clarifying questions first (this simplifies the original design, which allowed the AI discretion to ask more questions before its final guess). This guarantees at most one additional API call after a rejected first guess, and that call is guaranteed to produce a guess.
- **FR-009a:** If the total question count reaches 20 before the AI has made any guess, the serverless function must force a guess response instead of another batch of questions on that turn.
- **FR-009b:** Because FR-009 now always resolves the round in exactly one further request after a rejected first guess (regardless of the question count at that point), a separate "cap reached after first wrong guess" case is no longer needed — the final-guess call itself is always forced (see TECH-010).

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
- **FR-016 (revised 2026-07-16 — error-aware retry timing):** If a call to `/api/twenty-questions` fails, the client must automatically retry up to 2 additional times (3 total attempts), without requiring user action, using timing that depends on the failure type (distinguished via the `code` field returned by the server — see TECH-007a):
  - For ordinary transient errors (network failures, timeouts, malformed/invalid JSON, generic upstream errors — `code` other than `rate_limited`), use a short **increasing backoff** between attempts (e.g., ~1.5s before the 2nd attempt, ~3s before the 3rd), unchanged from the original design. This avoids immediate back-to-back retries adding to upstream contention (see TECH-008).
  - For HTTP 429 responses (`code: "rate_limited"`), honor the server-provided `retryAfterMs` (derived from the upstream `Retry-After` header — see TECH-007a) before retrying. If the server provides no usable value, wait **approximately 15 seconds** instead. This is intentionally much longer than the generic backoff, since a 429 indicates the free anonymous tier needs a real cool-down rather than a transient blip.
- **FR-017 (revised 2026-07-16):** If all automatic retries fail, display a friendly error message along with a manual "Retry" button that re-issues the same request. If the final failure was due to rate-limiting, the message must say so explicitly (e.g., "The AI service is really busy right now (rate-limited). Please try again in a bit.") rather than the generic message (e.g., "Hmm, having trouble thinking of a question. Please try again."), so the user understands this isn't a bug.

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
- **TECH-006:** The function accepts `POST` requests with a JSON body describing the complete accumulated game state — unchanged shape from the original design, still the sole request payload for every call in the batched architecture:
  ```json
  {
    "history": [
      { "question": "Is it alive?", "answer": "yes" },
      { "question": "Is it a person?", "answer": "no" }
    ],
    "guessesSoFar": ["a golden retriever"]
  }
  ```
  `guessesSoFar.length` governs server behavior: `0` = normal batch-or-first-guess mode; `1` = final-guess mode, where the server must return the second/final guess directly (see FR-009, TECH-010).
- **TECH-007 (revised 2026-07-16 — batched responses):** The function must construct a prompt instructing the LLM to act as a 20-Questions guesser, review the history, and respond with **strict, parseable JSON** in one of these shapes:
  - `{ "type": "questions", "questions": ["Is it man-made?", "Is it bigger than a car?", "..."] }` — an array of **exactly `min(5, 20 - questionsAsked)`** new, unique yes/no questions (replaces the original single-question `{"type":"question","text":...}` shape).
  - `{ "type": "guess", "text": "a golden retriever" }`
  The request to Pollinations.ai must include **`"response_format": { "type": "json_object" }`** (verified supported by Pollinations.ai's `POST https://text.pollinations.ai/openai` endpoint) in addition to prompt-level instructions, to improve the reliability of getting clean, parseable JSON back. The function must validate, deduplicate, and sanitize this JSON server-side (see TECH-010) before returning it to the client, and return a clear error if the LLM output can't be parsed or used, so the client's retry logic (FR-016) can engage.
- **TECH-007a (NEW):** Error responses use a consistent JSON shape: `{ "error": "<human-readable message>", "code": "<bad_request|rate_limited|invalid_response|upstream_error>", "detail"?: "...", "retryAfterMs"?: <number> }`, with an appropriate HTTP status per code (`400` for `bad_request`, `429` for `rate_limited`, `502` for `invalid_response`/`upstream_error`). For `rate_limited` (an upstream HTTP 429 from Pollinations.ai), `retryAfterMs` is derived from the upstream `Retry-After` header when present (parsed as either a numeric seconds value or an HTTP date, clamped to a maximum of 30 seconds), defaulting to `15000` (~15s) when the header is absent or unparseable. This `code`/`retryAfterMs` metadata is non-sensitive and lets the client distinguish rate-limiting from a generic failure and time its retry accordingly (see FR-016).
- **TECH-007b (NEW):** The function must **not** perform an additional internal request to Pollinations.ai when server-side validation, deduplication, or response-shape checks fail on the model's output (e.g., a short/duplicate batch, a repeated guess, unparseable JSON). Doing so would double anonymous-tier upstream traffic per client-visible turn and risk exceeding the function's `maxDuration` budget (TECH-005a/TECH-008). Any such failure is returned immediately to the client as an `invalid_response` error (HTTP 502); the existing client-side automatic retry flow (FR-016) is responsible for re-issuing the identical request.
- **TECH-007c (NEW, hotfix 2026-07-17 — `reasoning_effort: "low"`):** Every request to Pollinations.ai must include `"reasoning_effort": "low"` in the request body, alongside `response_format`. **Verified root cause:** Pollinations' `"openai"` model alias is backed by a reasoning model (`gpt-oss-20b`) that emits its chain-of-thought into a separate `message.reasoning` field before (or instead of) the final answer in `message.content`. Once a prompt includes real conversation history (i.e., any batch/guess request after the first), this model frequently spends its **entire completion-token budget on hidden reasoning** and never emits `message.content` at all — confirmed by direct, repeated live calls to `POST https://text.pollinations.ai/openai` with the game's real prompt shape, which returned a `message` object with a `reasoning` field (1000+ characters) and **no `content` key whatsoever**, despite `finish_reason: "stop"` (not `"length"`, so the API gives no explicit truncation signal). Adding `reasoning_effort: "low"` was verified (3 repeated live trials against the actual production prompt) to reduce reasoning to a small fraction of its previous length and reliably produce a complete, valid `message.content` JSON payload every time. Without this fix, the forced-guess request at the 20-question cap (the point in the round with the longest, most history-heavy prompt) was the single most likely call to trigger a missing-`content` failure, exhausting the client's automatic retries (FR-016) and surfacing the generic "having trouble thinking of a question" error even though nothing was wrong with the batching logic itself.
- **TECH-008:** The function must call **Pollinations.ai's free text API** (no API key required) server-side, using a **server-side upstream timeout of approximately 28 seconds** (via `AbortController`, following the same pattern as `api/astros.js` but extended well beyond that example's 8-second default) to avoid hanging requests indefinitely. This value is based on verified testing: Pollinations.ai's anonymous/keyless tier typically responds in a few seconds, but can occasionally take **20–30 seconds** under its own rate-limit queuing behavior, so an 8–10 second timeout would misfire as a failure on otherwise-successful requests.
- **TECH-009:** The function must set permissive CORS headers (`Access-Control-Allow-Origin: *`, handle `OPTIONS` preflight) matching the existing `api/astros.js` pattern, and must NOT cache responses (each game turn is unique) — no `Cache-Control` header, or explicitly `no-store`.
- **TECH-010 (revised 2026-07-17):** The function must enforce, server-side (not just trust the client or the model):
  - The 20-question cap and forced-guess rule (FR-009a): once `history.length >= 20`, the function must return a guess. If the model does not comply (still returns `"questions"`), that is treated as an `invalid_response` error (TECH-007b) rather than fabricating a guess from question text. The forced-guess prompt must be extremely explicit — restating the exact required JSON shape (`{"type":"guess","text":"the best specific guess"}`) and stating plainly that a `"questions"` response is not valid here — since this is precisely the turn with the longest, most history-heavy prompt and therefore the one most prone to the reasoning-budget issue described in TECH-007c.
  - The final-guess rule (FR-009): once `guessesSoFar.length >= 1`, the function must return a guess, with the same non-compliance handling and equally explicit prompt wording as above.
  - Exact batch sizing (FR-006b): a batch must contain exactly `min(5, 20 - questionsAsked)` new, unique questions after deduplication against the full history and within the batch itself; a short batch after filtering is an `invalid_response` error (no internal retry, per TECH-007b).
  - No repeated guesses: a guess response matching a prior entry in `guessesSoFar` (after case-insensitive/whitespace normalization) is an `invalid_response` error.
  Together these guarantee a round completes in **at most four batch-generation calls, plus one first-guess call, plus one final-guess call if the first is rejected (six calls total)** — not counting the client's own automatic retries of a failed call (FR-016), which retry the same logical turn rather than adding a new one.
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
  - A test that clicks "Start Game" and asserts the first question and answer buttons (Yes/No/Don't Know/Probably/Probably Not) become visible, and the progress indicator shows "Question 1 of 20" (mocking/stubbing the batched API response — `{ "type": "questions", "questions": [...] }` — as needed to keep the test deterministic and avoid real network calls to Pollinations.ai in CI).
- **TEST-008 (NEW, batched adaptive questioning):** A test that stubs a single batch response of 5 questions, answers all 5 locally, and asserts only **one** API call was made until the 5th answer triggers the next request (verifying the batching/local-rendering behavior of FR-003/FR-006b).
- **TEST-009 (NEW):** A test that uses a stateful route stub (reading the posted `history`/`guessesSoFar` from each request) to drive a full round to the 20-question cap, asserting the forced first guess arrives after exactly 5 API calls (4 batches + 1 forced guess — TECH-010), and that rejecting it triggers exactly one further "final guess" call (6 total — FR-009).
- **TEST-010 (NEW, error-aware retry timing):** A test that stubs an HTTP 429 response with a small `retryAfterMs` on the first call and a success on the second, asserting the friendly rate-limit waiting message is shown (FR-006c) and the game proceeds automatically once the retry succeeds (FR-016).
- **TEST-011 (NEW):** A test that stubs persistent HTTP 429 responses and asserts the rate-limit-specific friendly error message (FR-017) and manual "Retry" button are shown once automatic retries are exhausted.
- **TEST-012 (NEW, hotfix 2026-07-17 — `tests/twenty-questions-api.spec.js`):** Focused, offline tests that call the `api/twenty-questions.js` handler directly (mocking `global.fetch` to simulate Pollinations.ai, no browser/page fixture needed) covering: a forced guess correctly returned after 20 answered questions; an upstream response with a **missing `message.content`** field being rejected as `upstream_error` (TECH-007c); the model returning `"questions"` when a guess is mandatory being rejected as `invalid_response` (TECH-010); a valid forced-guess response being accepted and passed through; an empty guess and a repeated/previously-rejected guess both being rejected; and that the outgoing request body includes `reasoning_effort: "low"` alongside `response_format: { type: "json_object" }` (TECH-007c).
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
