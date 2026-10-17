/* Visitor sign-in. Every browser gets a Visitor ID on arrival; all logs to Notion
   carry it. After 3 minutes of active use the "Keep going" form asks for name +
   email (no way to dismiss). On submit, /identify fills the name and email into
   every earlier row with that Visitor ID. Details are reused across the site. */
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
  var VID='ioc-vid', ACT='ioc-active-ms', LIMIT=180000;
  function uuid(){ try{ if(window.crypto&&crypto.randomUUID) return crypto.randomUUID(); }catch(e){} return 'v-'+Date.now().toString(16)+'-'+Math.random().toString(16).slice(2); }
  function vid(){ try{ var x=localStorage.getItem(VID); if(!x){ x=uuid(); localStorage.setItem(VID,x); } return x; }catch(e){ return ''; } }
  window.iocVisitorId=vid;
  function connector(){ var b=window.NOTION_CONNECTOR_URL; return (!b||b.indexOf('<')>-1)?'':b.replace(/\/+$/,''); }

  // Stamp the Visitor ID onto every log the site sends, whoever sends it.
  try{
    var _f=window.fetch.bind(window);
    window.fetch=function(url,opts){
      try{
        var u=String((url&&url.url)||url||''), b=connector();
        if(b && u.indexOf(b)===0 && /\/log-(feedback|query)$/.test(u.split('?')[0]) && opts && typeof opts.body==='string'){
          var o=JSON.parse(opts.body);
          if(o && !o.visitorId){ o.visitorId=vid(); opts=Object.assign({},opts,{body:JSON.stringify(o)}); }
        }
      }catch(e){}
      return _f(url,opts);
    };
  }catch(e){}

  window.iocLogAction=function(source,comment){ try{ var w=get()||{}; var base=connector(); if(!base) return; fetch(base+'/log-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:w.n||'Anonymous visitor',email:w.e||'',source:source,comment:comment}),keepalive:true}).catch(function(){}); }catch(err){} };

  function identify(n,e,r,u){
    try{ var base=connector(); if(!base) return;
      fetch(base+'/identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:vid(),name:n,email:e,referredBy:r||'',emailUpdates:u?'Yes':'No'}),keepalive:true}).catch(function(){});
    }catch(err){}
  }

  function log(n,e,r,u){
    try{
      var base=window.NOTION_CONNECTOR_URL; if(!base||base.indexOf('<')>-1) return;
      fetch(base.replace(/\/$/,'')+'/log-feedback',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({topic:n,email:e,source:'enter-site',comment:'Entered the site',referredBy:r||'',emailUpdates:u?'Yes':'No'}),keepalive:true}).catch(function(){});
    }catch(err){}
  }

  // Prefill known name/email fields wherever they appear
  var FIELDS={'ioc-sr-name':'n','ioc-sr-email':'e','ioc-eg-name':'n','ioc-eg-email':'e','gm-fb-email':'e','gm-gate-email':'e'};
  function fill(){
    var v=get(), who=document.getElementById('ioc-eg-who');
    if(who) who.style.display=v?'none':'flex';
    if(!v) return;
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
      '<div style="font-family:Newsreader,serif;font-size:30px;line-height:1.1;color:#1f3a36">Keep going</div>'+
      '<p style="margin:0;font-size:14.5px;line-height:1.6;color:#4a5752">You\'ve been exploring for a few minutes. This guide is free and open to anyone learning to change complex systems. To keep using it, please introduce yourself. This browser will remember you, and what you\'ve done here so far will be saved under your name.</p>'+
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#46514a">Name<input name="n" required autocomplete="name" style="'+inp+'"></label>'+
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#46514a">Email<input name="e" type="email" required autocomplete="email" style="'+inp+'"></label>'+
      '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#46514a"><span>Who sent you here? <span style="font-weight:400;color:#7a8a83">(optional)</span></span><input name="r" placeholder="A person, organization or link" style="'+inp+'"></label>'+
      '<label style="display:flex;align-items:flex-start;gap:9px;font-size:13.5px;line-height:1.45;color:#46514a;cursor:pointer"><input name="u" type="checkbox" checked style="width:17px;height:17px;margin:1px 0 0;flex:none;accent-color:#46716f">Keep me posted by email as the guide grows. Untick to opt out.</label>'+
      '<div data-err style="display:none;font-size:12.5px;color:#9a4a2d">Please enter your name and a valid email address.</div>'+
      '<button type="submit" style="margin-top:4px;font-family:PT Sans,sans-serif;font-size:15.5px;font-weight:700;color:#fff;background:#46716f;border:none;border-radius:26px;padding:14px 22px;cursor:pointer;box-shadow:0 8px 20px rgba(70,113,111,.3)">Continue →</button>'+
      '<p style="margin:0;font-size:12px;line-height:1.5;color:#7a8a83;text-align:center">See our <a href="privacy.html" style="color:#46716f">privacy policy</a>.</p></form>';
    document.body.appendChild(ov);
    var f=ov.querySelector('form'); if(pre) f.e.value=pre;
    setTimeout(function(){ try{ f.n.focus(); }catch(e){} },50);
    f.addEventListener('submit',function(ev){
      ev.preventDefault();
      var n=f.n.value.trim(), e=f.e.value.trim(), r=(f.r.value||'').trim().slice(0,300), u=!!f.u.checked;
      if(!n||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){ ov.querySelector('[data-err]').style.display='block'; return; }
      set(n,e); log(n,e,r,u); identify(n,e,r,u);
      if(window.track){ try{ window.track('enter_site'); }catch(err){} }
      ov.remove(); fill();
    });
  }

  // Counts active time only: tab visible and some interaction in the last minute.
  // Stored in the browser so it carries across pages and visits.
  function timer(){
    var last=Date.now(), mark=function(){ last=Date.now(); };
    ['pointermove','pointerdown','keydown','scroll','wheel','touchstart'].forEach(function(t){ window.addEventListener(t,mark,{passive:true,capture:true}); });
    window.addEventListener('message',function(ev){ if(ev&&ev.data&&ev.data.iocActive) mark(); });
    var used=0; try{ used=+localStorage.getItem(ACT)||0; }catch(e){}
    if(used>=LIMIT){ gate(); return; }
    var t=setInterval(function(){
      if(get()){ clearInterval(t); return; }
      if(document.visibilityState!=='visible' || Date.now()-last>60000) return;
      try{ used=Math.max(used,+localStorage.getItem(ACT)||0)+1000; localStorage.setItem(ACT,String(used)); }catch(e){ used+=1000; }
      if(used>=LIMIT){ clearInterval(t); gate(); }
    },1000);
  }

  function start(){
    var path=location.pathname.toLowerCase();
    var embedded=window.self!==window.top || /[?&]embed=1/.test(location.search);
    var exempt=/privacy\.(dc\.)?html$/.test(path);
    if(embedded){ var ping=0; ['pointerdown','keydown','scroll','pointermove'].forEach(function(t){ window.addEventListener(t,function(){ var n=Date.now(); if(n-ping>5000){ ping=n; try{ parent.postMessage({iocActive:1},'*'); }catch(e){} } },{passive:true,capture:true}); }); }
    vid();
    if(!get() && !embedded && !exempt) timer();
    fill();
    try{ new MutationObserver(fill).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
