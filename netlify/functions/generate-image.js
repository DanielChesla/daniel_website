// netlify/functions/generate-image.js

// ===== CORS CONFIG =====
// For a quick demo you can use "*" (allows any origin).
// For production, set ALLOWED_ORIGIN to your site, e.g. "https://danielchesla.com".
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (statusCode, bodyObj, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...corsHeaders,
    ...extraHeaders,
  },
  body: JSON.stringify(bodyObj),
});

export const handler = async (event) => {
  // ---- Preflight (CORS) ----
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "", // no body for preflight
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const HF_API_KEY = process.env.HF_API_KEY;
  const model = "stabilityai/stable-diffusion-2"; // free HF model

  if (!HF_API_KEY) {
    return json(500, { error: "Missing HF_API_KEY env var" });
  }

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return json(400, { error: "Missing prompt" });
    }

    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true", // avoid 503 "Model loading" responses
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!r.ok) {
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const errText = ct.includes("application/json")
        ? JSON.stringify(await r.json())
        : await r.text();
      return json(r.status, { error: errText });
    }

    const ct = (r.headers.get("content-type") || "").toLowerCase();

    // Some HF pipelines return JSON with base64 in various fields
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 =
        j?.image ||
        j?.generated_image ||
        j?.data?.[0]?.b64_json ||
        j?.images?.[0] ||
        j?.[0]?.b64_json;

      if (!b64) {
        return json(500, { error: "Unexpected JSON shape from model" });
      }
      return json(200, { image: `data:image/png;base64,${b64}` });
    }

    // Otherwise assume binary image
    const buf = Buffer.from(await r.arrayBuffer());
    return json(200, { image: `data:image/png;base64,${buf.toString("base64")}` });
  } catch (e) {
    return json(500, { error: e.message || "Unknown error" });
  }
};
