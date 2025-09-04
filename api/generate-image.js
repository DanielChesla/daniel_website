// /api/generate-image.js (Vercel serverless function)
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) return res.status(500).json({ error: "Missing HF_API_KEY" });

    // Vercel parses JSON bodies automatically for Node functions
    const { prompt } = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const model = "stabilityai/stable-diffusion-2";
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!r.ok) {
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const err = ct.includes("application/json") ? await r.json() : await r.text();
      return res.status(r.status).json({ error: err });
    }

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 =
        j?.image || j?.generated_image || j?.data?.[0]?.b64_json || j?.images?.[0] || j?.[0]?.b64_json;
      if (!b64) return res.status(500).json({ error: "Unexpected JSON from model" });
      return res.status(200).json({ image: `data:image/png;base64,${b64}` });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).json({ image: `data:image/png;base64,${buf.toString("base64")}` });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
