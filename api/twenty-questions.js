// /api/twenty-questions.js
// Serverless function for the "20 Questions" AI guessing game. Given the
// client's in-memory question/answer history (and any prior wrong guesses),
// asks Pollinations.ai's free, keyless text API to decide the next *batch*
// of up to four yes/no questions — or to make a guess — and returns strict
// JSON to the client. Stateless: nothing is persisted server-side (see spec
// TECH-012).
//
// Batched adaptive questioning (hotfix 2026-07-16, revised 2026-07-17 —
// 5 batches of 4): instead of one AI request per question, the client
// requests a batch of up to four questions at a time (checkpoints at
// 0/4/8/12/16 answered questions — 5 batch calls to reach the 20-question
// cap), presents them one at a time locally, then requests the next
// batch/guess. Each batch has a stage-specific purpose (broad category ->
// major characteristics -> shortlist -> distinguish candidates -> targeted
// confirmation) and the model is instructed to pick each question for
// information gain against its current shortlist. See
// specifications/specifications.md FR-003/FR-006b/FR-006d/FR-006e/TECH-007/TECH-010.
//
// Provider: Pollinations.ai's hosted free text model (POST
// https://text.pollinations.ai/openai, OpenAI-compatible chat-completions
// shape). Keyless/anonymous access verified working; anonymous-tier
// requests can occasionally take 20-30s, so the upstream timeout below is
// set generously (see specifications/specifications.md TECH-008).
//
// Reasoning-model fix (hotfix 2026-07-17): the "openai" model alias is
// backed by gpt-oss-20b, a reasoning model that can burn its whole
// completion-token budget on hidden chain-of-thought once the prompt has
// real history, leaving `message.content` entirely absent. The request
// includes `reasoning_effort: "low"` to keep this from starving the actual
// JSON answer (verified fix — see TECH-007c).
export const config = { runtime: "nodejs", maxDuration: 30 };

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const UPSTREAM_TIMEOUT_MS = 28000; // TECH-008: ~28s to accommodate verified anonymous-tier latency.
const MAX_QUESTIONS = 20; // FR-003
const MAX_GUESSES = 2; // OUT-004
const MAX_BATCH_SIZE = 4; // FR-003/FR-006b: up to 4 questions per batch (5 batches reach the 20-question cap)
const MIN_QUESTIONS_BEFORE_GUESS = 8; // FR-006d: no guess (early or otherwise) is even considered before this many answered questions
const HIGH_CONFIDENCE = "high"; // FR-006e: early guesses (>= MIN_QUESTIONS_BEFORE_GUESS) require this exact declared confidence

// TECH-007a: rate-limit retry-after handling.
const RATE_LIMIT_DEFAULT_MS = 15000; // ~15s default when no Retry-After is present
const RATE_LIMIT_MAX_MS = 30000; // sane clamp on an unusually large Retry-After

const ALLOWED_ANSWERS = new Set(["yes", "no", "don't know", "probably", "probably not"]);
const MAX_TEXT_LEN = 300; // defensive cap on any single question/answer/guess string

function clip(str, max) {
  const s = String(str == null ? "" : str).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function normalize(str) {
  return String(str == null ? "" : str).trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Custom error types so the handler can distinguish failure categories
// (TECH-007a) without doing any additional upstream requests (TECH-007b).
// ---------------------------------------------------------------------------
class UpstreamRateLimitError extends Error {
  constructor(retryAfterMs) {
    super("upstream rate-limited (429)");
    this.name = "UpstreamRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

class InvalidModelResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidModelResponseError";
  }
}

// ---------------------------------------------------------------------------
// Request validation/sanitization (the request body is untrusted input).
// ---------------------------------------------------------------------------
function parseBody(req) {
  let body = req.body;
  if (body == null || body === "") return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      throw new Error("invalid JSON body");
    }
  }
  if (typeof body !== "object") throw new Error("invalid JSON body");
  return body;
}

function validateGameState(body) {
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const rawGuesses = Array.isArray(body.guessesSoFar) ? body.guessesSoFar : [];

  if (rawHistory.length > MAX_QUESTIONS + 5) {
    throw new Error("history too long");
  }
  if (rawGuesses.length > MAX_GUESSES + 1) {
    throw new Error("too many guesses");
  }

  const history = rawHistory.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error("history[" + i + "] must be an object");
    }
    const question = clip(item.question, MAX_TEXT_LEN);
    const answerRaw = clip(item.answer, 40).toLowerCase();
    if (!question) throw new Error("history[" + i + "].question is required");
    if (!ALLOWED_ANSWERS.has(answerRaw)) {
      throw new Error("history[" + i + "].answer must be one of: Yes, No, Don't Know, Probably, Probably Not");
    }
    return { question, answer: answerRaw };
  });

  const guessesSoFar = rawGuesses.map((g, i) => {
    const text = clip(g, MAX_TEXT_LEN);
    if (!text) throw new Error("guessesSoFar[" + i + "] must be a non-empty string");
    return text;
  });

  return { history, guessesSoFar };
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

// FR-006d: each 4-question batch has a distinct purpose, from broad
// category-narrowing down to highly targeted confirmation questions.
const STAGES = [
  { range: "1–4", purpose: "Determine the broad category (person, place, animal, or object) and the most fundamental attributes." },
  { range: "5–8", purpose: "Narrow down major characteristics such as geography, era, use, or domain." },
  { range: "9–12", purpose: "Establish a shortlist of plausible specific answers." },
  { range: "13–16", purpose: "Distinguish between the leading candidates on your shortlist." },
  { range: "17–20", purpose: "Ask highly targeted confirmation questions to pin down the single most likely answer." },
];

function stageForQuestionsAsked(questionsAsked) {
  const index = Math.min(STAGES.length - 1, Math.floor(questionsAsked / MAX_BATCH_SIZE));
  return STAGES[index];
}

function buildMessages(history, guessesSoFar, questionsAsked, mustGuessNow, finalGuessMode, batchTarget) {
  const systemPrompt =
    "You are an expert player of the game \"20 Questions\". A human is thinking of a person " +
    "(real or fictional), a place, an animal, or an object, and you are trying to guess it by " +
    "asking smart, discriminating yes/no questions, in batches of up to four. " +
    "You must respond with ONLY a single strict JSON object — no markdown, no code fences, no " +
    "commentary before or after — matching exactly one of these two shapes:\n" +
    '{"type":"questions","questions":["<question 1>","<question 2>", "..."]}\n' +
    '{"type":"guess","text":"<your specific guess, e.g. \\"a golden retriever\\">","confidence":"high"|"medium"|"low"}\n' +
    "Rules:\n" +
    "- The human answers each question with one of: Yes, No, Don't Know, Probably, Probably Not.\n" +
    "- The whole round is capped at 20 total questions, across both guess attempts, in batches of " +
    "up to 4 questions per turn (stages: 1-4, 5-8, 9-12, 13-16, 17-20), each with a distinct " +
    "purpose described below.\n" +
    "- When you choose to ask questions instead of guessing, return EXACTLY the requested number " +
    "of NEW, unique yes/no questions in the \"questions\" array — never repeat a question already " +
    "asked, and never include near-duplicate questions in the same array.\n" +
    "- Choose each question for maximum INFORMATION GAIN: it should meaningfully split your " +
    "current set of plausible candidates into roughly balanced groups, rather than confirming " +
    "something you already strongly suspect.\n" +
    "- You may never guess before question 8. From question 8 onward, you may guess early only " +
    "if you are highly confident — in that case set \"confidence\":\"high\" on your guess. A guess " +
    "with \"confidence\" other than \"high\" (or missing) will be rejected before question 20, so if " +
    "you are not highly confident, ask another batch of questions instead.\n" +
    "- Never repeat a guess you have already made.\n" +
    "- Keep each question concise (one short sentence), and make guesses as specific as " +
    "possible (e.g. a specific breed/name/model, not a vague category).";

  const lines = [];
  lines.push("Questions asked so far (" + questionsAsked + " of " + MAX_QUESTIONS + "):");
  if (history.length === 0) {
    lines.push("(none yet — this is the first turn of the round)");
  } else {
    history.forEach((h, i) => {
      lines.push((i + 1) + ". Q: " + h.question + " — A: " + h.answer);
    });
  }
  if (guessesSoFar.length > 0) {
    lines.push("");
    lines.push("Previous wrong guess(es) — do not repeat these: " + guessesSoFar.join("; "));
  }
  lines.push("");
  if (finalGuessMode) {
    lines.push(
      "IMPORTANT: Your previous guess was wrong. This is your final allowed attempt — you must " +
      "make your SECOND AND FINAL GUESS now.\n" +
      "You MUST return a guess. You MUST NOT return another batch of questions — a \"questions\" " +
      "response will be rejected and is not a valid answer here.\n" +
      "Your new guess MUST be different from any previous guess(es) listed above.\n" +
      "A \"confidence\" field is not required here (you must guess regardless of confidence).\n" +
      "Respond with EXACTLY this JSON shape, and nothing else:\n" +
      '{"type":"guess","text":"the best specific guess"}'
    );
  } else if (mustGuessNow) {
    lines.push(
      "IMPORTANT: The 20-question budget has been used up — you have no questions left.\n" +
      "You MUST return a guess now. You MUST NOT return a batch of questions — a \"questions\" " +
      "response will be rejected and is not a valid answer here.\n" +
      "A \"confidence\" field is not required here (you must guess regardless of confidence).\n" +
      "Respond with EXACTLY this JSON shape, and nothing else:\n" +
      '{"type":"guess","text":"the best specific guess"}'
    );
  } else {
    const stage = stageForQuestionsAsked(questionsAsked);
    lines.push(
      "Current stage — questions " + stage.range + ": " + stage.purpose
    );
    if (questionsAsked < MIN_QUESTIONS_BEFORE_GUESS) {
      lines.push(
        "You MUST NOT guess yet (fewer than " + MIN_QUESTIONS_BEFORE_GUESS + " questions have been " +
        "answered). Return EXACTLY " + batchTarget + " new, unique yes/no question(s) in the " +
        "\"questions\" array, chosen for maximum information gain for this stage's purpose."
      );
    } else {
      lines.push(
        "Decide whether to make an early guess now or ask another batch of yes/no questions. Only " +
        "guess now if you are HIGHLY confident (set \"confidence\":\"high\"); otherwise return EXACTLY " +
        batchTarget + " new, unique yes/no question(s) in the \"questions\" array, chosen for " +
        "maximum information gain for this stage's purpose."
      );
    }
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: lines.join("\n") },
  ];
}

// ---------------------------------------------------------------------------
// Upstream call + response parsing
// ---------------------------------------------------------------------------
function extractJsonText(raw) {
  let s = String(raw || "").trim();
  // Strip ```json ... ``` or ``` ... ``` code fences if the model adds them anyway.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  return s;
}

function parseRetryAfter(headerVal) {
  if (!headerVal) return RATE_LIMIT_DEFAULT_MS;
  const asSeconds = Number(headerVal);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, RATE_LIMIT_MAX_MS);
  }
  const asDate = Date.parse(headerVal);
  if (!Number.isNaN(asDate)) {
    const diff = asDate - Date.now();
    if (diff > 0) return Math.min(diff, RATE_LIMIT_MAX_MS);
  }
  return RATE_LIMIT_DEFAULT_MS;
}

// TECH-007b: on ANY failure below (network/timeout/non-2xx/unparseable/
// invalid shape), this function throws and the caller returns an error to
// the client immediately — no additional internal request to Pollinations is
// made, to avoid doubling anonymous-tier traffic and risking maxDuration.
async function callPollinations(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const r = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        response_format: { type: "json_object" },
        // Verified fix (2026-07-17): Pollinations' "openai" alias is backed by
        // a reasoning model (gpt-oss-20b) that, once the prompt includes real
        // conversation history, frequently spends its entire completion-token
        // budget on hidden chain-of-thought and never emits `message.content`
        // at all. "reasoning_effort: low" reliably keeps enough of the budget
        // free for the actual JSON answer (see TECH-007c).
        reasoning_effort: "low",
        messages,
      }),
      signal: controller.signal,
    });
    if (r.status === 429) {
      const retryAfterMs = parseRetryAfter(r.headers.get("retry-after"));
      throw new UpstreamRateLimitError(retryAfterMs);
    }
    if (!r.ok) throw new Error("upstream HTTP " + r.status);
    const data = await r.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("upstream returned no content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// Parses the model's raw JSON reply into a loosely-typed shape. Does NOT yet
// enforce batch sizing, dedup, or early-guess/confidence gating — see
// sanitizeBatch/sanitizeGuess and the handler's early-guess checks below.
function parseModelReply(content) {
  const jsonText = extractJsonText(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new InvalidModelResponseError("model output was not parseable JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new InvalidModelResponseError("model output was not a JSON object");
  }
  const type = clip(parsed.type, 20).toLowerCase();
  if (type === "guess") {
    const text = clip(parsed.text, MAX_TEXT_LEN);
    if (!text) throw new InvalidModelResponseError("model guess was empty");
    // FR-006e: confidence is server-internal only (never shown to the user,
    // per OUT-007) and only meaningful for early (non-forced) guesses.
    const confidenceRaw = clip(parsed.confidence, 20).toLowerCase();
    const confidence = ["high", "medium", "low"].includes(confidenceRaw) ? confidenceRaw : null;
    return { type: "guess", text, confidence };
  }
  if (type === "questions") {
    const items = Array.isArray(parsed.questions) ? parsed.questions : [];
    return { type: "questions", questionsRaw: items };
  }
  throw new InvalidModelResponseError("model output had an invalid \"type\"");
}

// FR-006b/TECH-010: enforce exact batch size, and dedupe against prior
// history + within the batch itself (prevents duplicate questions,
// requirement #9/#3). No internal retry on failure — see TECH-007b.
function sanitizeBatch(rawItems, history, batchTarget) {
  const historySet = new Set(history.map((h) => normalize(h.question)));
  const seen = new Set();
  const out = [];
  for (const raw of rawItems) {
    const text = clip(raw, MAX_TEXT_LEN);
    if (!text) continue;
    const norm = normalize(text);
    if (!norm || historySet.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(text);
    if (out.length >= batchTarget) break; // truncate to the exact target
  }
  if (out.length < batchTarget) {
    throw new InvalidModelResponseError(
      "model returned only " + out.length + " unique new question(s), " + batchTarget + " required"
    );
  }
  return out;
}

// Prevents repeated rejected guesses (requirement #9).
function sanitizeGuess(rawText, guessesSoFar) {
  const text = clip(rawText, MAX_TEXT_LEN);
  if (!text) throw new InvalidModelResponseError("model guess was empty");
  const norm = normalize(text);
  const isDuplicate = guessesSoFar.some((g) => normalize(g) === norm);
  if (isDuplicate) throw new InvalidModelResponseError("model repeated a previous guess");
  return text;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Each game turn is unique — never cache (TECH-009).
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only", code: "bad_request" });

  let history, guessesSoFar;
  try {
    const body = parseBody(req);
    ({ history, guessesSoFar } = validateGameState(body));
  } catch (e) {
    return res.status(400).json({ error: "invalid request body", code: "bad_request", detail: String(e.message || e) });
  }

  if (guessesSoFar.length >= MAX_GUESSES) {
    // The client should never legitimately reach this (the round ends after
    // the 2nd guess), but guard against it defensively.
    return res.status(400).json({ error: "maximum number of guesses already used", code: "bad_request" });
  }

  const questionsAsked = history.length;
  // TECH-010: enforce the 20-question cap and forced-guess rules server-side.
  //  - finalGuessMode: a first guess was already rejected -> this call must
  //    return the second/final guess (FR-009), no more questions.
  //  - capReached: 20 questions answered without any guess yet -> forced
  //    first guess (FR-009a).
  // Together with the 4-question batches and MIN_QUESTIONS_BEFORE_GUESS gate
  // above, a full round is at most: 5 batch-generation calls (checkpoints
  // 0/4/8/12/16) + 1 forced first-guess call + 1 final-guess call if the
  // first guess is wrong = 7 calls maximum, excluding client-side retries.
  const finalGuessMode = guessesSoFar.length >= 1;
  const capReached = questionsAsked >= MAX_QUESTIONS;
  const mustGuessNow = finalGuessMode || capReached;
  const batchTarget = mustGuessNow ? 0 : Math.min(MAX_BATCH_SIZE, MAX_QUESTIONS - questionsAsked);

  const messages = buildMessages(history, guessesSoFar, questionsAsked, mustGuessNow, finalGuessMode, batchTarget);

  try {
    const content = await callPollinations(messages);
    const reply = parseModelReply(content);

    if (mustGuessNow) {
      if (reply.type !== "guess") {
        // TECH-010: the model did not comply with being forced to guess.
        // No internal retry (TECH-007b) — surface as invalid_response so the
        // client's own retry flow (FR-016) re-issues this identical request.
        throw new InvalidModelResponseError("model was required to guess but returned questions");
      }
      const text = sanitizeGuess(reply.text, guessesSoFar);
      return res.status(200).json({ type: "guess", text });
    }

    if (reply.type === "guess") {
      // FR-006d/FR-006e: early guesses (guessesSoFar is always empty here —
      // a non-empty guessesSoFar always implies finalGuessMode above) are
      // gated: never before MIN_QUESTIONS_BEFORE_GUESS, and only with
      // declared "high" confidence from that point through question 20.
      // Non-compliance is rejected the same way as any other invalid model
      // output (invalid_response, no internal retry — TECH-007b), letting
      // the client's existing bounded retry flow (FR-016) handle it, which
      // cannot loop forever since it caps at 3 total attempts.
      if (questionsAsked < MIN_QUESTIONS_BEFORE_GUESS) {
        throw new InvalidModelResponseError(
          "model attempted an early guess before question " + MIN_QUESTIONS_BEFORE_GUESS +
          " (only " + questionsAsked + " answered so far)"
        );
      }
      if (reply.confidence !== HIGH_CONFIDENCE) {
        throw new InvalidModelResponseError(
          "model attempted an early guess without declaring high confidence (confidence=" +
          (reply.confidence || "none") + ")"
        );
      }
      const text = sanitizeGuess(reply.text, guessesSoFar);
      return res.status(200).json({ type: "guess", text });
    }

    const questions = sanitizeBatch(reply.questionsRaw, history, batchTarget);
    return res.status(200).json({ type: "questions", questions });
  } catch (e) {
    if (e instanceof UpstreamRateLimitError) {
      return res.status(429).json({
        error: "The AI service is being rate-limited right now.",
        code: "rate_limited",
        retryAfterMs: e.retryAfterMs,
      });
    }
    if (e instanceof InvalidModelResponseError) {
      return res.status(502).json({
        error: "The AI's response could not be used.",
        code: "invalid_response",
        detail: String(e.message || e),
      });
    }
    return res.status(502).json({
      error: "failed to get next question/guess",
      code: "upstream_error",
      detail: String(e.message || e),
    });
  }
}
