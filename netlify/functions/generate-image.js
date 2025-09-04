// netlify/functions/generate-image.js
export const handler = async (event) => {
  const HF_API_KEY = process.env.HF_API_KEY;
  const model = "stabilityai/stable-diffusion-2"; // free HF model

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        // This tells HF to wait for the model to spin up instead of 503 "loading"
        "x-wait-for-model": "true",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!r.ok) {
      const ct = r.headers.get("content-type") || "";
      const errText = ct.includes("application/json") ? JSON.stringify(await r.json()) : await r.text();
      return { statusCode: r.status, body: JSON.stringify({ error: errText }) };
    }

    const ct = (r.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("application/json")) {
      // Some pipelines return JSON with base64 in a field; try common shapes
      const j = await r.json();
      const b64 =
        j?.image ||
        j?.generated_image ||
        j?.data?.[0]?.b64_json ||
        j?.images?.[0] ||
        j?.[0]?.b64_json;

      if (!b64) {
        return { statusCode: 500, body: JSON.stringify({ error: "Unexpected JSON response from model" }) };
      }
      return { statusCode: 200, body: JSON.stringify({ image: `data:image/png;base64,${b64}` }) };
    }

    // Otherwise it's binary image data
    const arrayBuffer = await r.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      statusCode: 200,
      body: JSON.stringify({ image: `data:image/png;base64,${base64}` }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
