// 20questions.js
// Client-side game logic for the "20 Questions" AI guessing game.
// Holds the full round state in memory (no server-side session, no
// persistence — see specifications/specifications.md FR-018/FR-019/FR-020)
// and talks to /api/twenty-questions for each turn.

(function () {
  "use strict";

  var API_URL = "/api/twenty-questions";
  var MAX_QUESTIONS = 20;
  var MAX_TOTAL_ATTEMPTS = 3; // FR-016: 3 total attempts (1 initial + 2 retries)
  var RETRY_BACKOFF_MS = [1500, 3000]; // increasing backoff before retry 2 and 3

  // ---- Game state (client-side only) ----
  var history = [];          // [{ question, answer }]
  var guessesSoFar = [];      // [ "a golden retriever", ... ]
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

  function showThinking() {
    showGameSection();
    hideAllViews();
    $("thinking-view").classList.remove("d-none");
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
  // API calls with automatic retry + backoff (FR-016/FR-017)
  // ---------------------------------------------------------------------
  function postToApi() {
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: history, guessesSoFar: guessesSoFar }),
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error) || ("HTTP " + res.status);
          throw new Error(msg);
        }
        if (!data || (data.type !== "question" && data.type !== "guess") || !data.text) {
          throw new Error("malformed response from server");
        }
        return data;
      });
    });
  }

  function requestNext(attempt) {
    attempt = attempt || 0;
    showThinking();
    postToApi()
      .then(handleReply)
      .catch(function () {
        if (attempt < MAX_TOTAL_ATTEMPTS - 1) {
          var delay = RETRY_BACKOFF_MS[attempt] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
          setTimeout(function () { requestNext(attempt + 1); }, delay);
        } else {
          showErrorView("Hmm, having trouble thinking of a question. Please try again.");
        }
      });
  }

  function handleReply(reply) {
    if (reply.type === "question") {
      currentQuestionText = reply.text;
      updateProgress(history.length + 1);
      $("question-text").textContent = currentQuestionText;
      showQuestion();
    } else {
      currentGuessText = reply.text;
      $("guess-text-span").textContent = currentGuessText;
      showGuessConfirm();
    }
  }

  // ---------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------
  function startGame() {
    history = [];
    guessesSoFar = [];
    currentQuestionText = null;
    currentGuessText = null;
    lastOutcomeWon = null;
    requestNext();
  }

  function answerQuestion(value) {
    if (!currentQuestionText) return;
    history.push({ question: currentQuestionText, answer: value });
    currentQuestionText = null;
    requestNext();
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
      requestNext();
    }
  }

  function retryLastRequest() {
    requestNext();
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
