// Focused tests for api/twenty-questions.js's forced-guess and validation
// logic. These run directly against the serverless handler function (not
// through a browser page) with `global.fetch` mocked to simulate
// Pollinations.ai responses, so they're fully deterministic and offline —
// no real network calls, no mocked browser routes needed.
//
// Covers: forced guess after 20 answered questions, a missing
// `message.content` upstream response, the model returning "questions" when
// a guess is mandatory, and a valid forced-guess response — plus the
// empty-guess / repeated-guess rejections, the reasoning_effort:"low"
// request parameter, and (2026-07-17, 5 batches of 4 revision) the exact
// 4-question batch target at each checkpoint and the early-guess
// confidence-gating rules (no guess before question 8; "high" confidence
// required for any guess between questions 8-19).
const { test, expect } = require("@playwright/test");

const HANDLER_PATH = "../api/twenty-questions.js";

// api/twenty-questions.js uses `export default`; dynamic import works from
// this CommonJS test file (Node treats it as an ES module based on syntax).
// Playwright's own test-file transform wraps ESM interop, so the resolved
// module can come back either as `{ default: handler }` or double-wrapped as
// `{ default: { default: handler } }` — handle both defensively.
async function loadHandler() {
  const mod = await import(HANDLER_PATH);
  if (typeof mod.default === "function") return mod.default;
  if (mod.default && typeof mod.default.default === "function") return mod.default.default;
  throw new Error("could not resolve the twenty-questions handler export; keys=" + Object.keys(mod || {}));
}

function mockReqRes(body) {
  const req = { method: "POST", body };
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    end() {
      return this;
    },
  };
  return { req, res };
}

function jsonUpstreamResponse(status, bodyObj, headers) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => (headers && headers[String(name).toLowerCase()]) || null },
    json: async () => bodyObj,
  };
}

function historyOf(n) {
  return Array.from({ length: n }, (_, i) => ({ question: "Question #" + (i + 1) + "?", answer: "yes" }));
}

test.describe("api/twenty-questions.js — forced guess & validation (focused, offline)", () => {
  let originalFetch;

  test.beforeEach(() => {
    originalFetch = global.fetch;
  });

  test.afterEach(() => {
    global.fetch = originalFetch;
  });

  test("forces a guess after 20 answered questions and returns it", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a red bicycle" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(20), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: "guess", text: "a red bicycle" });
  });

  test("rejects an upstream response with missing message.content", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { reasoning: "lots of hidden chain-of-thought, no final answer" } }],
      });

    const { req, res } = mockReqRes({ history: [], guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("upstream_error");
  });

  test("rejects a 'questions' response when a guess is mandatory (20-question cap)", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "questions", questions: ["One more?"] }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(20), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("rejects a 'questions' response on the final-guess call (after a rejected first guess)", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "questions", questions: ["Just one more?"] }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(5), guessesSoFar: ["a golden retriever"] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("accepts a valid forced-guess response", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a vintage typewriter" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(20), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: "guess", text: "a vintage typewriter" });
  });

  test("rejects an empty guess", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(20), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("rejects a repeated (previously rejected) guess on the final-guess call", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a golden retriever" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(5), guessesSoFar: ["a golden retriever"] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("sends reasoning_effort: \"low\" and preserves response_format json_object in the upstream request", async () => {
    const handler = await loadHandler();
    let capturedBody = null;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "questions", questions: ["Q1?", "Q2?", "Q3?", "Q4?"] }) } }],
      });
    };

    const { req, res } = mockReqRes({ history: [], guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(capturedBody.reasoning_effort).toBe("low");
    expect(capturedBody.response_format).toEqual({ type: "json_object" });
  });

  test("requests a batch of exactly 4 questions at the first checkpoint (empty history)", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "questions", questions: ["Q1?", "Q2?", "Q3?", "Q4?"] }) } }],
      });

    const { req, res } = mockReqRes({ history: [], guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: "questions", questions: ["Q1?", "Q2?", "Q3?", "Q4?"] });
  });

  test("requests a batch of exactly 4 questions at the final pre-cap checkpoint (16 answered)", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "questions", questions: ["Q17?", "Q18?", "Q19?", "Q20?"] }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(16), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: "questions", questions: ["Q17?", "Q18?", "Q19?", "Q20?"] });
  });

  test("rejects an early guess attempted before question 8, even with declared high confidence", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a house cat", confidence: "high" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(4), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("accepts an early guess at question 8 with declared high confidence", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a house cat", confidence: "high" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(8), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: "guess", text: "a house cat" });
  });

  test("rejects an early guess at question 8 with only medium confidence", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a house cat", confidence: "medium" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(8), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("rejects an early guess at question 12 with missing confidence", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a house cat" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(12), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("invalid_response");
  });

  test("accepts a forced guess at the 20-question cap with no confidence field at all", async () => {
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a red bicycle" }) } }],
      });

    const { req, res } = mockReqRes({ history: historyOf(20), guessesSoFar: [] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: "guess", text: "a red bicycle" });
  });

  test("persistent low-confidence early-guess non-compliance never crashes or hangs — each call independently returns the same structured invalid_response error", async () => {
    // Simulates what happens if the client's bounded retry (FR-016, 3 total
    // attempts) keeps hitting a model that won't comply: every independent
    // call must return the same well-formed error, never an unhandled
    // exception or a hang, so the client's retry loop terminates normally.
    const handler = await loadHandler();
    global.fetch = async () =>
      jsonUpstreamResponse(200, {
        choices: [{ message: { content: JSON.stringify({ type: "guess", text: "a house cat", confidence: "low" }) } }],
      });

    for (let attempt = 0; attempt < 3; attempt++) {
      const { req, res } = mockReqRes({ history: historyOf(8), guessesSoFar: [] });
      await handler(req, res);
      expect(res.statusCode).toBe(502);
      expect(res.body.code).toBe("invalid_response");
    }
  });
});
