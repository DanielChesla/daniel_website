// /api/test-status.js
// Reports the status of the most recent dispatched Playwright run created at/after
// ?since=<ISO>. When the run is complete, also returns parsed per-test results
// (read server-side from the published Pages report, avoiding CORS).
export const config = { runtime: "nodejs" };

const REPO = "DanielChesla/daniel_website";
const WORKFLOW = "playwright.yml";
const PAGES = "https://danielchesla.github.io/daniel_website";

function summarize(j) {
  let passed = 0, failed = 0;
  const tests = [];
  const walk = (s) => {
    (s.suites || []).forEach(walk);
    (s.specs || []).forEach((sp) => {
      sp.ok ? passed++ : failed++;
      const ms = sp.tests?.[0]?.results?.[0]?.duration || 0;
      tests.push({ title: sp.title, ok: !!sp.ok, ms });
    });
  };
  (j.suites || []).forEach(walk);
  return { passed, failed, total: passed + failed, tests };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const token = process.env.GH_DISPATCH_TOKEN;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "danielchesla-site" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const since = req.query.since ? Date.parse(req.query.since) : 0;

  try {
    const runsRes = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=10`,
      { headers }
    );
    if (!runsRes.ok) {
      const detail = (await runsRes.text()).slice(0, 200);
      return res.status(502).json({ error: `runs fetch failed (HTTP ${runsRes.status})`, detail });
    }
    const data = await runsRes.json();
    // Runs are newest-first. Take the newest one created at/after `since`
    // (15s buffer for clock skew); otherwise the new run hasn't appeared yet.
    const run = (data.workflow_runs || []).find(
      (r) => !since || Date.parse(r.created_at) >= since - 15000
    );
    if (!run) return res.status(200).json({ state: "pending" });

    const out = {
      state: run.status,            // queued | in_progress | completed
      conclusion: run.conclusion,   // success | failure | null
      runUrl: run.html_url,
      runId: run.id,
      createdAt: run.created_at,
    };

    if (run.status === "completed") {
      out.reportUrl = PAGES + "/";
      try {
        const rj = await fetch(`${PAGES}/results.json?cb=${Date.now()}`, {
          headers: { "User-Agent": "danielchesla-site" },
        });
        if (rj.ok) out.results = summarize(await rj.json());
      } catch { /* report may lag briefly; page can still link out */ }
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
