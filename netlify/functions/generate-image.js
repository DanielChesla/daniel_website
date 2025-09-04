export const handler = async (event) => {
  const HF_API_KEY = process.env.HF_API_KEY;
  const model = "stabilityai/stable-diffusion-2"; // free model on Hugging Face

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, body: JSON.stringify({ error: err }) };
    }

    // Hugging Face returns binary image data
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: `data:image/png;base64,${base64}` }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
