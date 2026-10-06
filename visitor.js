/* Visitor sign-in: asks once for name + email ("Before you begin"), logs it to
   Notion (Users & Feedback, Source = enter-site) and reuses it across the site:
   self-assessment, Guide Me, resource suggestions and the contact form. */
(function(){
  var KEY='ioc-visitor';
  function get(){
    try{ var v=JSON.parse(localStorage.getItem(KEY)||'null'); if(v&&v.e) return v; }catch(e){}
    try{ var a=JSON.parse(localStorage.getItem('ioc-assess-who')||'null'); if(a&&a.e&&a.n){ set(a.n,a.e,true); return {n:a.n,e:a.e}; } }catch(e){}
    return null;
  }
  function set(n,e,silent){
    try{
      localStorage.setItem(KEY,JSON.stringify({n:n,e:e}));
      localStorage.setItem('ioc-assess-who',JSON.stringify({n:n,e:e}));
      localStorage.setItem('gm_email',e);
    }catch(err){}
  }
  window.iocVisitor=get;

  function log(n,e){
    try{
      var base=window.NOTION_CONNECTOR_URL; if(!base||base.indexOf('<')>-1) return;
      fetch(base.replace(/\/$/,'')+'/log-feedback',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({topic:n,email:e,source:'enter-site',comment:'Entered the site'}),keepalive:true}).catch(function(){});
    }catch(err){}
  }

  // Prefill known name/email fields wherever they appear
  var FIELDS={'ioc-sr-name':'n','ioc-sr-email':'e','ioc-eg-name':'n','ioc-eg-email':'e','gm-fb-email':'e','gm-gate-email':'e'};
  function fill(){
    var v=get(); if(!v) return;
    for(var id in FIELDS){ var el=document.getElementById(id); if(el&&!el.value&&!el.__iocFilled){ el.value=v[FIELDS[id]]||''; el.__iocFilled=true; } }
  }

  function gate(){
    if(document.getElementById('ioc-visitor-gate')) return;
    var ov=document.createElement('div');
    ov.id='ioc-visitor-gate';
    ov.style.cssText='position:fixed;inset:0;z-index:120;background:rgba(31,46,42,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto';
    var inp='width:100%;box-sizing:border-box;font-family:PT Sans,sans-serif;font-size:15px;padding:12px 14px;border:1px solid rgba(70,90,85,.3);border-radius:11px;background:#fffdf8;color:#2E2B26';
    var pre=''; try{ pre=localStorage.getItem('gm_email')||''; }catch(e){}
    ov.innerHTML='<form style="width:100%;max-width:440px;background:#fbf8f1;border:1px solid rgba(176,130,47,.35);border-radius:20px;padding:30px 28px 24px;box-shadow:0 24px 60px rgba(20,30,25,.3);font-family:PT Sans,sans-serif;display:flex;flex-direction:column;gap:14px">'+
      '<div style="display:flex;align-items:center;gap:10px"><img src="favicon.png" alt="" style="width:34px;height:34px"><span style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a7a4a">Systems Change Learning Guide</span></div>'+
      '<div style="font-family:Newsreader,serif;font-size:30px;line-height:1.1;color:#1f3a36">Before you begin</div>'+
      '<p style="margin:0;font-size:14.5px;line-height:1.6;color:#4a5752">This guide is free and open. We ask for your name and email once, so we can understand who is using it and follow up with updates. You will not be asked again for the Coach, the self-assessment or suggesting a resource.</p>'+
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#46514a">Name<input name="n" required autocomplete="name" style="'+inp+'"></label>'+
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#46514a">Email<input name="e" type="email" required autocomplete="email" style="'+inp+'"></label>'+
      '<div data-err style="display:none;font-size:12.5px;color:#9a4a2d">Please enter your name and a valid email address.</div>'+
      '<button type="submit" style="margin-top:4px;font-family:PT Sans,sans-serif;font-size:15.5px;font-weight:700;color:#fff;background:#46716f;border:none;border-radius:26px;padding:14px 22px;cursor:pointer;box-shadow:0 8px 20px rgba(70,113,111,.3)">Enter site →</button>'+
      '<p style="margin:0;font-size:12px;line-height:1.5;color:#7a8a83;text-align:center">See our <a href="privacy.html" style="color:#46716f">privacy policy</a>.</p></form>';
    document.body.appendChild(ov);
    var f=ov.querySelector('form'); if(pre) f.e.value=pre;
    setTimeout(function(){ try{ f.n.focus(); }catch(e){} },50);
    f.addEventListener('submit',function(ev){
      ev.preventDefault();
      var n=f.n.value.trim(), e=f.e.value.trim();
      if(!n||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){ ov.querySelector('[data-err]').style.display='block'; return; }
      set(n,e); log(n,e);
      if(window.track){ try{ window.track('enter_site'); }catch(err){} }
      ov.remove(); fill();
      try{ document.querySelectorAll('iframe[src*="explorer"]').forEach(function(fr){ fr.src=fr.src; }); }catch(err){}
      if(document.getElementById('gm-gate-email')) location.reload();
    });
  }

  function start(){
    var path=location.pathname.toLowerCase();
    var embedded=window.self!==window.top || /[?&]embed=1/.test(location.search);
    var exempt=/privacy\.(dc\.)?html$/.test(path);
    if(!get() && !embedded && !exempt) gate();
    fill();
    try{ new MutationObserver(fill).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
