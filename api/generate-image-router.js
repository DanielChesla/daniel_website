// /api/generate-image-router.js
export const config = { runtime: "edge" };

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// ArrayBuffer → base64 (Edge has no Node Buffer)
const abToBase64 = (ab) => {
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY;
  if (!HF_TOKEN) return json(500, { error: "Missing HF_TOKEN (or HF_API_KEY)" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const prompt = body?.prompt;
  if (!prompt) return json(400, { error: "Missing prompt" });

  const MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";

  try {
    const r = await fetch("https://router.huggingface.co/together/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json,image/*",
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        // Router accepts OpenAI-like params; keep these light for speed.
        response_format: "b64_json",   // some samples say "base64" – we’ll handle both in parsing
        size: "512x512",
        num_inference_steps: 6,
        guidance_scale: 1.5,
      }),
    });

    const ct = (r.headers.get("content-type") || "").toLowerCase();

    if (!r.ok) {
      const detail = ct.includes("application/json") ? await r.json() : await r.text();
      return json(r.status, { error: "Upstream error", detail, upstreamStatus: r.status });
    }

    if (ct.includes("application/json")) {
      const j = await r.json();
      // Handle several possible shapes
      const b64 =
        j?.data?.[0]?.b64_json ||
        j?.data?.[0]?.base64 ||
        j?.image ||
        j?.images?.[0] ||
        j?.output?.[0];
      if (!b64) return json(500, { error: "No image payload in JSON", debug: j });
      return json(200, { image: `data:image/png;base64,${b64}` });
    }

    // Fallback: binary image
    const buf = await r.arrayBuffer();
    const b64 = abToBase64(buf);
    return json(200, { image: `data:image/png;base64,${b64}` });
  } catch (e) {
    return json(503, { error: e?.message || "Network error" });
  }
}
