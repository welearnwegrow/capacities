# Systems Change Learning Design Studio

A static website for the *Islands of Coherence* capacity framework — an interactive map, a curated resource library, and supporting pages.

## Pages
- `index.html` — the interactive map (home / entry point)
- `resources.html` — the Resource Library (89 resources across 24 capacities, upvoting, suggest-a-resource)
- `about.html` — Co-Editors & Contributors
- `engage.html` — Work with Us (contact form)
- `design.html` — Design a Learning Experience (coming soon)

Shared pieces: `SiteNav.dc.html`, `SiteFooter.dc.html`. Scripts: `support.js`, `research-data.js`, `edit-mode.js`.

## Deploy to GitHub Pages
1. Create a repository and upload the **contents of this folder** so `index.html` sits at the repository root.
2. In the repo, go to **Settings → Pages → Source: Deploy from a branch**, choose `main` and `/ (root)`, then **Save**.
3. After a minute, your site is live at `https://<username>.github.io/<repo>/`.

## Important: must be served over http
The pages load the shared nav/footer and the resource data with `fetch()`. Browsers block `fetch()` on local files, so **opening `index.html` directly via `file://` (double-click) will show an empty nav/footer.** Always view it through a server:
- **GitHub Pages** (above), or
- a quick local server, e.g. from this folder run `python3 -m http.server` and open `http://localhost:8000`.

## Editing content
- **Text:** open any page and click the floating **Edit text** button (bottom-right). Edits save to the viewer's browser only — for permanent changes, edit the source files.
- **Resources:** edit `research-data.js` (the `window.__RESEARCH` object — capacities, resources, types, URLs).
- **Contact / suggestions:** the forms open the visitor's email app addressed to the editors. To collect submissions automatically instead, wire a form service (e.g. Formspree).

---
CC BY-NC-ND 4.0 · Jaya Ramchandani and Raisa Mirza
