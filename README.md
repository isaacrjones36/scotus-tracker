# SCOTUS Tracker

A web app that follows the U.S. Supreme Court's current term: the merits docket, the argument calendar, decisions, the emergency docket, the justices, term statistics, and news from SCOTUSblog and other outlets. It can be installed on a phone or computer like an app.

## How it keeps itself up to date

```
GitHub Actions (every 3 hours)          Netlify
  scripts/update.mjs                      serves site/
   ├─ Oyez API: grants, argument          (no build step)
   │   and decision dates, votes                │
   ├─ supremecourt.gov slip opinions            │  page loads
   └─ SCOTUSblog RSS feed                       ▼
        │                               browser fetches the latest
        ▼                               site/data/live.json from GitHub
  commits site/data/live.json  ───────────────▶ and merges it into the
  (only when something changed)                 saved data in index.html
```

- The workflow runs on GitHub's schedule. Nothing depends on Claude or on your computer being on.
- Data commits are tagged `[skip netlify]`, so they don't use Netlify deploys. The page reads the newest data straight from GitHub each time it opens, and every time you switch back to it.
- If a source is down, the job keeps that source's previous data. If GitHub can't be reached, the page uses the copy bundled with the site, and then the data saved inside `index.html`.
- When a new term opens in October, the job switches to the new term automatically.

## One-time Netlify setup

1. Sign in at [app.netlify.com](https://app.netlify.com).
2. Choose **Add new site → Import an existing project → GitHub**, and pick `scotus-tracker`.
3. Leave the build settings as Netlify fills them in from `netlify.toml` (publish directory `site`, no build command) and click **Deploy**.

After that, Netlify redeploys only when the app itself changes.

## Install it as an app

- **iPhone or iPad:** open the site in Safari, tap Share, then **Add to Home Screen**.
- **Android or desktop Chrome/Edge:** use the **Install app** button in the header, or the install icon in the address bar.

## Running the updater yourself

On GitHub, open **Actions → Update court data → Run workflow**. Locally:

```sh
node --test scripts/parse.test.mjs
node scripts/update.mjs
```

GitHub pauses scheduled workflows in repositories with no activity for 60 days. The daily data commits normally count as activity. If the schedule ever stops, re-enable it from the Actions tab.

## What updates automatically, and what doesn't

| Updates on its own | Edit `site/index.html` to change |
| --- | --- |
| Newly granted cases | Plain-language case summaries and topics |
| Argument dates once a case is argued, decision dates, votes and authors | Future argument dates (until the case is argued) |
| Opinion PDFs | Last term's landmark rulings and statistics |
| SCOTUSblog articles | Emergency docket entries and justice notes |

Case statuses also move forward by date on their own: a case scheduled for argument shows as argued once its argument day passes.
