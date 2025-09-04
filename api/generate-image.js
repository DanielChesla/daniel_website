// /api/generate-image.js (Vercel serverless function)

// You can keep this even on Hobby; we'll still bail early and let the client retry.
export const config = { maxDuration: 60, runtime: "nodejs20.x" };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) return res.status(500).json({ error: "Missing HF_API_KEY" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { prompt } = body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Keep the function fast: don't wait too long so the browser can retry.
    const TIME_BUDGET_MS = 8000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIME_BUDGET_MS);

    const model = "stabilityai/stable-diffusion-2";
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        // Do NOT set "x-wait-for-model": true — that would exceed Vercel's timeout on cold starts
      },
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal,
    }).catch((e) => {
      // Network error or abort: treat as retriable
      return { ok: false, status: 503, _err: e };
    });

    clearTimeout(t);

    if (!r || !r.ok) {
      // 503 is common while HF model is loading — let the client retry
      const status = r?.status || 503;
      try {
        const ct = (r?.headers?.get("content-type") || "").toLowerCase();
        const err = ct.includes("application/json") ? await r.json() : await r.text();
        return res.status(status).json({ error: err || "Model loading; retry" });
      } catch {
        return res.status(status).json({ error: "Model loading; retry" });
      }
    }

    const ct = (r.headers.get("content-type") || "").toLowerCase();

    // Some HF pipelines return JSON with base64 inside
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 =
        j?.image ||
        j?.generated_image ||
        j?.data?.[0]?.b64_json ||
        j?.images?.[0] ||
        j?.[0]?.b64_json;

      if (!b64) return res.status(503).json({ error: "Model busy; retry" });
      return res.status(200).json({ image: `data:image/png;base64,${b64}` });
    }

    // Otherwise assume binary image data
    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).json({ image: `data:image/png;base64,${buf.toString("base64")}` });
  } catch (e) {
    if (e?.name === "AbortError") return res.status(503).json({ error: "Timed out; retry" });
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
