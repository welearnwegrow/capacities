# Systems Change Learning Guide

A static website for a capacity framework on systems practice and lifelong learning — an interactive map, a curated resource library, an AI "Guide Me" companion, and supporting pages.

## Pages
- `index.html` — interactive capacity map (home)
- `metaprocess.html` — Route / Meta-process (five stages with downloadable reflection canvases)
- `orientations.html` — Orientations
- `resources.html` — Resource Library (includes the **Map the Library** tag-cloud overlay)
- `explorer.html` — **Guide Me** (AI companion: talk through a system and get matched to learning areas, Route steps, resources, and real-world cases)
- `engage.html` — Partner with Us (contact form)
- `privacy.html` — Privacy Policy
- `descriptors.html` — capacity descriptors reference

Shared nav/footer: `SiteNav.dc.html`, `SiteFooter.dc.html`. The **Guide Me** launcher (`Guide Me.dc.html`) opens `explorer.html` in an overlay. The tag map overlay lives in `tag-network.dc.html` (loaded by `resources.html`). Scripts: `support.js`, `research-data.js`, `data-loader.js`, `forms-config.js`, `capacity-detail.js`, `assess.js`, `analytics.js`, `notion-config.js`.

## Deploy to GitHub Pages
1. Upload the **contents of this folder** so `index.html` sits at the repo root.
2. **Settings → Pages → Deploy from a branch** → `main` / `/ (root)` → **Save**.
3. Live at `https://<username>.github.io/<repo>/`.

## Must be served over http
Pages load the nav/footer and resource data with `fetch()`, which browsers block on `file://`. Opening `index.html` directly (double-click) shows an empty nav/footer. Use GitHub Pages, or a local server: `python3 -m http.server` from this folder, then open `http://localhost:8000`.

## Resources
There is no bundled database for the library. All resources live in `research-data.js` (the `window.__RESEARCH` object) — this file *is* the resource database. To add or change a resource, edit it here and redeploy. Mark the strongest with `"featured": true` to sort them to the top of their capacity and show a **★ Editor's pick** badge. (The Cloudflare Worker can also serve a live Notion-backed resource list — see below.)

## Guide Me & the Cloudflare Worker
**Guide Me** (`explorer.html`) talks to a Cloudflare Worker (`connector/worker.js`). Set `window.NOTION_CONNECTOR_URL` in `notion-config.js` to the deployed Worker URL. Without it, Guide Me falls back to on-device keyword matching and search links.

Worker endpoints:
- `POST /ai` — proxied Claude completion (Guide Me's conversation).
- `POST /cases` — web-search-grounded **Other cases to learn from**: 3 verified real-world cases (first two bioregionally close to the person's situation, the third the strongest match from anywhere), de-duplicated against the resources already suggested.
- `POST /log-query` — logs a Guide Me query to Notion.
- `POST /log-feedback` — saves the on-close feedback card (rating, comment, optional email) to Notion.
- `GET /` / `POST /` — read / suggest resources from a Notion Resources DB.
- `POST /subscribe` — newsletter signup.

Worker env vars (see the header of `connector/worker.js`): `NOTION_TOKEN`, `NOTION_DB_ID` (Resources), `QUERIES_DB_ID`, `FEEDBACK_DB_ID` (Guide Me feedback), `ANTHROPIC_API_KEY`. Each Notion database must be shared with the integration used by `NOTION_TOKEN`.

## Forms (Web3Forms)
The **Suggest a resource** and **Partner with Us** forms send through [Web3Forms](https://web3forms.com). Get an Access Key at web3forms.com and paste it into `forms-config.js`:
`window.WEB3FORMS_ACCESS_KEY = "your-key-here";`
Without a key, forms fall back to the visitor's email app (`mailto:`).

## Editing text
Page copy lives directly in each page file. Edit and redeploy to change it.

---
CC BY-NC-ND 4.0 · Jaya Ramchandani and Raisa Mirza
