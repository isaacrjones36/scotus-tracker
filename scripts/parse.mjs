// Pure parsing helpers (no network), shared by update.mjs and the tests.

export function currentTerm(d) {
  // The Court's term opens the first Monday in October.
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…" };
export function decode(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export const stripTags = (s = "") => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

const isoDay = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

// supremecourt.gov/opinions/slipopinion/NN — table rows: R-, Date, Docket, Name, Revised, J., Pt.
export function parseSlipOpinions(html) {
  const out = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []);
    if (cells.length < 4) continue;
    const text = cells.map(stripTags);
    const di = text.findIndex((t) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t));
    if (di < 0) continue;
    const docket = text[di + 1];
    if (!/^\d{2}[-A]\d+/i.test(docket || "")) continue;
    const href = (row.match(/href=["']([^"']*\.pdf[^"']*)["']/i) || [])[1];
    const [m, d, y] = text[di].split("/").map(Number);
    const year = y < 100 ? 2000 + y : y;
    // The justice column holds initials (e.g. "G", "KB", "PC"); its position varies by year.
    const judge = text.slice(di + 3).find((t) => /^[A-Z]{1,3}$/.test(t)) || "";
    out.push({
      date: `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      docket: docket.split(/\s|,/)[0],
      name: text[di + 2],
      author: judge,
      pdf: href ? new URL(href, "https://www.supremecourt.gov/opinions/").href : null,
    });
  }
  return out;
}

// Standard RSS 2.0
export function parseRss(xml, source) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const tag = (s, t) => { const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i")); return m ? decode(m[1]).trim() : ""; };
  return items.map((it) => {
    const date = tag(it, "pubDate");
    const t = Date.parse(date);
    return {
      title: stripTags(tag(it, "title")),
      link: tag(it, "link").trim(),
      date: Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10),
      author: stripTags(tag(it, "dc:creator")),
      summary: stripTags(tag(it, "description")).slice(0, 240),
      source,
    };
  }).filter((a) => a.title && /^https?:\/\//.test(a.link));
}

// api.oyez.org/cases?filter=term:YYYY
export function normalizeOyezList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => {
    const ev = {};
    for (const t of c.timeline || []) {
      if (t && t.event && Array.isArray(t.dates) && t.dates.length) ev[t.event.toLowerCase()] = isoDay(t.dates[0]);
    }
    return {
      docket: String(c.docket_number || "").trim(),
      name: stripTags(c.name || ""),
      granted: ev.granted || null,
      argued: ev.argued || ev.reargued || null,
      decided: ev.decided || null,
      question: stripTags(c.question || c.description || "").slice(0, 400) || null,
      href: c.href || null,
      oyez: c.href ? c.href.replace("api.oyez.org", "www.oyez.org") : null,
    };
  }).filter((c) => c.docket && c.name);
}

// api.oyez.org/cases/YYYY/DOCKET detail
export function normalizeOyezCase(d) {
  const dec = (d && Array.isArray(d.decisions) && d.decisions[0]) || null;
  const out = {};
  if (dec && Number.isFinite(dec.majority_vote)) out.vote = `${dec.majority_vote}–${dec.minority_vote ?? 0}`;
  if (dec && dec.winning_party) out.winner = stripTags(dec.winning_party);
  const maj = (d && Array.isArray(d.written_opinion) ? d.written_opinion : [])
    .find((o) => /majority|plurality|per curiam/i.test(o?.type?.value || o?.type?.label || ""));
  if (maj && maj.judge_full_name) out.authorName = maj.judge_full_name;
  if (d && d.conclusion) out.conclusion = stripTags(d.conclusion).slice(0, 400);
  return out;
}
