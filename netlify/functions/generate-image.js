// Netlify Function: generate-image (CommonJS)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

module.exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: "Server misconfiguration: OPENAI_API_KEY is not set.",
      };
    }

    let prompt;
    try {
      ({ prompt } = JSON.parse(event.body || "{}"));
    } catch {
      return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid JSON body." };
    }
    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, headers: CORS_HEADERS, body: "Missing prompt." };
    }

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
        // response_format: "b64_json",
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: `OpenAI error ${resp.status}: ${text}`,
      };
    }

    let data;
    try { data = JSON.parse(text); }
    catch { return { statusCode: 500, headers: CORS_HEADERS, body: `OpenAI returned non-JSON: ${text}` }; }

    const url = data?.data?.[0]?.url;
    const b64 = data?.data?.[0]?.b64_json;
    if (!url && !b64) {
      return { statusCode: 500, headers: CORS_HEADERS, body: "OpenAI did not return an image." };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(url ? { url } : { b64 }),
    };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: `Unhandled server error: ${e.message}` };
  }
};
