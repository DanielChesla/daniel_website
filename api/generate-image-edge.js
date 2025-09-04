// /api/generate-image-edge.js
export const config = { runtime: "edge" };

// Helper to send JSON consistently
const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
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
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const prompt = body?.prompt;
  if (!prompt) return json(400, { error: "Missing prompt" });

  // TIP: "stabilityai/sd-turbo" is much faster for demos.
  const MODEL = process.env.HF_MODEL || "stabilityai/stable-diffusion-2";

  try {
    const r = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true", // Edge gives us ~30s to ride out cold starts
        // "Accept": "image/*"  // optional: nudge HF to send an image
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    const ct = (r.headers.get("content-type") || "").toLowerCase();

    if (!r.ok) {
      // Return the upstream payload so you can see what's happening
      const errPayload = ct.includes("application/json") ? await r.json() : await r.text();
      return json(r.status, { error: "Upstream error", detail: errPayload, contentType: ct });
    }

    // If HF returned an image (common path)
    if (ct.startsWith("image/") || ct.startsWith("application/octet-stream")) {
      const buf = await r.arrayBuffer();
      const b64 = abToBase64(buf);
      // use the exact MIME if provided; default to png otherwise
      const mime = ct.startsWith("image/") ? ct.split(";")[0] : "image/png";
      return json(200, { image: `data:${mime};base64,${b64}` });
    }

    // Some pipelines respond with JSON containing base64
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 =
        j?.image ||
        j?.generated_image ||
        j?.data?.[0]?.b64_json ||
        j?.images?.[0] ||
        j?.[0]?.b64_json;

      if (b64) return json(200, { image: `data:image/png;base64,${b64}` });

      // No obvious image payload — return debug so you can see it in Network tab
      return json(200, { debug: j, note: "No image field in JSON; see debug payload" });
    }

    // Unknown content-type
    const raw = await r.text();
    return json(200, { debug: raw, contentType: ct, note: "Unexpected content-type" });
  } catch (e) {
    return json(503, { error: e?.message || "Upstream timeout; retry" });
  }
}
