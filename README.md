# Learning to Intervene in Complex Systems

A static website for a capacity framework on systems practice and lifelong learning — an interactive map, a curated resource library, and supporting pages.

## Pages
- `index.html` — interactive capacity map (home)
- `metaprocess.html` — Meta-process (five stages with downloadable reflection canvases)
- `orientations.html` — Orientations
- `resources.html` — Resource Library
- `resources.html` — Resource Library (includes the **Map the Library** tag-cloud overlay)
- `engage.html` — Partner with Us (contact form)
- `design.html` — Design a Learning Experience (coming soon)
- `privacy.html` — Privacy Policy

Shared nav/footer: `SiteNav.dc.html`, `SiteFooter.dc.html`. The tag map overlay lives in `tag-network.dc.html` (loaded by `resources.html`). Scripts: `support.js`, `research-data.js`, `data-loader.js`, `forms-config.js`, `capacity-detail.js`, `assess.js`, `analytics.js`.

## Deploy to GitHub Pages
1. Upload the **contents of this folder** so `index.html` sits at the repo root.
2. **Settings → Pages → Deploy from a branch** → `main` / `/ (root)` → **Save**.
3. Live at `https://<username>.github.io/<repo>/`.

## Must be served over http
Pages load the nav/footer and resource data with `fetch()`, which browsers block on `file://`. Opening `index.html` directly (double-click) shows an empty nav/footer. Use GitHub Pages, or a local server: `python3 -m http.server` from this folder, then open `http://localhost:8000`.

## Resources
There is no server or database. All resources live in `research-data.js` (the `window.__RESEARCH` object) — this file *is* the database. To add or change a resource, edit it here and redeploy. Mark the strongest with `"featured": true` to sort them to the top of their capacity and show a **★ Editor's pick** badge.

## Forms (Web3Forms)
The **Suggest a resource** and **Partner with Us** forms send through [Web3Forms](https://web3forms.com). Get an Access Key at web3forms.com and paste it into `forms-config.js`:
`window.WEB3FORMS_ACCESS_KEY = "your-key-here";`
Without a key, forms fall back to the visitor's email app (`mailto:`).

## Editing text
Page copy lives directly in each page file. Edit and redeploy to change it.

---
CC BY-NC-ND 4.0 · Jaya Ramchandani and Raisa Mirza
