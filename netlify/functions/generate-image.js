// netlify/functions/generate-image.js
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const HF_API_KEY = process.env.HF_API_KEY;
  const model = "stabilityai/stable-diffusion-2";
  if (!HF_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Missing HF_API_KEY" }) };

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };

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
      return { statusCode: r.status, body: JSON.stringify({ error: err }) };
    }

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const j = await r.json();
      const b64 =
        j?.image || j?.generated_image || j?.data?.[0]?.b64_json || j?.images?.[0] || j?.[0]?.b64_json;
      if (!b64) return { statusCode: 500, body: JSON.stringify({ error: "Unexpected JSON from model" }) };
      return { statusCode: 200, body: JSON.stringify({ image: `data:image/png;base64,${b64}` }) };
    }

    const buf = Buffer.from(await r.arrayBuffer());
    return { statusCode: 200, body: JSON.stringify({ image: `data:image/png;base64,${buf.toString("base64")}` }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
