/* ─────────────────────────────────────────────────────────────
 *  Notion live-data connector URL.
 *
 *  Leave EMPTY ("") and the site reads the bundled research-data.js
 *  exactly like before — nothing breaks.
 *
 *  After you deploy the Cloudflare Worker (see connector/SETUP.md),
 *  paste its URL between the quotes, e.g.
 *      window.NOTION_CONNECTOR_URL = "https://ioc-notion.<you>.workers.dev";
 *  then redeploy the site. The Resource Library will read live from
 *  Notion, falling back to the bundled file if the connector is down.
 * ───────────────────────────────────────────────────────────── */
window.NOTION_CONNECTOR_URL = "https://capacities.jayajohnyramchandani.workers.dev";
