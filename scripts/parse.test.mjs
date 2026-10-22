// Run with: node --test scripts/
import test from "node:test";
import assert from "node:assert/strict";
import { parseSlipOpinions, parseRss, normalizeOyezList, normalizeOyezCase, currentTerm } from "./parse.mjs";

test("currentTerm rolls over in October", () => {
  assert.equal(currentTerm(new Date("2026-09-30T12:00:00Z")), 2025);
  assert.equal(currentTerm(new Date("2026-10-01T12:00:00Z")), 2026);
  assert.equal(currentTerm(new Date("2027-06-30T12:00:00Z")), 2026);
});

test("slip opinion rows", () => {
  const html = `<table><tr><th>R-</th><th>Date</th></tr>
  <tr><td>1</td><td>10/14/26</td><td>26A476</td><td><a href="26pdf/26a476_k537.pdf" title="">FCC v. Brown</a></td><td></td><td>PC</td><td>601/1</td></tr>
  <tr><td>2</td><td>11/20/26</td><td>25-170</td><td><a href="26pdf/25-170_abcd.pdf">Suncor Energy (U.S.A.) Inc. v. Commissioners of Boulder Cty.</a></td><td></td><td>G</td><td>601/1</td></tr></table>`;
  const r = parseSlipOpinions(html);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { date: "2026-10-14", docket: "26A476", name: "FCC v. Brown", author: "PC", pdf: "https://www.supremecourt.gov/opinions/26pdf/26a476_k537.pdf" });
  assert.equal(r[1].author, "G");
  // Layout without a "Revised" column, with a query string on the PDF link.
  const alt = parseSlipOpinions(`<tr><td>1</td><td>10/14/26</td><td>26A476</td><td><a href='/opinions/26pdf/26a476_k537.pdf?v=2'>FCC v. Brown</a></td><td>PC</td><td>610/1</td></tr>`);
  assert.equal(alt[0].author, "PC");
  assert.equal(alt[0].pdf, "https://www.supremecourt.gov/opinions/26pdf/26a476_k537.pdf?v=2");
});

test("rss items", () => {
  const xml = `<rss><channel><item><title>Justices grant two &amp; more</title><link>https://www.scotusblog.com/2026/10/x/</link>
  <pubDate>Tue, 20 Oct 2026 13:00:00 +0000</pubDate><dc:creator><![CDATA[Kelsey Dallas]]></dc:creator><description><![CDATA[<p>Hello <b>world</b></p>]]></description></item></channel></rss>`;
  const [a] = parseRss(xml, "SCOTUSblog");
  assert.equal(a.title, "Justices grant two & more");
  assert.equal(a.date, "2026-10-20");
  assert.equal(a.author, "Kelsey Dallas");
  assert.equal(a.summary, "Hello world");
});

test("oyez list and detail", () => {
  const list = [{ name: "Suncor Energy v. Boulder County", docket_number: "25-170", href: "https://api.oyez.org/cases/2026/25-170",
    timeline: [{ event: "Granted", dates: [1771804800] }, { event: "Argued", dates: [1791158400] }], question: "<p>Whether...</p>" }];
  const [c] = normalizeOyezList(list);
  assert.equal(c.docket, "25-170");
  assert.equal(c.granted, "2026-02-23");
  assert.equal(c.argued, "2026-10-05");
  assert.equal(c.question, "Whether...");
  assert.equal(c.oyez, "https://www.oyez.org/cases/2026/25-170");
  const d = normalizeOyezCase({ decisions: [{ majority_vote: 6, minority_vote: 3, winning_party: "Suncor" }],
    written_opinion: [{ type: { value: "majority" }, judge_full_name: "Neil Gorsuch" }] });
  assert.deepEqual(d, { vote: "6–3", winner: "Suncor", authorName: "Neil Gorsuch" });
  assert.deepEqual(normalizeOyezList(null), []);
});
