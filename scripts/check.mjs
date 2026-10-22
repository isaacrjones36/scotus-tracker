// Opens the site in headless Chromium, captures screenshots of every tab at
// desktop and phone widths in light and dark themes, and records console errors.
// Used by .github/workflows/check.yml. Requires: npm i playwright && npx playwright install chromium
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.BASE_URL || "http://localhost:8080/";
const OUT = "screens";
const tabs = ["overview", "docket", "calendar", "decisions", "emergency", "justices", "stats", "reading"];
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];
for (const [label, viewport, scheme] of [
  ["desktop-light", { width: 1280, height: 900 }, "light"],
  ["phone-dark", { width: 390, height: 844 }, "dark"],
]) {
  const page = await browser.newPage({ viewport, colorScheme: scheme });
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${label}] console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  await page.goto(BASE + "#overview", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const live = await page.textContent("#liveText");
  problems.push(`[${label}] status pill: ${live}`);
  for (const t of tabs) {
    await page.click(`[data-tab="${t}"]`);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) problems.push(`[${label}] ${t}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `${OUT}/${label}-${t}.png`, fullPage: t !== "docket" && t !== "reading" });
  }
  // Open a case
  await page.click('[data-tab="docket"]');
  await page.click('#caseGrid [data-case]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${label}-dialog.png` });
  await page.close();
}
await browser.close();
await writeFile(`${OUT}/report.txt`, problems.join("\n") + "\n");
console.log(problems.join("\n"));
