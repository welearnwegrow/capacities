# Institute of Fog and Tide

A static website for the *Islands of Coherence* capacity framework — an interactive map, a curated resource library, and supporting pages.

## Pages
- `index.html` — the interactive map (home / entry point)
- `resources.html` — the Resource Library (resources across 24 capacities, type tags, Editor's Picks, suggest-a-resource)
- `metaprocess.html` — the Meta-process (five stages with downloadable reflection canvases)
- `engage.html` — Work with Us (contact form)
- `design.html` — Design a Learning Experience (coming soon)

Shared pieces: `SiteNav.dc.html`, `SiteFooter.dc.html`. Scripts: `support.js`, `research-data.js`, `forms-config.js`.

## Deploy to GitHub Pages
1. Create a repository and upload the **contents of this folder** so `index.html` sits at the repository root.
2. In the repo, go to **Settings → Pages → Source: Deploy from a branch**, choose `main` and `/ (root)`, then **Save**.
3. After a minute, your site is live at `https://<username>.github.io/<repo>/`.

## Important: must be served over http
The pages load the shared nav/footer and the resource data with `fetch()`. Browsers block `fetch()` on local files, so **opening `index.html` directly via `file://` (double-click) will show an empty nav/footer.** Always view it through a server:
- **GitHub Pages** (above), or
- a quick local server, e.g. from this folder run `python3 -m http.server` and open `http://localhost:8000`.

## How resources work (architecture)
This is a **fully static site** — there is no server or database. That keeps hosting free and simple, with two consequences:

- **All resources live in `research-data.js`** — a single file holding the `window.__RESEARCH` object (capacities, resources, their types, URLs, and which capacities each informs). This file *is* the database. To add or change a resource, edit it here and redeploy.
- **Editor's Picks (replaces upvoting):** add `"featured": true` to any resource in `research-data.js`. Featured resources sort to the top of their capacity's list and show a gold **★ Editor's pick** badge. This surfaces the strongest resources through curation rather than crowd voting (which would have required a shared database / backend).

### Suggested workflow when resources come in
1. A visitor uses **Suggest a resource** (or you collect them in **Notion**, a spreadsheet, wherever).
2. Submissions email to the editors via Web3Forms (below). **Notion is optional** — use it as your review queue if you like; nothing connects to it automatically.
3. Editors review, then add approved entries to `research-data.js` (optionally marking the best as `featured`) and redeploy.

So: everything displayed on the site is added **directly in `research-data.js`**. Notion (or any inbox/sheet) is just an optional holding pen for *review* before an editor commits an entry — it is not wired into the live site.

## Forms (Web3Forms — free, no server)
Both the **Suggest a resource** form and the **Work with Us** contact form send through [Web3Forms](https://web3forms.com).

**One-time setup:**
1. Go to web3forms.com, enter the email that should receive submissions, and copy the **Access Key**.
2. Open `forms-config.js` and paste it: `window.WEB3FORMS_ACCESS_KEY = "your-key-here";`

Until a key is set, the forms fall back to opening the visitor's email app (`mailto:`) so nothing is broken.

## Editing content text
All page text lives directly in the page files (`index.html`, `about.html`, etc.). Edit the file and redeploy to change copy permanently.

---
CC BY-NC-ND 4.0 · Jaya Ramchandani and Raisa Mirza
