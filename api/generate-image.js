// /api/generate-image.js
// Vercel Serverless: use "nodejs" (not "nodejs20.x")
export const config = { runtime: "nodejs" }; // you can omit this line entirely if you like

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) return res.status(500).json({ error: "Missing HF_API_KEY" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { prompt } = body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Keep the function under the Hobby 10s limit; let client retry on 503.
    const TIME_BUDGET_MS = 8000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIME_BUDGET_MS);

    const model = "stabilityai/stable-diffusion-2"; // consider "stabilityai/sd-turbo" for faster cold starts
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        // No "x-wait-for-model" here to avoid long waits; client will retry.
      },
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal,
    }).catch(() => ({ ok: false, status: 503 }));

    clearTimeout(t);

    if (!r || !r.ok) {
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
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 = j?.image || j?.generated_image || j?.data?.[0]?.b64_json || j?.images?.[0] || j?.[0]?.b64_json;
      if (!b64) return res.status(503).json({ error: "Model busy; retry" });
      return res.status(200).json({ image: `data:image/png;base64,${b64}` });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).json({ image: `data:image/png;base64,${buf.toString("base64")}` });
  } catch (e) {
    if (e?.name === "AbortError") return res.status(503).json({ error: "Timed out; retry" });
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
