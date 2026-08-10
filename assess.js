(function(){
  var KEY='ioc-assess-v1';
  var BANDS=[{name:'Personal Grounding',color:'#46716f'},{name:'Collective Strategy',color:'#5b6733'},{name:'Systemic Intervention',color:'#a8542d'}];
  var LV=['','Personal','Social','Institutional','Systemic'];
  var levels={}, meta={}, assessOn=false, cellMap={};
  try{ levels=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ levels={}; }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(levels)); }catch(e){} }
  function paint(cell,on,color){ if(on){ cell.style.boxShadow='inset 0 0 0 2px '+color; cell.style.background=color+'22'; } else { cell.style.boxShadow=''; cell.style.background=''; } }
  function updateCount(){ var el=document.getElementById('ioc-assess-count'); if(el){ el.textContent=Object.keys(levels).length+' of 24 rated'; } }
  function setLevel(name,cells,lv){
    var cur=levels[name];
    cells.forEach(function(c){ paint(c,false); });
    if(cur===lv){ delete levels[name]; } else { levels[name]=lv; paint(cells[lv-1],true,BANDS[meta[name].band].color); }
    save(); updateCount();
  }
  function repaint(){ Object.keys(cellMap).forEach(function(name){ var cs=cellMap[name]; cs.forEach(function(c){ paint(c,false); }); var lv=levels[name]; if(lv){ paint(cs[lv-1],true,BANDS[meta[name].band].color); } }); }
  function wrapLabel(s){ var words=s.split(' '), lines=[], cur=''; words.forEach(function(w){ if((cur+' '+w).trim().length>13){ if(cur) lines.push(cur); cur=w; } else { cur=(cur?cur+' ':'')+w; } }); if(cur) lines.push(cur); return lines.slice(0,2); }
  function radarSVG(islands,color){
    var n=islands.length, cx=175, cy=150, R=92, svg='<svg viewBox="0 0 350 300" width="100%" style="max-width:350px;display:block;margin:0 auto">';
    var i,a,g;
    for(g=1;g<=4;g++){ var pts=''; for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; pts+=(cx+Math.cos(a)*R*g/4).toFixed(1)+','+(cy+Math.sin(a)*R*g/4).toFixed(1)+' '; } svg+='<polygon points="'+pts+'" fill="none" stroke="rgba(120,105,75,.18)" stroke-width="1"></polygon>'; }
    for(i=0;i<n;i++){ a=-Math.PI/2+i*2*Math.PI/n; var ex=cx+Math.cos(a)*R, ey=cy+Math.sin(a)*R; svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="rgba(120,105,75,.22)" stroke-width="1"></line>'; var lx=cx+Math.cos(a)*(R+9), ly=cy+Math.sin(a)*(R+9); var anc=Math.abs(Math.cos(a))<0.34?'middle':(Math.cos(a)>0?'start':'end'); var lines=wrapLabel(islands[i]); var ty=ly-(lines.length-1)*3.6; svg+='<text x="'+lx.toFixed(1)+'" y="'+ty.toFixed(1)+'" font-family="PT Sans,sans-serif" font-size="7" fill="#6b5d45" text-anchor="'+anc+'" dominant-baseline="middle">'; lines.forEach(function(ln,li){ svg+='<tspan x="'+lx.toFixed(1)+'" dy="'+(li===0?0:7.2)+'">'+ln.replace(/&/g,'&amp;')+'</tspan>'; }); svg+='</text>'; }
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
    html+='<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:4px"><h2 style="font-family:Newsreader,serif;font-weight:600;font-size:26px;color:#6e4f1e;margin:0">Your Learning Areas Self-Assessment</h2><button id="ioc-assess-print" type="button" class="ioc-noprint" style="font-family:PT Sans,sans-serif;font-size:13px;font-weight:700;color:#fff;background:#6e4f1e;border:none;border-radius:20px;padding:9px 18px;cursor:pointer">Download / Print PDF</button></div>';
    html+='<p style="font-size:12.5px;color:#8a7a5f;margin:0 0 16px">Systems Change Learning Guide \u00b7 '+dstr+' \u00b7 '+rated+' of 24 learning areas rated</p>';
    html+='<div style="display:flex;flex-wrap:wrap;gap:14px 22px;padding:11px 16px;background:rgba(244,238,225,.6);border-radius:10px;margin-bottom:22px"><span style="font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a7a4a">Scale:</span>';
    LV.forEach(function(label,i){ if(!i) return; html+='<span style="display:flex;align-items:center;gap:7px;font-size:12px;color:#5a5347"><span style="width:12px;height:12px;border-radius:50%;background:rgba(70,113,111,'+(0.2+i*0.2)+')"></span>'+['','Emerging','Developing','Effective','Influential'][i]+'</span>'; });
    html+='</div>';
    html+='<div class="ioc-radars" style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px">';
    BANDS.forEach(function(b,bi){ var names=bandIslands[bi].map(function(o){return o.name;}); html+='<div style="text-align:center"><div style="font-family:PT Serif,serif;font-weight:700;font-size:15px;color:'+b.color+';margin-bottom:6px">'+b.name+'</div>'+radarSVG(names,b.color)+'</div>'; });
    html+='</div>';
    html+='<div class="ioc-levels" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">';
    var LVL=['','Emerging','Developing','Effective','Influential'];
    var lv2;
    for(lv2=4;lv2>=1;lv2--){ (function(lv){
      var names=Object.keys(levels).filter(function(n){return levels[n]===lv;}).sort();
      html+='<div style="background:rgba(244,238,225,.5);border-radius:12px;padding:14px"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px"><span style="width:12px;height:12px;border-radius:50%;background:rgba(70,113,111,'+(0.2+lv*0.2)+')"></span><span style="font-family:PT Sans,sans-serif;font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:#6b5d45">'+LVL[lv]+' ('+names.length+')</span></div>';
      if(names.length){ html+='<div style="display:flex;flex-direction:column;gap:6px">'; names.forEach(function(n){ html+='<div style="font-size:12.5px;color:#3f3a31;display:flex;gap:7px;align-items:baseline"><span style="width:6px;height:6px;border-radius:50%;flex:none;background:'+BANDS[meta[n].band].color+'"></span>'+n+'</div>'; }); html+='</div>'; }
      else { html+='<div style="font-size:12px;color:#9a8d76;font-style:italic">None yet</div>'; }
      html+='</div>';
    })(lv2); }
    html+='</div>';
    html+='<div style="margin-top:22px;padding-top:14px;border-top:1px solid #e4dcc8;text-align:center"><span style="font-family:PT Sans,sans-serif;font-size:11px;color:#8a7a5f">CC BY-NC-ND 4.0 · Systems Change Learning Guide</span></div>';
    html+='</div>';
    var box=document.getElementById('ioc-assess-results'); box.innerHTML=html;
    document.getElementById('ioc-assess-overlay').style.display='block';
    var modal=document.getElementById('ioc-assess-modal'); if(modal) modal.scrollTop=0;
    document.getElementById('ioc-assess-overlay').scrollTop=0;
    if(window.track){ window.track('assessment_complete', {rated: rated}); }
    document.getElementById('ioc-assess-print').addEventListener('click',function(){ window.print(); });
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
    btn.addEventListener('click',function(){ assessOn=true;
      if(window.track){ window.track('assessment_start'); }
      repaint(); updateCount();
      btn.style.display='none';
      document.getElementById('ioc-assess-fab').style.display='flex';
      Object.keys(cellMap).forEach(function(n){ cellMap[n].forEach(function(c){ c.style.cursor='pointer'; }); });
    });
    document.getElementById('ioc-assess-gen').addEventListener('click',generate);
    document.getElementById('ioc-assess-close').addEventListener('click',function(){ document.getElementById('ioc-assess-overlay').style.display='none'; });
    document.getElementById('ioc-assess-reset').addEventListener('click',function(){ levels={}; save(); assessOn=false; Object.keys(cellMap).forEach(function(n){ cellMap[n].forEach(function(c){ paint(c,false); c.style.cursor='default'; }); }); document.getElementById('ioc-assess-fab').style.display='none'; document.getElementById('ioc-assess-overlay').style.display='none'; btn.style.display='inline-block'; document.getElementById('ioc-assess-results').innerHTML=''; });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){init(0);}); else init(0);
})();
