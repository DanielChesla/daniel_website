// /api/run-tests.js
// Triggers the Playwright workflow via workflow_dispatch. Requires a GitHub
// token in the GH_DISPATCH_TOKEN env var (fine-grained PAT, repo daniel_website,
// Actions: Read and write). The token must stay server-side — never in the page.
export const config = { runtime: "nodejs" };

const REPO = "DanielChesla/daniel_website";
const WORKFLOW = "playwright.yml";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return res.status(500).json({ error: "GH_DISPATCH_TOKEN is not configured on the server." });

  // Which test group to run (must match the workflow's choice options).
  const ALLOWED = new Set(["all", "profile", "contact", "labs"]);
  let group = (req.query && req.query.group) || "all";
  if (!ALLOWED.has(group)) group = "all";

  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "danielchesla-site",
      },
      body: JSON.stringify({ ref: "main", inputs: { group } }),
    });
    if (r.status !== 204) {
      const detail = (await r.text()).slice(0, 300);
      return res.status(502).json({ error: `dispatch failed (HTTP ${r.status})`, detail });
    }
    return res.status(200).json({ ok: true, group, dispatchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
