// /api/generate-image-edge.js
export const config = { runtime: "edge" };

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// ArrayBuffer -> base64 (Edge has no Node Buffer)
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

  // TIP: swap to "stabilityai/sd-turbo" for noticeably faster results.
  const model = "stabilityai/stable-diffusion-2";

  try {
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true", // Edge can afford to wait for cold start
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!r.ok) {
      const ct = r.headers.get("content-type") || "";
      const err = ct.includes("application/json") ? await r.json() : await r.text();
      return json(r.status, { error: err || "Upstream error" });
    }

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 = j?.image || j?.generated_image || j?.data?.[0]?.b64_json || j?.images?.[0] || j?.[0]?.b64_json;
      if (!b64) return json(500, { error: "Unexpected JSON from model" });
      return json(200, { image: `data:image/png;base64,${b64}` });
    }

    const buf = await r.arrayBuffer();
    const b64 = abToBase64(buf);
    return json(200, { image: `data:image/png;base64,${b64}` });
  } catch (e) {
    return json(503, { error: e?.message || "Upstream timeout; retry" });
  }
}
