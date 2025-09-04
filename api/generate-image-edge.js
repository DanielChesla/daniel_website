// /api/generate-image-edge.js
export const config = { runtime: "edge" };

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

// ArrayBuffer -> base64 (Edge has no Buffer)
const abToBase64 = (ab) => {
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) return json(500, { error: "Missing HF_API_KEY" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const prompt = body?.prompt;
  if (!prompt) return json(400, { error: "Missing prompt" });

  // Use the faster model if provided (you already set HF_MODEL=stabilityai/sd-turbo)
  const MODEL = process.env.HF_MODEL || "stabilityai/sd-turbo";

  // Keep the edge invocation short so we never hit FUNCTION_INVOCATION_TIMEOUT
  const controller = new AbortController();
  const TIME_BUDGET_MS = 5000; // ~5s per invocation
  const to = setTimeout(() => controller.abort(), TIME_BUDGET_MS);

  try {
    const r = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        // IMPORTANT: do NOT wait here — allow HF to reply 503 while loading
        // "x-wait-for-model": "true",
        Accept: "image/*,application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal,
    });

    clearTimeout(to);

    const ct = (r.headers.get("content-type") || "").toLowerCase();

    // While the model is loading, HF commonly returns 503 + JSON with estimated_time
    if (r.status === 503) {
      let retryAfterMs = 1500;
      try {
        const j = await r.json();
        if (j?.estimated_time) retryAfterMs = Math.max(800, Math.floor(j.estimated_time * 1000));
      } catch { /* ignore */ }
      return json(202, { status: "loading", retryAfter: retryAfterMs });
    }

    if (!r.ok) {
      const payload = ct.includes("application/json") ? await r.json() : await r.text();
      return json(r.status, { error: "Upstream error", detail: payload });
    }

    // Binary image
    if (ct.startsWith("image/") || ct.startsWith("application/octet-stream")) {
      const buf = await r.arrayBuffer();
      const b64 = abToBase64(buf);
      const mime = ct.startsWith("image/") ? ct.split(";")[0] : "image/png";
      return json(200, { image: `data:${mime};base64,${b64}` });
    }

    // JSON with base64
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 =
        j?.image ||
        j?.generated_image ||
        j?.data?.[0]?.b64_json ||
        j?.images?.[0] ||
        j?.[0]?.b64_json;

      if (b64) return json(200, { image: `data:image/png;base64,${b64}` });
      return json(500, { error: "No image payload in JSON", debug: j });
    }

    const raw = await r.text();
    return json(500, { error: "Unexpected content-type", raw });
  } catch (e) {
    // Abort or network error → tell client to retry
    if (e?.name === "AbortError") return json(202, { status: "loading", retryAfter: 1500 });
    return json(503, { error: e?.message || "Network error; retry" });
  }
}
