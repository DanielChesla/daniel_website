// Netlify Function: generate-image
// Expects: POST { "prompt": "..." }
// Returns: { url }  (or { b64 } if you switch response_format below)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",              // or set your domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: "Method Not Allowed",
    };
  }

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, headers: CORS_HEADERS, body: "Missing prompt" };
    }

    // Call OpenAI Images API
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
        // If you prefer base64 back, uncomment the next line:
        // response_format: "b64_json",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: `OpenAI error ${resp.status}: ${text}`,
      };
    }

    const data = await resp.json();
    const url = data?.data?.[0]?.url;
    const b64 = data?.data?.[0]?.b64_json;

    const body = url ? JSON.stringify({ url }) :
                 b64 ? JSON.stringify({ b64 }) :
                 JSON.stringify({ error: "No image returned" });

    return { statusCode: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, body };
  } catch (e) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: `Bad request: ${e.message}`,
    };
  }
};
