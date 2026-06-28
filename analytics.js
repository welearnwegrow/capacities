/* Google Analytics 4 — loaded on every page. */
(function () {
  var ID = "G-MDFVRJ2KTQ";
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", ID);

  /* Lightweight custom-event tracker. Safe to call before GA finishes loading
     (gtag queues into dataLayer). Usage: track('download_map', {label:'…'}) */
  window.track = function (name, params) {
    try { window.gtag("event", name, params || {}); } catch (e) {}
  };
})();
