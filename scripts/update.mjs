// Refreshes site/data/live.json from public sources.
// Runs in GitHub Actions on a schedule (see .github/workflows/update.yml).
// Node 20+, no dependencies. Each source is independent: if one fails,
// the previous data for that source is kept.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseSlipOpinions, parseRss, normalizeOyezList, normalizeOyezCase, currentTerm } from "./parse.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "site", "data", "live.json");
const UA = "scotus-tracker (+https://github.com/isaacrjones36/scotus-tracker)";

async function get(url, type = "text") {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: type === "json" ? "application/json" : "*/*" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return type === "json" ? res.json() : res.text();
}

async function readPrevious() {
  try { return JSON.parse(await readFile(OUT, "utf8")); } catch { return {}; }
}

async function fromOyez(term) {
  const list = await get(`https://api.oyez.org/cases?per_page=0&filter=term:${term}`, "json");
  const cases = normalizeOyezList(list);
  // Pull vote details only for decided cases (few requests).
  for (const c of cases) {
    if (!c.decided || !c.href) continue;
    try {
      const detail = await get(c.href, "json");
      Object.assign(c, normalizeOyezCase(detail));
    } catch (e) { console.warn("oyez detail failed", c.docket, e.message); }
  }
  return cases;
}

async function fromSlipOpinions(term) {
  const yy = String(term).slice(-2);
  const html = await get(`https://www.supremecourt.gov/opinions/slipopinion/${yy}`);
  return parseSlipOpinions(html);
}

async function fromRss(url, source) {
  const xml = await get(url);
  return parseRss(xml, source);
}

async function main() {
  const prev = await readPrevious();
  const term = currentTerm(new Date());
  const out = {
    generatedAt: new Date().toISOString(),
    term,
    sources: {},
    cases: prev.term === term ? prev.cases || [] : [],
    opinions: prev.term === term ? prev.opinions || [] : [],
    articles: prev.articles || [],
  };

  const run = async (key, fn, assign) => {
    try {
      const data = await fn();
      if (Array.isArray(data) && data.length) assign(data);
      out.sources[key] = { ok: true, count: Array.isArray(data) ? data.length : 0 };
      console.log(`${key}: ${out.sources[key].count}`);
    } catch (e) {
      out.sources[key] = { ok: false, error: String(e.message || e).slice(0, 200) };
      console.warn(`${key} failed: ${e.message}`);
    }
  };

  await run("oyez", () => fromOyez(term), (d) => (out.cases = d));
  await run("opinions", () => fromSlipOpinions(term), (d) => (out.opinions = d));

  const feeds = [];
  await run("scotusblog", () => fromRss("https://www.scotusblog.com/feed/", "SCOTUSblog"), (d) => feeds.push(...d));
  if (feeds.length) {
    const seen = new Set();
    out.articles = feeds
      .filter((a) => a.link && !seen.has(a.link) && seen.add(a.link))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 40);
  }

  // Skip the write when nothing but the timestamp changed, so the repo stays quiet.
  const strip = (o) => JSON.stringify({ ...o, generatedAt: null, sources: null });
  if (strip(prev) === strip(out) && prev.generatedAt &&
      Date.now() - Date.parse(prev.generatedAt) < 24 * 3600e3) {
    console.log("No changes.");
    return;
  }
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log("Wrote", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
