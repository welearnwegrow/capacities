(function(){
  var KEY='ioc-assess-v1';
  var BANDS=[{name:'Inner Inquiry',color:'#46716f'},{name:'Collective Strategy',color:'#5b6733'},{name:'Systemic Intervention',color:'#a8542d'}];
  var LV=['','Personal','Social','Institutional','Systemic'];
  var levels={}, meta={}, assessOn=false, cellMap={};
  try{ levels=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ levels={}; }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(levels)); }catch(e){} }
  function paint(cell,on,color){ if(on){ cell.style.boxShadow='inset 0 0 0 2px '+color; cell.style.background=color+'22'; } else { cell.style.boxShadow=''; cell.style.background=''; } }
  function setLevel(name,cells,lv){
    var cur=levels[name];
    cells.forEach(function(c){ paint(c,false); });
    if(cur===lv){ delete levels[name]; } else { levels[name]=lv; paint(cells[lv-1],true,BANDS[meta[name].band].color); }
    save();
  }
  function repaint(){ Object.keys(cellMap).forEach(function(name){ var cs=cellMap[name]; cs.forEach(function(c){ paint(c,false); }); var lv=levels[name]; if(lv){ paint(cs[lv-1],true,BANDS[meta[name].band].color); } }); }
  function shortName(s){ return s.length>16 ? s.slice(0,15)+'\u2026' : s; }
  function radarSVG(islands,color){
    var n=islands.length, cx=160, cy=150, R=96, svg='<svg viewBox="0 0 320 300" width="100%" style="max-width:320px;display:block;margin:0 auto">';
    var i,a,g;
    for(g=1;g<=4;g++){ var pts=''; for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; pts+=(cx+Math.cos(a)*R*g/4).toFixed(1)+','+(cy+Math.sin(a)*R*g/4).toFixed(1)+' '; } svg+='<polygon points="'+pts+'" fill="none" stroke="rgba(120,105,75,.18)" stroke-width="1"></polygon>'; }
    for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; var ex=cx+Math.cos(a)*R, ey=cy+Math.sin(a)*R; svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="rgba(120,105,75,.22)" stroke-width="1"></line>'; var lx=cx+Math.cos(a)*(R+10), ly=cy+Math.sin(a)*(R+10); var anc=Math.abs(Math.cos(a))<0.34?'middle':(Math.cos(a)>0?'start':'end'); svg+='<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" font-family="PT Sans,sans-serif" font-size="7.5" fill="#6b5d45" text-anchor="'+anc+'" dominant-baseline="middle">'+shortName(islands[i])+'</text>'; }
    var dp='', any=false; for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; var lv=levels[islands[i]]||0; if(lv)any=true; dp+=(cx+Math.cos(a)*R*lv/4).toFixed(1)+','+(cy+Math.sin(a)*R*lv/4).toFixed(1)+' '; }
    if(any) svg+='<polygon points="'+dp+'" fill="'+color+'33" stroke="'+color+'" stroke-width="2"></polygon>';
    svg+='</svg>'; return svg;
  }
  function generate(){
    var bandIslands=[[],[],[]];
    Object.keys(meta).forEach(function(name){ bandIslands[meta[name].band].push({name:name, order:meta[name].order}); });
    bandIslands.forEach(function(arr){ arr.sort(function(a,b){return a.order-b.order;}); });
    var html='<div style="background:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.72);border-radius:16px;padding:24px;box-shadow:0 8px 26px rgba(60,70,50,.09)">';
    html+='<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:6px"><h2 style="font-family:Newsreader,serif;font-weight:600;font-size:24px;color:#6e4f1e;margin:0">Your self-assessment</h2><button id="ioc-assess-print" type="button" style="font-family:PT Sans,sans-serif;font-size:13px;font-weight:700;color:#6e4f1e;background:#fff;border:1px solid #6e4f1e;border-radius:20px;padding:8px 16px;cursor:pointer">Download / Print PDF</button></div>';
    var rated=Object.keys(levels).length;
    html+='<p style="font-size:13px;color:#8a7a5f;margin:0 0 18px">'+rated+' of 24 learning areas rated.</p>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-bottom:24px">';
    BANDS.forEach(function(b,bi){ var names=bandIslands[bi].map(function(o){return o.name;}); html+='<div style="text-align:center"><div style="font-family:PT Serif,serif;font-weight:700;font-size:15px;color:'+b.color+';margin-bottom:6px">'+b.name+'</div>'+radarSVG(names,b.color)+'</div>'; });
    html+='</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">';
    var lv;
    for(lv=1;lv<=4;lv++){ var list=Object.keys(levels).filter(function(n){return levels[n]===lv;}).sort(); html+='<div style="background:rgba(244,238,225,.5);border-radius:12px;padding:14px"><div style="font-family:PT Sans,sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#6b5d45;margin-bottom:8px">'+LV[lv]+' ('+list.length+')</div>'; if(list.length){ html+='<div style="display:flex;flex-direction:column;gap:5px">'; list.forEach(function(n){ html+='<div style="font-size:12.5px;color:#3f3a31;display:flex;gap:7px;align-items:baseline"><span style="width:6px;height:6px;border-radius:50%;flex:none;background:'+BANDS[meta[n].band].color+'"></span>'+n+'</div>'; }); html+='</div>'; } else { html+='<div style="font-size:12px;color:#9a8d76;font-style:italic">None yet</div>'; } html+='</div>'; }
    html+='</div></div>';
    var box=document.getElementById('ioc-assess-results'); box.innerHTML=html; box.style.display='block';
    if(window.track){ window.track('assessment_complete', {rated: rated}); }
    document.getElementById('ioc-assess-print').addEventListener('click',function(){ window.print(); });
    box.scrollIntoView({behavior:'smooth',block:'start'});
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
    btn.addEventListener('click',function(){ assessOn=!assessOn;
      if(assessOn && window.track){ window.track('assessment_start'); }
      if(assessOn){ repaint(); } else { Object.keys(cellMap).forEach(function(n){ cellMap[n].forEach(function(c){ paint(c,false); }); }); }
      document.getElementById('ioc-assess-hint').style.display=assessOn?'inline':'none';
      document.getElementById('ioc-assess-gen').style.display=assessOn?'inline-block':'none';
      document.getElementById('ioc-assess-reset').style.display=assessOn?'inline-block':'none';
      btn.textContent=assessOn?'Done rating':'Take a self-assessment';
      Object.keys(cellMap).forEach(function(n){ cellMap[n].forEach(function(c){ c.style.cursor=assessOn?'pointer':'default'; }); });
    });
    document.getElementById('ioc-assess-gen').addEventListener('click',generate);
    document.getElementById('ioc-assess-reset').addEventListener('click',function(){ levels={}; save(); repaint(); var b=document.getElementById('ioc-assess-results'); b.style.display='none'; b.innerHTML=''; });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){init(0);}); else init(0);
})();
