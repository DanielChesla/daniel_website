// 20questions.js
// Client-side game logic for the "20 Questions" AI guessing game.
// Holds the full round state in memory (no server-side session, no
// persistence — see specifications/specifications.md FR-018/FR-019/FR-020)
// and talks to /api/twenty-questions for each turn.
//
// Batched adaptive questioning (hotfix 2026-07-16, revised 2026-07-17 —
// 5 batches of 4): the server returns up to four questions per request ("a
// batch"). The client renders them one at a time locally (no extra network
// calls) and only calls the API again once the local batch is exhausted, at
// most every 4 answered questions (checkpoints 0/4/8/12/16), up to the
// 20-question cap. The client itself is batch-size-agnostic — it simply
// renders whatever-length array the server returns — so this file needed no
// logic changes for the 5x4 batching revision, only this comment update.
// See specifications/specifications.md FR-003/FR-006b/FR-006d/FR-006e.

(function () {
  "use strict";

  var API_URL = "/api/twenty-questions";
  var MAX_QUESTIONS = 20;
  var MAX_TOTAL_ATTEMPTS = 3; // FR-016: 3 total attempts (1 initial + 2 retries)
  var RETRY_BACKOFF_MS = [1500, 3000]; // increasing backoff for ordinary transient errors
  var RATE_LIMIT_DEFAULT_MS = 15000; // ~15s when the server gives no retry-after hint
  var RATE_LIMIT_MAX_WAIT_MS = 30000; // defensive clamp against an unreasonable server value

  var DEFAULT_THINKING_TEXT = "The AI is thinking… this free service can occasionally take up to 30 seconds.";
  var RATE_LIMIT_WAIT_TEXT = "The AI service is being rate-limited right now — I'll try again in a few seconds.";
  var RATE_LIMIT_ERROR_TEXT = "The AI service is really busy right now (rate-limited). Please try again in a bit.";
  var GENERIC_ERROR_TEXT = "Hmm, having trouble thinking of a question. Please try again.";

  // ---- Game state (client-side only) ----
  var history = [];          // [{ question, answer }]
  var guessesSoFar = [];      // [ "a golden retriever", ... ]
  var pendingBatch = [];      // questions from the latest batch not yet shown
  var currentQuestionText = null;
  var currentGuessText = null;
  var lastOutcomeWon = null;  // true = win, false = loss (for Share Result copy)

  function $(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------------
  // View management — only one state view is visible at a time inside the
  // aria-live region, so screen readers announce each change (ACC-001).
  // ---------------------------------------------------------------------
  var STATE_VIEWS = ["thinking-view", "question-view", "guess-view", "win-view", "loss-view", "error-view"];

  function hideAllViews() {
    STATE_VIEWS.forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add("d-none");
    });
    var endActions = $("end-actions");
    if (endActions) endActions.classList.add("d-none");
  }

  function showIntro() {
    $("intro-screen").classList.remove("d-none");
    $("game-section").classList.add("d-none");
  }

  function showGameSection() {
    $("intro-screen").classList.add("d-none");
    $("game-section").classList.remove("d-none");
  }

  function showThinking(message) {
    showGameSection();
    hideAllViews();
    var textEl = $("thinking-text");
    if (textEl) textEl.textContent = message || DEFAULT_THINKING_TEXT;
    $("thinking-view").classList.remove("d-none");
  }

  function showRateLimitedWait() {
    showThinking(RATE_LIMIT_WAIT_TEXT);
  }

  function showQuestion() {
    hideAllViews();
    $("question-view").classList.remove("d-none");
  }

  function showGuessConfirm() {
    hideAllViews();
    $("guess-view").classList.remove("d-none");
  }

  function showWin() {
    hideAllViews();
    $("win-view").classList.remove("d-none");
    $("end-actions").classList.remove("d-none");
    lastOutcomeWon = true;
  }

  function showLoss() {
    hideAllViews();
    $("loss-view").classList.remove("d-none");
    $("end-actions").classList.remove("d-none");
    lastOutcomeWon = false;
  }

  function showErrorView(message) {
    hideAllViews();
    if (message) $("error-message").textContent = message;
    $("error-view").classList.remove("d-none");
  }

  // ---------------------------------------------------------------------
  // Progress bar / text (UI-004, ACC-004)
  // ---------------------------------------------------------------------
  function updateProgress(questionNumber) {
    var clamped = Math.max(1, Math.min(questionNumber, MAX_QUESTIONS));
    $("progress-text").textContent = "Question " + clamped + " of " + MAX_QUESTIONS;
    var outer = $("progress-bar-outer");
    var inner = $("progress-bar-inner");
    var valueNow = Math.min(history.length, MAX_QUESTIONS);
    outer.setAttribute("aria-valuenow", String(valueNow));
    inner.style.width = Math.round((valueNow / MAX_QUESTIONS) * 100) + "%";
  }

  // ---------------------------------------------------------------------
  // API calls with error-aware automatic retry (FR-016/FR-017):
  //  - ordinary transient errors -> short increasing backoff
  //  - HTTP 429 (rate_limited) -> honor server-provided retryAfterMs, or
  //    ~15s default, with a distinct friendly waiting message
  // ---------------------------------------------------------------------
  function postToApi() {
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: history, guessesSoFar: guessesSoFar }),
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ("HTTP " + res.status));
          err.code = data && data.code;
          err.retryAfterMs = data && data.retryAfterMs;
          throw err;
        }
        var validQuestions = data && data.type === "questions" && Array.isArray(data.questions) && data.questions.length > 0;
        var validGuess = data && data.type === "guess" && typeof data.text === "string" && data.text.length > 0;
        if (!validQuestions && !validGuess) {
          throw new Error("malformed response from server");
        }
        return data;
      });
    });
  }

  function normalizeRetryAfter(ms) {
    var n = Number(ms);
    if (!isFinite(n) || n <= 0) return RATE_LIMIT_DEFAULT_MS;
    return Math.min(n, RATE_LIMIT_MAX_WAIT_MS);
  }

  function requestNextTurn(attempt) {
    attempt = attempt || 0;
    showThinking();
    postToApi()
      .then(handleReply)
      .catch(function (err) {
        var isRateLimited = err && err.code === "rate_limited";
        if (attempt < MAX_TOTAL_ATTEMPTS - 1) {
          if (isRateLimited) {
            var waitMs = normalizeRetryAfter(err.retryAfterMs);
            showRateLimitedWait();
            setTimeout(function () { requestNextTurn(attempt + 1); }, waitMs);
          } else {
            var delay = RETRY_BACKOFF_MS[attempt] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
            setTimeout(function () { requestNextTurn(attempt + 1); }, delay);
          }
        } else {
          showErrorView(isRateLimited ? RATE_LIMIT_ERROR_TEXT : GENERIC_ERROR_TEXT);
        }
      });
  }

  function handleReply(reply) {
    if (reply.type === "questions") {
      pendingBatch = reply.questions.slice();
      showNextQuestionFromBatch();
    } else {
      currentGuessText = reply.text;
      $("guess-text-span").textContent = currentGuessText;
      showGuessConfirm();
    }
  }

  // ---------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------
  function showNextQuestionFromBatch() {
    currentQuestionText = pendingBatch.shift();
    updateProgress(history.length + 1);
    $("question-text").textContent = currentQuestionText;
    showQuestion();
  }

  function startGame() {
    history = [];
    guessesSoFar = [];
    pendingBatch = [];
    currentQuestionText = null;
    currentGuessText = null;
    lastOutcomeWon = null;
    requestNextTurn();
  }

  function answerQuestion(value) {
    if (!currentQuestionText) return;
    history.push({ question: currentQuestionText, answer: value });
    currentQuestionText = null;
    if (pendingBatch.length > 0 && history.length < MAX_QUESTIONS) {
      // Still questions left in the locally-held batch — no network call.
      showNextQuestionFromBatch();
    } else {
      pendingBatch = [];
      requestNextTurn();
    }
  }

  function confirmGuess(wasCorrect) {
    if (wasCorrect) {
      $("win-answer").textContent = currentGuessText;
      $("win-count").textContent = String(history.length);
      showWin();
      return;
    }
    guessesSoFar.push(currentGuessText);
    currentGuessText = null;
    if (guessesSoFar.length >= 2) {
      showLoss();
    } else {
      // One final API request with the complete history + rejected guess —
      // the server responds directly with the second/final guess.
      requestNextTurn();
    }
  }

  function retryLastRequest() {
    requestNextTurn();
  }

  function playAgain() {
    var revealInput = $("reveal-input-1");
    if (revealInput) revealInput.value = "";
    var copiedSpan = $("share-copied");
    if (copiedSpan) copiedSpan.classList.add("d-none");
    showIntro();
  }

  // ---------------------------------------------------------------------
  // Share Result (FR-013/014/015)
  // ---------------------------------------------------------------------
  function buildShareText() {
    var url = window.location.href;
    if (lastOutcomeWon) {
      return "🤖 I played 20 Questions against AI on Daniel Chesla's site — it correctly guessed " +
        currentGuessText + " in " + history.length + " questions! Think you can stump it? " + url;
    }
    return "🤖 I stumped the AI in 20 Questions on Daniel Chesla's site! It couldn't guess what I was thinking of. Can you beat it? " + url;
  }

  function shareResult() {
    var text = buildShareText();
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () { /* user cancelled or unsupported — ignore */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        var copiedSpan = $("share-copied");
        if (!copiedSpan) return;
        copiedSpan.classList.remove("d-none");
        setTimeout(function () { copiedSpan.classList.add("d-none"); }, 1500);
      });
    }
  }

  // ---------------------------------------------------------------------
  // Wire up events
  // ---------------------------------------------------------------------
  function init() {
    $("start-game-button").addEventListener("click", startGame);

    document.querySelectorAll("[data-answer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        answerQuestion(btn.getAttribute("data-answer"));
      });
    });

    $("guess-correct-button").addEventListener("click", function () { confirmGuess(true); });
    $("guess-incorrect-button").addEventListener("click", function () { confirmGuess(false); });
    $("retry-button").addEventListener("click", retryLastRequest);
    $("play-again-button").addEventListener("click", playAgain);
    $("share-button").addEventListener("click", shareResult);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
