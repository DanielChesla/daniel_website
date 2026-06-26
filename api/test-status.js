// /api/test-status.js
// Reports the status of the dispatched Playwright run identified by ?nonce=.
// Results are read PER-RUN from that run's uploaded artifact (not a shared
// report), so concurrent users never see each other's results.
export const config = { runtime: "nodejs" };

import zlib from "zlib";

const REPO = "DanielChesla/daniel_website";
const WORKFLOW = "playwright.yml";

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

// Minimal, dependency-free ZIP reader: extract the first entry whose name ends
// with `suffix` from an artifact zip (reads the central directory for safety).
function extractFromZip(buf, suffix) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd === -1) throw new Error("no end-of-central-directory");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name.endsWith(suffix)) {
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const comp = buf.subarray(start, start + compSize);
      const raw = method === 0 ? comp : zlib.inflateRawSync(comp);
      return raw.toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(suffix + " not found in artifact");
}

async function readResultsFromArtifact(runId, headers) {
  const aRes = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${runId}/artifacts`, { headers });
  if (!aRes.ok) return null;
  const artifact = (await aRes.json()).artifacts?.find((a) => a.name === "playwright-report");
  if (!artifact) return null;
  const zres = await fetch(`https://api.github.com/repos/${REPO}/actions/artifacts/${artifact.id}/zip`, { headers });
  if (!zres.ok) return null;
  const buf = Buffer.from(await zres.arrayBuffer());
  return summarize(JSON.parse(extractFromZip(buf, "results.json")));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const token = process.env.GH_DISPATCH_TOKEN;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "danielchesla-site" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const nonce = (req.query && req.query.nonce) || "";
  if (!nonce) return res.status(400).json({ error: "missing nonce" });

  try {
    const runsRes = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=30`,
      { headers }
    );
    if (!runsRes.ok) {
      const detail = (await runsRes.text()).slice(0, 200);
      return res.status(502).json({ error: `runs fetch failed (HTTP ${runsRes.status})`, detail });
    }
    // Find this client's own run by the nonce carried in the run name.
    const run = (await runsRes.json()).workflow_runs?.find(
      (r) => (r.display_title || r.name || "").includes(nonce)
    );
    if (!run) return res.status(200).json({ state: "pending" });

    const out = {
      state: run.status,            // queued | in_progress | completed
      conclusion: run.conclusion,   // success | failure | cancelled | null
      runUrl: run.html_url,
      runId: run.id,
      resultsReady: false,
    };

    if (run.status === "completed") {
      try {
        const results = await readResultsFromArtifact(run.id, headers);
        if (results) { out.results = results; out.resultsReady = true; }
      } catch { /* artifact not retrievable; page can still link to the run */ }
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
