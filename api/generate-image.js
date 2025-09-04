export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).send("Missing prompt");

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).send(`OpenAI error ${r.status}: ${t}`);
    }

    const data = await r.json();
    const url = data?.data?.[0]?.url;
    const b64 = data?.data?.[0]?.b64_json;

    if (url) return res.status(200).json({ url });
    if (b64) return res.status(200).json({ b64 });

    return res.status(500).send("No image returned");
  } catch (e) {
    return res.status(400).send(`Bad request: ${e.message}`);
  }
}
