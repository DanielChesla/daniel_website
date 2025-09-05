// /api/generate-image-router.js
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing 'prompt' (string) in body" });
    }

    // Try providers in order. First success returns.
    const providers = [deepaiGenerate, hfGenerate, stabilityGenerate];

    for (const fn of providers) {
      try {
        const out = await fn(prompt);
        if (out?.dataUrl) {
          return res.status(200).json({ url: out.dataUrl, provider: out.provider });
        }
      } catch (e) {
        // Known "no credits" or "not configured" → continue to next provider
        const msg = String(e?.message || e);
        // If the error is "misconfigured", "no key", or definite billing issue, try next
        if (
          msg.includes("missing") ||
          msg.includes("not configured") ||
          msg.includes("payment") ||
          msg.includes("credits") ||
          msg.includes("402") ||
          msg.includes("insufficient")
        ) {
          continue;
        }
        // Other errors (e.g., bad request) → still try next
        continue;
      }
    }

    return res.status(502).json({
      error:
        "All upstream providers failed. Set at least one of DEEPAI_API_KEY, HF_TOKEN, or STABILITY_API_KEY in Vercel.",
    });
  } catch (err) {
    return res.status(500).json({ error: "Router error", detail: String(err) });
  }
}

// ---------- Providers ----------

// DeepAI Text-to-Image → returns JSON with output_url, but we convert to data URL
async function deepaiGenerate(prompt) {
  const key = process.env.DEEPAI_API_KEY;
  if (!key) throw new Error("DeepAI not configured (missing DEEPAI_API_KEY).");

  const r = await fetch("https://api.deepai.org/api/text2img", {
    method: "POST",
    headers: {
      "Api-Key": key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ text: prompt }),
  });

  const data = await r.json().catch(() => ({}));
  if (r.status === 402 || data?.status?.toString().includes("credits")) {
    throw new Error("DeepAI out of credits (402).");
  }
  if (!r.ok) throw new Error(data?.error || data?.status || `DeepAI HTTP ${r.status}`);

  const url = data?.output_url;
  if (!url) throw new Error("DeepAI: no output_url in response");
  const img = await fetch(url);
  if (!img.ok) throw new Error(`DeepAI image fetch failed: HTTP ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  return { provider: "deepai", dataUrl: `data:image/png;base64,${buf.toString("base64")}` };
}

// Hugging Face Inference API → returns binary image bytes
// Model: SDXL (you can switch to another model if you like)
async function hfGenerate(prompt) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("Hugging Face not configured (missing HF_TOKEN).");

  const model = process.env.HF_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";
  const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.string
