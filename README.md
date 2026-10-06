# Systems Change Learning Guide

An open-source capacity framework for systems change: an interactive map of 21 learning areas, a five-stage route for intervening in complex systems, a community-curated resource library, and the Systems Change Coach, an AI companion that helps people think through a situation they are working on.

Live at https://welearnwegrow.github.io/capacities/

## Pages

| File | What it is |
|---|---|
| `index.html` | Home. The question, three entry cards (route, library, talk to us), intro, the learning map (on phones: a list of the three groups with an "Explore as map" button that opens the map full screen), who it's for, this week's bookshelf, and the Coach built into the page. |
| `metaprocess.html` | Route. Probe, Sense, Design, Adapt, Integrate, each with a downloadable reflection canvas, followed by the Orientations that ground the work in shared values (`metaprocess.html#orientations`). |
| `resources.html` | Resource library, with the **Map the Library** tag network (`tag-network.dc.html`). |
| `explorer.html` | Systems Change Coach (full page). `explorer.html?demo=1` shows a pre-loaded example. |
| `engage.html` | About Us, with the Talk to Us contact form. |
| `descriptors.html` | Learning area descriptors. |
| `privacy.html` | Privacy policy. |

Shared pieces: `SiteNav.dc.html`, `SiteFooter.dc.html`, `FeaturedShelf.dc.html` (bookshelf on the home page and the Learning Resources page, same size on both), and `Guide Me.dc.html` (the Coach overlay, opened from the Guide Me button in the header on every page).

## Deploy (GitHub Pages)

1. Upload the **contents of this folder** so `index.html` sits at the repo root.
2. **Settings → Pages → Deploy from a branch** → `main` / `/ (root)` → **Save**.
3. Pages must be served over http(s). Opening a file directly (`file://`) leaves the nav, footer and data empty. To preview locally: `python3 -m http.server` in this folder, then open `http://localhost:8000`.

Search: `sitemap.xml` and `robots.txt` are included, and `google48527ddcdb42a048.html` verifies the site in Google Search Console. Keep all three at the root.

## Resources (Notion)

The library is a Notion database, read live through the Cloudflare Worker. `research-data.js` is a bundled fallback copy used only if the Worker can't be reached.

Columns that change how a resource appears:

- **Status**: only *Approved* rows show on the site. Suggestions from the site arrive as *Pending*.
- **Capacity**: the learning areas the resource is tagged to.
- **Type of resource**: Books, Methods & Toolkits, Courses, and others. Add **Open Source** for anything free to access; it shows as an *Open Source* badge.
- **Featured** (tick box): sorted first with a ★ Featured badge in every learning area it is tagged to, and eligible for the home page bookshelf.
- **Global South voices** (tick box): the resource is placed at the start of the home page bookshelf.

### This week's bookshelf

Each week the home page features one learning area (the week starts on Monday). It rotates only through areas that have at least one resource featured for them. The shelf shows only resources featured for that area, up to five, with Global South voices first. The panel colour follows the area's domain.

## Systems Change Coach & the Cloudflare Worker

The Coach and the live library both talk to a Cloudflare Worker (`connector/worker.js`). Its URL is set in `notion-config.js` as `window.NOTION_CONNECTOR_URL`. If that URL is wrong or the Worker is down, the library falls back to `research-data.js` and nothing is saved to Notion. **Check this first if Notion stops receiving rows.**

Endpoints:

- `GET /`: approved resources (including `featured` and `globalSouth`).
- `POST /`: a resource suggestion, saved to Notion as Pending.
- `POST /ai`: the Coach conversation (Claude).
- `POST /cases`: real-world cases to learn from (one web search per turn).
- `POST /log-query`: saves each Coach session to *Problem Statements from Guide Me*.
- `POST /log-feedback`: saves "Is this helping?" ratings and comments to *Guide Me Feedback*.

Environment variables (details in the header of `worker.js`): `NOTION_TOKEN`, `NOTION_DB_ID` (Resources), `QUERIES_DB_ID`, `FEEDBACK_DB_ID`, `ANTHROPIC_API_KEY`. Share each Notion database with the integration behind `NOTION_TOKEN`.

**After changing `worker.js`, redeploy it in Cloudflare.** Site changes that depend on new Worker fields don't take effect until then.

### Coach feedback
People are asked for feedback in three ways: an inline "Is this helping?" after the first map, a card when they close the Coach, and once when the mouse leaves the page (desktop only, and not when the Coach is built into the home page). A Yes or Not really click is saved straight away; the comment box is optional.

## Forms (Web3Forms)

**Talk to Us** (About Us page) sends through [Web3Forms](https://web3forms.com). Put your access key in `forms-config.js`:
`window.WEB3FORMS_ACCESS_KEY = "your-key-here";`
Without a key, the form opens the visitor's email app instead.

## Editing text

Page copy lives in each page file. Edit and redeploy to change it.

---
CC BY-NC-ND 4.0 · Jaya Ramchandani and Raisa Mirza
