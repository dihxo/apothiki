/* ===================== APP: layout, router, events, login ===================== */
'use strict';
const ACT = {};      // click handlers: data-act
const ENTER = {};    // Enter handlers: data-enter
const ON_INPUT = []; // (el,e) => handled?
const ON_CHANGE = [];
const VIEWS = {};    // route prefix -> fn(arg) => html

const IC = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  orders:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'
};
const svg = (k, cls='') => `<svg viewBox="0 0 24 24" class="${cls}">${IC[k]}</svg>`;

function route(){ return (location.hash||'#dashboard').slice(1) || 'dashboard'; }
window.addEventListener('hashchange', ()=>{ document.body.classList.remove('menu'); const r=route(); if(!r.startsWith('order-')) leaveOrder(); render(); window.scrollTo(0,0); });

function layout(){
  const me=UI.me;
  $('#root').innerHTML=`
  <aside id="side">
    <a class="brand" href="#dashboard"><img src="logo.png" alt="${esc(settings().name||'ΔΙΗΧΟ')}"><small>Διαχείριση αποθήκης</small></a>
    <nav id="nav"></nav>
    <div class="side-bottom" id="sideBottom"></div>
    <div class="side-foot"><div class="avatar">${esc((me.name||me.username||'?').slice(0,1).toUpperCase())}</div><div class="who"><b>${esc(me.name||me.username)}</b><span>${esc(ROLES[me.role]||me.role)}</span></div>${SERVER?'<button class="icon" title="Αποσύνδεση" data-act="logout">⎋</button>':''}</div>
  </aside>
  <header id="top">
    <button class="btn ghost" id="burger" data-act="burger">${svg('menu')}</button>
    <div class="gsearch">${svg('search')}<input type="search" id="gs" placeholder="Αναζήτηση ή σάρωση QR: προϊόν, τεμάχιο, παραγγελία, πελάτης…" autocomplete="off"><div class="gres" id="gres" style="display:none"></div></div>
    <div class="conn" id="conn"><span>Live</span></div>
  </header>
  <main id="view"></main>`;
  updateConn();
}
function navHTML(){
  const r=route(), t=today();
  const pick=Object.values(D.orders).filter(o=>o.status==='reserved'&&o.start<=t).length;
  const late=Object.values(D.orders).filter(o=>o.status==='started'&&(o.end||o.start)<t).length;
  const mnt=Object.values(D.maintenance).filter(m=>m.status!=='done').length;
  const on=(k,alts=[])=> (r===k||alts.some(a=>r.startsWith(a)))?'on':'';
  const a=(k,ic,l,extra='',alts=[])=>`<a href="#${k}" class="${on(k,alts)}">${svg(ic)}${l}${extra}</a>`;
  return (can('staff')?`<a class="side-new" data-act="new-order"><i>+</i>Νέα παραγγελία</a>`:'')+
    a('dashboard','home','Αρχική')+
    a('calendar','cal','Ημερολόγιο')+'<hr>'+
    a('orders','orders','Παραγγελίες', (pick+late)?`<span class="cnt">${pick+late}</span>`:'', ['order-'])+
    a('customers','users','Πελάτες','',['customer-'])+
    a('products','box','Εξοπλισμός','',['product-','categories'])+
    a('maintenance','wrench','Συντήρηση', mnt?`<span class="cnt" style="background:var(--orange)">${mnt}</span>`:'')+
    a('documents','doc','Έγγραφα')+'<hr>'+
    a('reports','chart','Αναφορές');
}

function render(){
  renderPending=false;
  if(!UI.me) return;
  if(!$('#view')) layout();
  $('#nav').innerHTML=navHTML();
  const sb=$('#sideBottom'); if(sb){ const r0=route(); sb.innerHTML=`<a href="#scan" class="${r0==='scan'?'on':''}">${svg('scan')}Σάρωση barcode</a><a href="#setup" class="${r0==='setup'?'on':''}">${svg('gear')}Ρυθμίσεις</a>`; }
  const r=route(); UI.route=r;
  const dash=r.indexOf('-'); const key = VIEWS[r] ? r : (dash>0 ? r.slice(0,dash) : r); const arg = VIEWS[r] ? '' : (dash>0 ? r.slice(dash+1) : '');
  const fn = VIEWS[key] || VIEWS.dashboard;
  let html='';
  try{ html = fn(arg); }catch(e){ console.error(e); html=`<div class="banner red">Σφάλμα εμφάνισης: ${esc(e.message)}</div>`; }
  const af=document.activeElement, afId=(af&&af.id&&af.dataset&&af.dataset.enter)?af.id:null;
  const bindFocus = af && af.dataset && af.dataset.bind ? {b:af.dataset.bind, pos:af.selectionStart} : null;
  $('#view').innerHTML = (!can('staff')?`<div class="banner blue">Έχεις πρόσβαση μόνο για ανάγνωση.</div>`:'') + html;
  if(afId){ const n=document.getElementById(afId); if(n) n.focus(); }
  if(bindFocus){ const n=document.querySelector(`[data-bind="${bindFocus.b}"]`); if(n){ n.focus(); try{ n.setSelectionRange(bindFocus.pos,bindFocus.pos); }catch(e){} } }
  const auto=$('#view [data-autofocus]'); if(auto && !modalOpen() && !bindFocus && !afId) auto.focus();
}

/* ---------- global search ---------- */
function gsearchResults(q){
  q=q.trim().toLowerCase(); if(!q) return [];
  const out=[]; const has=(...v)=>v.some(x=>(x||'').toLowerCase().includes(q));
  for(const p of prodsSorted()) if(has(p.name,p.sku)) out.push({t:'Προϊόντα', href:'#product-'+p.id, l:p.name, r:p.sku});
  for(const u of Object.values(D.units)) if(has(u.code,u.serial)) out.push({t:'Τεμάχια', href:'#product-'+u.productId, l:prodName(u.productId)+' · '+u.code, r:u.serial||''});
  for(const o of sortBy(Object.values(D.orders),o=>-(o.createdAt||0))) if(has(o.number,o.name,custName(o.customerId),o.venue)) out.push({t:'Παραγγελίες', href:'#order-'+o.id, l:(o.number||'')+' · '+(o.name||custName(o.customerId)||'Χωρίς τίτλο'), r:fmtD(o.start)});
  for(const c of Object.values(D.customers)) if(has(c.name,c.company,c.email,c.phone,c.vat)) out.push({t:'Πελάτες', href:'#customer-'+c.id, l:c.company||c.name, r:c.phone||c.email||''});
  return out.slice(0,40);
}
function drawGsearch(){
  const q=$('#gs').value, box=$('#gres'); const res=gsearchResults(q);
  if(!q.trim()){ box.style.display='none'; return; }
  let last='', html='';
  for(const [i,r] of res.entries()){ if(r.t!==last){ html+=`<div class="t">${r.t}</div>`; last=r.t; } html+=`<a href="${r.href}" class="${i===0?'hl':''}"><span>${esc(r.l)}</span><span class="muted small">${esc(r.r)}</span></a>`; }
  box.innerHTML = html || '<div class="empty" style="padding:18px">Κανένα αποτέλεσμα</div>'; box.style.display='block';
}
function gsearchEnter(){
  const q=$('#gs').value.trim(); if(!q) return;
  const f=findCode(q);
  let href=null;
  if(f){ href = f.type==='order' ? '#order-'+f.order.id : '#product-'+f.product.id; }
  else { const r=gsearchResults(q)[0]; if(r) href=r.href; }
  if(href){ location.hash=href; $('#gs').value=''; $('#gres').style.display='none'; $('#gs').blur(); }
  else toast('Δεν βρέθηκε: '+q, true);
}

/* ---------- events ---------- */
document.addEventListener('click', async e=>{
  if(!e.target.closest('.dd')) $$('.dd.open').forEach(d=>d.classList.remove('open'));
  if(!e.target.closest('.gsearch') && $('#gres')) $('#gres').style.display='none';
  if(!e.target.closest('.pick-add')) $$('.pick-add .gres').forEach(g=>g.style.display='none');
  if(e.target.closest('#gres a')){ $('#gs').value=''; $('#gres').style.display='none'; }
  const el=e.target.closest('[data-act]'); if(!el) return;
  const a=el.dataset.act;
  if(a==='modal-back'){ if(e.target===el) closeModal(); return; }
  if(el.tagName==='INPUT' && (el.type==='file')) return;
  if(el.tagName==='A' && el.getAttribute('href')==='#') e.preventDefault();
  const h=ACT[a]; if(h){ try{ await h(el, e); }catch(err){ console.error(err); toast(err.error||err.message||String(err), true); } }
});
document.addEventListener('input', e=>{
  const el=e.target;
  if(el.id==='gs'){ drawGsearch(); return; }
  if(el.dataset.bind){ UI[el.dataset.bind]=el.value; render(); return; }
  for(const f of ON_INPUT) if(f(el,e)) return;
});
document.addEventListener('change', e=>{
  const el=e.target;
  if(el.dataset.bindc){ UI[el.dataset.bindc]=el.type==='checkbox'?el.checked:el.value; render(); return; }
  for(const f of ON_CHANGE) if(f(el,e)) return;
});
document.addEventListener('keydown', async e=>{
  const el=e.target;
  if(e.key==='Escape'){ if(modalOpen()) closeModal(); if($('#gres')) $('#gres').style.display='none'; return; }
  if(e.key==='/' && !/INPUT|TEXTAREA|SELECT/.test(el.tagName) && $('#gs')){ e.preventDefault(); $('#gs').focus(); return; }
  if(e.key!=='Enter') return;
  if(el.id==='gs'){ e.preventDefault(); gsearchEnter(); return; }
  if(el.dataset.enter){ e.preventDefault(); const v=el.value.trim(); if(!v) return; el.value=''; const h=ENTER[el.dataset.enter]; if(h){ try{ await h(v, el); }catch(err){ toast(err.error||err.message, true); } } return; }
  if(modalOpen() && el.tagName==='INPUT' && el.type!=='checkbox'){ const b=$('#modal [data-primary]'); if(b){ e.preventDefault(); b.click(); } }
});
window.addEventListener('beforeunload', e=>{ if(UI.draft && UI.draft._dirty){ e.preventDefault(); e.returnValue=''; } });

ACT['modal-close']=()=>closeModal();
ACT['confirm-no']=()=>{ const p=M&&M.prev; if(p&&p.redraw){ M=p; p.redraw(); } else closeModal(); };
ACT['confirm-yes']=async(el)=>{ el.disabled=true; const f=M.onYes; const res=await f(); if(M&&M.type==='confirm'){ const p=M.prev; if(res===false && p&&p.redraw){ M=p; p.redraw(); } else closeModal(); } };
ACT['burger']=()=>document.body.classList.toggle('menu');
ACT['dd']=el=>{ const d=el.closest('.dd'); const was=d.classList.contains('open'); $$('.dd.open').forEach(x=>x.classList.remove('open')); if(!was) d.classList.add('open'); };
ACT['logout']=async()=>{ try{ await api('/api/logout',{}); }catch(e){} UI.me=null; if(es) es.close(); renderLogin(); };
ACT['tab']=el=>{ UI[el.dataset.k]=el.dataset.v; render(); };
ACT['go']=el=>{ location.hash=el.dataset.href; };

/* ---------- login ---------- */
function renderLogin(msg){
  $('#modal').innerHTML='';
  $('#root').innerHTML=`<div class="login"><form class="card" id="loginForm">
    <div class="brand-login"><img src="logo.png" alt="ΔΙΗΧΟ"><small>Διαχείριση αποθήκης</small></div>
    <label class="f">Όνομα χρήστη<input type="text" name="u" autocomplete="username" autofocus></label>
    <label class="f">Κωδικός<input type="password" name="p" autocomplete="current-password"></label>
    ${msg?`<div class="banner red" style="margin:0">${esc(msg)}</div>`:''}
    <button class="btn pri" style="justify-content:center;padding:10px">Σύνδεση</button>
    <div class="xs muted">Πρώτη φορά; Χρήστης <b>admin</b>, κωδικός <b>admin</b>.</div></form></div>`;
  $('#loginForm').onsubmit=async ev=>{ ev.preventDefault(); const f=ev.target;
    try{ UI.me=await api('/api/login',{username:f.u.value, password:f.p.value}); await start(); }
    catch(e){ renderLogin(e.error); } };
  setTimeout(()=>{ const i=$('#loginForm input'); if(i) i.focus(); },10);
}
async function start(){
  $('#root').innerHTML='<div class="empty"><b>Φόρτωση…</b></div>';
  await loadState();
  layout(); render(); connectEvents();
  if(UI.me.mustChange) setTimeout(()=>passwordModal(true), 300);
}
async function boot(){
  loadLogo();
  if(!SERVER) return bootArtifact();
  try{ UI.me=await api('/api/me'); await start(); }
  catch(e){ if(e.status===401) renderLogin(); else $('#root').innerHTML=`<div class="empty"><b>Δεν υπάρχει σύνδεση με τον server</b>Βεβαιώσου ότι τρέχει το πρόγραμμα της αποθήκης στον υπολογιστή-server.<br><br><button class="btn" onclick="location.reload()">Δοκίμασε ξανά</button></div>`; }
}
function passwordModal(forced){
  M={type:'pw'};
  openModal(`<div class="dlg-h"><h2>Αλλαγή κωδικού</h2>${forced?'':'<button class="icon" data-act="modal-close">✕</button>'}</div><div class="dlg-b">
    ${forced?'<div class="banner orange" style="margin:0">Για λόγους ασφαλείας όρισε δικό σου κωδικό.</div>':''}
    <label class="f">Τρέχων κωδικός<input type="password" id="pwOld" autofocus></label><label class="f">Νέος κωδικός<input type="password" id="pwNew"></label><label class="f">Επανάληψη νέου<input type="password" id="pwNew2"></label></div>
    <div class="dlg-f">${forced?'':'<button class="btn" data-act="modal-close">Άκυρο</button>'}<button class="btn pri" data-act="pw-save" data-primary>Αποθήκευση</button></div>`, 'sm');
}
ACT['pw-save']=async()=>{ const o=$('#pwOld').value, n=$('#pwNew').value; if(n!==$('#pwNew2').value) return toast('Οι νέοι κωδικοί δεν ταιριάζουν.', true);
  try{ await api('/api/password',{old:o,new:n}); UI.me.mustChange=false; closeModal(); toast('Ο κωδικός άλλαξε'); }catch(e){ toast(e.error, true); } };
