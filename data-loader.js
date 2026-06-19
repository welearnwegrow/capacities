/* ─────────────────────────────────────────────────────────────
 *  Live data loader.
 *  Runs after research-data.js (the bundled fallback) and notion-config.js.
 *  If a connector URL is set, it fetches the live Notion data and swaps it
 *  into window.__RESEARCH, then tells the page to re-render. If anything
 *  fails, the bundled copy stays in place so the site never breaks.
 * ───────────────────────────────────────────────────────────── */
(function () {
  var url = (typeof window !== "undefined" && window.NOTION_CONNECTOR_URL) || "";
  if (!url) return; // no connector configured → bundled fallback only

  fetch(url, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!data || !Array.isArray(data.resources) || !data.resources.length) {
        throw new Error("empty or malformed payload");
      }
      window.__RESEARCH = window.__RESEARCH || { capacities: [], resources: [] };
      window.__RESEARCH.resources = data.resources;
      if (Array.isArray(data.capacities) && data.capacities.length) {
        window.__RESEARCH.capacities = data.capacities;
      }
      window.__RESEARCH_LIVE_READY = true;
      window.dispatchEvent(new Event("research-data-updated"));
    })
    .catch(function (e) {
      console.warn("[Notion] live data unavailable — using bundled copy:", e.message);
    });
})();
