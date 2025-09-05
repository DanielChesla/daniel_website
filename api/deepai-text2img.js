// /api/deepai-text2img.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing 'text' in body" });
    }

    const upstream = await fetch("https://api.deepai.org/api/text2img", {
      method: "POST",
      headers: {
        "Api-Key": process.env.DEEPAI_API_KEY,              // <-- set in Vercel
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ text }),                  // DeepAI expects "text"
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Proxy error", detail: String(e) });
  }
}
