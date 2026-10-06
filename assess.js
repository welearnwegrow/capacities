(function(){
  var KEY='ioc-assess-v1';
  var BANDS=[{name:'Contextual awareness',color:'#46716f'},{name:'Collective Strategy',color:'#5b6733'},{name:'Systemic Intervention',color:'#a8542d'}];
  var LV=['','Beginner (0-2)','Developing (2-5)','Effective (5-10)','Influential (10+)'];
  var levels={}, meta={}, assessOn=false, cellMap={};
  try{ levels=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ levels={}; }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(levels)); }catch(e){} }
  function paint(cell,on,color){ if(on){ cell.style.boxShadow='inset 0 0 0 2px '+color; cell.style.background=color+'22'; } else { cell.style.boxShadow=''; cell.style.background=''; } }
  function updateCount(){ var el=document.getElementById('ioc-assess-count'); if(el){ el.textContent=Object.keys(levels).length+' of 21 rated'; } }
  function setLevel(name,cells,lv){
    var cur=levels[name];
    cells.forEach(function(c){ paint(c,false); });
    if(cur===lv){ delete levels[name]; } else { levels[name]=lv; paint(cells[lv-1],true,BANDS[meta[name].band].color); }
    save(); updateCount();
  }
  function repaint(){ Object.keys(cellMap).forEach(function(name){ var cs=cellMap[name]; cs.forEach(function(c){ paint(c,false); }); var lv=levels[name]; if(lv){ paint(cs[lv-1],true,BANDS[meta[name].band].color); } }); }
  function wrapLabel(s){ var words=s.split(' '), lines=[], cur=''; words.forEach(function(w){ if((cur+' '+w).trim().length>13){ if(cur) lines.push(cur); cur=w; } else { cur=(cur?cur+' ':'')+w; } }); if(cur) lines.push(cur); return lines.slice(0,2); }
  function radarSVG(islands,color){
    var n=islands.length, cx=190, cy=170, R=78, svg='<svg viewBox="0 0 380 340" width="100%" style="max-width:380px;display:block;margin:0 auto">';
    var i,a,g;
    for(g=1;g<=4;g++){ var pts=''; for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; pts+=(cx+Math.cos(a)*R*g/4).toFixed(1)+','+(cy+Math.sin(a)*R*g/4).toFixed(1)+' '; } svg+='<polygon points="'+pts+'" fill="none" stroke="rgba(120,105,75,.18)" stroke-width="1"></polygon>'; }
    for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; var ex=cx+Math.cos(a)*R, ey=cy+Math.sin(a)*R; svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="rgba(120,105,75,.22)" stroke-width="1"></line>'; var lx=cx+Math.cos(a)*(R+14), ly=cy+Math.sin(a)*(R+14); var anc=Math.abs(Math.cos(a))<0.34?'middle':(Math.cos(a)>0?'start':'end'); var lines=wrapLabel(islands[i]); var ty=ly-(lines.length-1)*6.5; svg+='<text x="'+lx.toFixed(1)+'" y="'+ty.toFixed(1)+'" font-family="PT Sans,sans-serif" font-size="11.5" fill="#6b5d45" text-anchor="'+anc+'" dominant-baseline="middle">'; lines.forEach(function(ln,li){ svg+='<tspan x="'+lx.toFixed(1)+'" dy="'+(li===0?0:13)+'">'+ln.replace(/&/g,'&amp;')+'</tspan>'; }); svg+='</text>'; }
    var dp='', any=false; for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; var lv=levels[islands[i]]||0; if(lv)any=true; dp+=(cx+Math.cos(a)*R*lv/4).toFixed(1)+','+(cy+Math.sin(a)*R*lv/4).toFixed(1)+' '; }
    if(any) svg+='<polygon points="'+dp+'" fill="'+color+'33" stroke="'+color+'" stroke-width="2"></polygon>';
    svg+='</svg>'; return svg;
  }
  function generate(){
    var bandIslands=[[],[],[]];
    Object.keys(meta).forEach(function(name){ bandIslands[meta[name].band].push({name:name, order:meta[name].order}); });
    bandIslands.forEach(function(arr){ arr.sort(function(a,b){return a.order-b.order;}); });
    var rated=Object.keys(levels).length;
    var dstr=new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
    var html='<div style="padding:34px 34px 30px">';
    html+='<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:24px"><h2 style="font-family:Newsreader,serif;font-weight:600;font-size:26px;color:#6e4f1e;margin:0">Self-Assessment'+(function(){ try{ var w=JSON.parse(localStorage.getItem('ioc-assess-who')||'null'); if(w&&w.n){ var d=document.createElement('div'); d.textContent=w.n; return ' \u2014 '+d.innerHTML; } }catch(e){} return ''; })()+'</h2><button id="ioc-assess-print" type="button" class="ioc-noprint" style="font-family:PT Sans,sans-serif;font-size:13px;font-weight:700;color:#fff;background:#6e4f1e;border:none;border-radius:20px;padding:9px 18px;cursor:pointer;margin-right:52px">Save as PDF</button></div>';
    html+='<div class="ioc-radars" style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px">';
    BANDS.forEach(function(b,bi){ var names=bandIslands[bi].map(function(o){return o.name;}); html+='<div style="text-align:center"><div style="font-family:PT Serif,serif;font-weight:700;font-size:15px;color:'+b.color+';margin-bottom:6px">'+b.name+'</div>'+radarSVG(names,b.color)+'</div>'; });
    html+='</div>';
    html+='<div class="ioc-levels" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">';
    var LVL=['','Beginner (0-2)','Developing (2-5)','Effective (5-10)','Influential (10+)'];
    var lv2;
    for(lv2=4;lv2>=1;lv2--){ (function(lv){
      var names=Object.keys(levels).filter(function(n){return levels[n]===lv;}).sort();
      html+='<div style="background:rgba(244,238,225,.5);border-radius:12px;padding:14px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px"><span style="width:12px;height:12px;border-radius:50%;background:rgba(70,113,111,'+(0.2+lv*0.2)+')"></span><span style="font-family:PT Sans,sans-serif;font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:#6b5d45">'+LVL[lv]+' ('+names.length+')</span></div>';
      if(names.length){ html+='<div style="display:flex;flex-direction:column;gap:6px">'; names.forEach(function(n){ html+='<div style="font-size:12.5px;color:#3f3a31;display:flex;gap:7px;align-items:baseline"><span style="width:6px;height:6px;border-radius:50%;flex:none;background:'+BANDS[meta[n].band].color+'"></span>'+n+'</div>'; }); html+='</div>'; }
      else { html+='<div style="font-size:12px;color:#9a8d76;font-style:italic">None yet</div>'; }
      html+='</div>';
    })(lv2); }
    html+='</div>';
    html+='<div style="margin-top:22px;padding-top:14px;border-top:1px solid #e4dcc8;text-align:center"><span style="font-family:PT Sans,sans-serif;font-size:11px;color:#8a7a5f">Systems Change Learning Guide \u00b7 '+dstr+' \u00b7 '+rated+' of 21 learning areas rated \u00b7 CC BY-NC-ND 4.0</span></div>';
    html+='</div>';
    var box=document.getElementById('ioc-assess-results'); box.innerHTML=html;
    document.getElementById('ioc-assess-overlay').style.display='block';
    var modal=document.getElementById('ioc-assess-modal'); if(modal) modal.scrollTop=0;
    document.getElementById('ioc-assess-overlay').scrollTop=0;
    if(window.track){ window.track('assessment_complete', {rated: rated}); }
    document.getElementById('ioc-assess-print').addEventListener('click',function(){ var old=document.title, nm=''; try{ var w=JSON.parse(localStorage.getItem('ioc-assess-who')||'null'); if(w&&w.n) nm='-'+w.n.trim().replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,''); }catch(e){} document.title='Self-Assessment'+nm+'-'+new Date().toISOString().slice(0,10); var back=function(){ document.title=old; window.removeEventListener('afterprint',back); }; window.addEventListener('afterprint',back); window.print(); setTimeout(back,4000); });
  }
  function init(t){
    var grids=document.querySelectorAll('[data-assess-grid]');
    if(grids.length<3){ if(t<80) return requestAnimationFrame(function(){init(t+1);}); }
    grids.forEach(function(g,bi){ var cells=g.children, rows=(cells.length-6)/6, r, lv;
      for(r=0;r<rows;r++){ var base=6+r*6; var name=cells[base].textContent.trim(); meta[name]={band:bi,order:r}; var lvCells=[];
        for(lv=1;lv<=4;lv++){ (function(cell,nm,lev){ lvCells.push(cell); cell.style.cursor='default'; cell.addEventListener('click',function(){ if(!assessOn) return; setLevel(nm,cellMap[nm],lev); }); })(cells[base+1+lv],name,lv); }
        cellMap[name]=lvCells;
      }
    });
    var btn=document.getElementById('ioc-assess-btn');
    if(location.hash==='#start'){ setTimeout(function(){ btn.click(); btn.scrollIntoView ? window.scrollTo({top:btn.getBoundingClientRect().top+window.scrollY-90,behavior:'smooth'}) : 0; },400); }
    function startAssess(){ assessOn=true;
      if(window.track){ window.track('assessment_start'); }
      repaint(); updateCount();
      btn.style.display='none';
      document.getElementById('ioc-assess-fab').style.display='flex';
      Object.keys(cellMap).forEach(function(n){ cellMap[n].forEach(function(c){ c.style.cursor='pointer'; }); });
    }
    function logStart(name,email){
      try{
        var base=window.NOTION_CONNECTOR_URL; if(!base) return;
        fetch(base.replace(/\/$/,'')+'/log-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:name,email:email,source:'self-assessment',comment:'Started the self-assessment'}),keepalive:true}).catch(function(){});
      }catch(e){}
    }
    function openIntro(){
      if(document.getElementById('ioc-assess-intro')) return;
      var ov=document.createElement('div');
      ov.id='ioc-assess-intro';
      ov.style.cssText='position:fixed;inset:0;z-index:90;background:rgba(40,32,22,.45);display:flex;align-items:center;justify-content:center;padding:18px';
      var inp='width:100%;box-sizing:border-box;font-family:PT Sans,sans-serif;font-size:15px;padding:12px 14px;border:1px solid rgba(120,105,75,.35);border-radius:10px;background:#fffdf8;color:#2E2B26';
      ov.innerHTML='<form style="width:100%;max-width:460px;background:#fbf7ee;border:1px solid rgba(176,130,47,.4);border-radius:18px;padding:26px 26px 22px;box-shadow:0 20px 50px rgba(40,30,15,.25);font-family:PT Sans,sans-serif;display:flex;flex-direction:column;gap:14px">'+
        '<div style="font-family:Newsreader,serif;font-size:26px;line-height:1.15;color:#6e4f1e">Take the self-assessment</div>'+
        '<p style="margin:0;font-size:14.5px;line-height:1.6;color:#5a4a2c">For each area, click the box that fits you, from <b>Beginner</b> to <b>Influential</b>. When you are done, tap <b>Generate my radar</b> to see and download your profile.</p>'+
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#6e5a36">Name<input name="n" required autocomplete="name" style="'+inp+'"></label>'+
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#6e5a36">Email<input name="e" type="email" required autocomplete="email" style="'+inp+'"></label>'+
        '<p style="margin:0;font-size:12px;line-height:1.5;color:#8a7a5f">We use this only to follow up about the guide. See our <a href="privacy.html" style="color:#8a6a2f">privacy policy</a>.</p>'+
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">'+
        '<button type="button" data-x="1" style="font-family:PT Sans,sans-serif;font-size:14px;font-weight:700;color:#8a7a5f;background:none;border:none;cursor:pointer;padding:10px 12px">Cancel</button>'+
        '<button type="submit" style="font-family:PT Sans,sans-serif;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(120deg,#7a5a22,#5f4718);border:none;border-radius:24px;padding:12px 22px;cursor:pointer">Start →</button></div></form>';
      document.body.appendChild(ov);
      var f=ov.querySelector('form'); f.n.focus();
      ov.querySelector('[data-x]').onclick=function(){ document.querySelectorAll('#ioc-assess-intro').forEach(function(x){ x.remove(); }); };
      ov.addEventListener('click',function(ev){ if(ev.target===ov) ov.remove(); });
      f.addEventListener('submit',function(ev){ ev.preventDefault(); var n=f.n.value.trim(), e=f.e.value.trim(); if(!n||!e) return;
        try{ localStorage.setItem('ioc-assess-who',JSON.stringify({n:n,e:e})); }catch(err){}
        logStart(n,e); document.querySelectorAll('#ioc-assess-intro').forEach(function(x){ x.remove(); }); startAssess(); });
    }
    if(btn.__iocBound) return; btn.__iocBound=true;
    btn.addEventListener('click',function(){ var who=null; try{ who=JSON.parse(localStorage.getItem('ioc-assess-who')||'null'); }catch(e){} if(who&&who.e){ startAssess(); } else { openIntro(); } });
    document.getElementById('ioc-assess-gen').addEventListener('click',generate);
    document.getElementById('ioc-assess-close').addEventListener('click',function(){ document.getElementById('ioc-assess-overlay').style.display='none'; });
    document.getElementById('ioc-assess-reset').addEventListener('click',function(){ levels={}; save(); assessOn=false; Object.keys(cellMap).forEach(function(n){ cellMap[n].forEach(function(c){ paint(c,false); c.style.cursor='default'; }); }); document.getElementById('ioc-assess-fab').style.display='none'; document.getElementById('ioc-assess-overlay').style.display='none'; btn.style.display='inline-block'; document.getElementById('ioc-assess-results').innerHTML=''; });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){init(0);}); else init(0);
})();
