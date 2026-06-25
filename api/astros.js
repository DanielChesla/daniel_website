// /api/astros.js
// HTTPS proxy for Open Notify's people-in-space feed, which is HTTP-only and
// therefore blocked as mixed content on HTTPS pages. Fetches it server-side
// and returns it with permissive CORS so client pages (e.g. the ISS tracker)
// can read the live crew.
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // Cache at the edge so we don't hammer the upstream on every page load.
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(204).end();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch("http://api.open-notify.org/astros.json", { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error("upstream HTTP " + r.status);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    clearTimeout(timer);
    return res.status(502).json({ error: "failed to fetch crew", detail: String(e.message || e) });
  }
}
