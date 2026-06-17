(function () {
  // Shared "Edit text" mode for inside pages (About, Engage, Resource Library, etc.)
  // Discovers leaf text elements, lets the user toggle editing from a top-right button,
  // and persists edits in localStorage keyed by page + a stable DOM path.
  if (window.__iocEditModeLoaded) return;
  window.__iocEditModeLoaded = true;

  var PAGE = (location.pathname.split('/').pop() || 'index').replace(/\.dc\.html$/, '');
  var STORE_KEY = 'ioc-edit:' + decodeURIComponent(PAGE);
  var store = {};
  try { store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) {}
  var editing = false;
  var btn = null;

  var TEXT_TAGS = { H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, P:1, LI:1, SPAN:1, A:1, EM:1, STRONG:1, BLOCKQUOTE:1, FIGCAPTION:1, DIV:1 };

  function isLeafText(el) {
    var t = el.textContent;
    if (!t || !t.trim()) return false;
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 1) return false; // has an element child -> not a leaf
    }
    return true;
  }

  function skip(el) {
    if (!el || el.closest('.ioc-edit-ui')) return true;
    if (el.closest('nav')) return true;          // don't edit navigation
    if (el.closest('footer')) return true;        // shared footer
    if (el.isContentEditable && !el.hasAttribute('data-ioc-ed')) return true;
    return false;
  }

  function pathKey(el) {
    if (el.getAttribute('data-edit')) return 'de:' + el.getAttribute('data-edit');
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node.tagName !== 'BODY') {
      var p = node.parentNode;
      var idx = 1, sib = node;
      while ((sib = sib.previousElementSibling)) { if (sib.tagName === node.tagName) idx++; }
      parts.unshift(node.tagName + '[' + idx + ']');
      node = p;
    }
    return parts.join('>');
  }

  function collect() {
    var els = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,span,a,em,strong,blockquote,figcaption,div');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!TEXT_TAGS[el.tagName]) continue;
      if (skip(el)) continue;
      if (!isLeafText(el)) continue;
      out.push(el);
    }
    return out;
  }

  function applyStored() {
    var els = collect();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.setAttribute('data-ioc-ed', '1');
      var k = pathKey(el);
      if (store[k] != null && el.textContent !== store[k]) el.textContent = store[k];
    }
    return els;
  }

  function wire(el) {
    if (el._iocWired) return;
    el._iocWired = true;
    el.setAttribute('spellcheck', 'false');
    el.addEventListener('focus', function () { el.style.boxShadow = '0 0 0 2px rgba(154,106,74,.55)'; });
    el.addEventListener('blur', function () {
      el.style.boxShadow = 'none';
      store[pathKey(el)] = el.textContent;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && el.tagName !== 'P' && el.tagName !== 'LI') { ev.preventDefault(); el.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); el.blur(); }
    });
  }

  function setMode(on) {
    editing = on;
    var els = applyStored();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      wire(el);
      el.setAttribute('contenteditable', on ? 'true' : 'false');
      el.style.cursor = on ? 'text' : '';
      el.style.outline = on ? '1px dashed rgba(138,106,69,.6)' : 'none';
      el.style.outlineOffset = on ? '2px' : '';
      el.style.borderRadius = '3px';
    }
    if (btn) {
      btn.innerHTML = on ? '\u270E&nbsp;Done editing' : '\u270E&nbsp;Edit text';
      btn.style.background = on ? '#8a6a45' : 'rgba(252,251,247,0.95)';
      btn.style.color = on ? '#fff' : '#8a6a45';
      btn.style.border = on ? '1px solid #8a6a45' : '1px solid rgba(120,105,75,0.5)';
    }
    if (!on && document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ioc-ed')) {
      try { document.activeElement.blur(); } catch (e) {}
    }
  }

  function makeBtn() {
    if (btn) return;
    btn = document.createElement('button');
    btn.className = 'ioc-edit-ui ioc-noexport';
    btn.type = 'button';
    btn.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;display:flex;align-items:center;white-space:nowrap;font-family:\'PT Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:.01em;padding:12px 20px;border-radius:999px;cursor:pointer;border:1px solid rgba(120,105,75,0.5);background:rgba(252,251,247,0.97);color:#8a6a45;box-shadow:0 6px 20px rgba(70,55,35,0.28)';
    btn.innerHTML = '\u270E&nbsp;Edit text';
    btn.addEventListener('click', function () { setMode(!editing); });
    document.body.appendChild(btn);
  }

  function init(tries) {
    var els = collect();
    if (els.length < 2 && tries < 40) { // wait for DC content to stream in
      return requestAnimationFrame(function () { init(tries + 1); });
    }
    makeBtn();
    applyStored(); // restore saved edits even before entering edit mode
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(0); });
  } else {
    init(0);
  }
})();
