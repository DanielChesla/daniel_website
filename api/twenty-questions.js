// /api/twenty-questions.js
// Serverless function for the "20 Questions" AI guessing game. Given the
// client's in-memory question/answer history (and any prior wrong guesses),
// asks Pollinations.ai's free, keyless text API to decide the next best
// yes/no question — or to make a guess — and returns strict JSON to the
// client. Stateless: nothing is persisted server-side (see spec TECH-012).
//
// Provider: Pollinations.ai's hosted free text model (POST
// https://text.pollinations.ai/openai, OpenAI-compatible chat-completions
// shape). Keyless/anonymous access verified working; anonymous-tier
// requests can occasionally take 20-30s, so the upstream timeout below is
// set generously (see specifications/specifications.md TECH-008).
export const config = { runtime: "nodejs", maxDuration: 30 };

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const UPSTREAM_TIMEOUT_MS = 28000; // TECH-008: ~28s to accommodate verified anonymous-tier latency.
const MAX_QUESTIONS = 20; // FR-003
const MAX_GUESSES = 2; // OUT-004

const ALLOWED_ANSWERS = new Set(["yes", "no", "don't know", "probably", "probably not"]);
const MAX_TEXT_LEN = 300; // defensive cap on any single question/answer/guess string

function clip(str, max) {
  const s = String(str == null ? "" : str).trim();
  return s.length > max ? s.slice(0, max) : s;
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
function buildMessages(history, guessesSoFar, questionsAsked, mustGuessNow) {
  const systemPrompt =
    "You are an expert player of the game \"20 Questions\". A human is thinking of a person " +
    "(real or fictional), a place, an animal, or an object, and you are trying to guess it by " +
    "asking smart, discriminating yes/no questions. " +
    "You must respond with ONLY a single strict JSON object — no markdown, no code fences, no " +
    "commentary before or after — matching exactly one of these two shapes:\n" +
    '{"type":"question","text":"<a single, specific yes/no question>"}\n' +
    '{"type":"guess","text":"<your specific guess, e.g. \\"a golden retriever\\">"}\n' +
    "Rules:\n" +
    "- The human answers each question with one of: Yes, No, Don't Know, Probably, Probably Not.\n" +
    "- The whole round is capped at 20 total questions, across both guess attempts.\n" +
    "- Only respond with a guess when you are reasonably confident, unless you are told you must " +
    "guess now.\n" +
    "- Never repeat a question you have already asked.\n" +
    "- Never repeat a guess you have already made.\n" +
    "- Keep your question or guess concise (one short sentence), and make it as specific as " +
    "possible once you guess (e.g. a specific breed/name/model, not a vague category).";

  const lines = [];
  lines.push("Questions asked so far (" + questionsAsked + " of " + MAX_QUESTIONS + "):");
  if (history.length === 0) {
    lines.push("(none yet — this is the first question of the round)");
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
  if (mustGuessNow) {
    lines.push(
      "IMPORTANT: The question budget is exhausted (or this is your final allowed attempt). " +
      "You must respond with \"type\":\"guess\" now — do not ask another question."
    );
  } else {
    lines.push("Decide whether to ask another yes/no question or make a guess now, and respond accordingly.");
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
        messages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error("upstream HTTP " + r.status);
    const data = await r.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("upstream returned no content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function parseModelReply(content) {
  const jsonText = extractJsonText(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("model output was not parseable JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("model output was not a JSON object");
  const type = clip(parsed.type, 20).toLowerCase();
  const text = clip(parsed.text, MAX_TEXT_LEN);
  if (type !== "question" && type !== "guess") throw new Error("model output had an invalid \"type\"");
  if (!text) throw new Error("model output had empty \"text\"");
  return { type, text };
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
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let history, guessesSoFar;
  try {
    const body = parseBody(req);
    ({ history, guessesSoFar } = validateGameState(body));
  } catch (e) {
    return res.status(400).json({ error: "invalid request body", detail: String(e.message || e) });
  }

  if (guessesSoFar.length >= MAX_GUESSES) {
    // The client should never legitimately reach this (the round ends after
    // the 2nd guess), but guard against it defensively.
    return res.status(400).json({ error: "maximum number of guesses already used" });
  }

  const questionsAsked = history.length;
  // TECH-010: enforce the 20-question cap and forced-guess rules server-side.
  //  - FR-009a: cap reached before any guess -> force a guess now.
  //  - FR-009b: cap reached after a first wrong guess -> force the final guess now.
  const mustGuessNow = questionsAsked >= MAX_QUESTIONS;

  const messages = buildMessages(history, guessesSoFar, questionsAsked, mustGuessNow);

  try {
    const content = await callPollinations(messages);
    let reply = parseModelReply(content);
    if (mustGuessNow && reply.type !== "guess") {
      // Server-side override per TECH-010, regardless of what the model chose.
      reply = { type: "guess", text: reply.text };
    }
    return res.status(200).json(reply);
  } catch (e) {
    return res.status(502).json({ error: "failed to get next question/guess", detail: String(e.message || e) });
  }
}
