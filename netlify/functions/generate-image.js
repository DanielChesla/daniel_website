// Netlify Function: generate-image via Hugging Face (FLUX.1-schnell)
// Returns { b64: "..." }  (PNG base64) with permissive CORS

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

const HF_MODEL = "black-forest-labs/FLUX.1-schnell";
const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

module.exports.handler = async (event) => {
  try {
    // Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: "Server misconfiguration: HF_TOKEN is not set.",
      };
    }

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid JSON body." }; }

    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, headers: CORS_HEADERS, body: "Missing prompt." };
    }

    // Hugging Face expects raw text input or { inputs, parameters }
    // We’ll request a smaller size to keep it snappy on free tier
    const payload = {
      inputs: prompt,
      parameters: {
        guidance_scale: 3,
        num_inference_steps: 12,
        width: 768,
        height: 768,
        // You can add seed, negative_prompt, etc.
      }
    };

    const resp = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // HF returns either an image (binary) or JSON error
    const contentType = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, headers: CORS_HEADERS, body: `HF error ${resp.status}: ${errText}` };
    }

    if (contentType.includes("application/json")) {
      // likely a queue/warmup/status message
      const data = await resp.json();
      // Some models need a warm-up call; tell the client to retry once
      return { statusCode: 503, headers: CORS_HEADERS, body: `HF JSON response: ${JSON.stringify(data)}` };
    }

    // Read image as arrayBuffer -> base64
    const buf = Buffer.from(await resp.arrayBuffer());
    const b64 = buf.toString("base64");

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ b64 }),
    };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: `Unhandled error: ${e.message}` };
  }
};
