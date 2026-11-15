/* ===================== CORE: state, api, helpers, availability ===================== */
'use strict';
const D = { // server data
  version: 0, categories:{}, products:{}, units:{}, customers:{}, orders:{}, maintenance:{}, crew:{}, settings:{}, users:{}, counters:{}
};
const UI = {
  me:null, ready:false, online:true, route:'dashboard',
  prodTab:'all', prodCat:'all', prodQ:'', prodSel:new Set(), ordSel:new Set(),
  ordTab:'active', ordQ:'',
  custQ:'', mntTab:'open',
  calMode:'orders', calStart:null, calDays:28, calCat:'all',
  repFrom:null, repTo:null, setTab:'company',
  draft:null, scan:null, gsearch:'', info:null
};
const STATUS = {
  concept:{l:'Πρόχειρο', c:'gray'}, option:{l:'Option', c:'purple'}, reserved:{l:'Κράτηση', c:'blue'},
  started:{l:'Παραλήφθηκε', c:'orange'}, stopped:{l:'Επιστράφηκε', c:'green'}, cancelled:{l:'Ακυρώθηκε', c:'red'}
};
const HOLD = ['option','reserved','started'];
const REVENUE = ['reserved','started','stopped'];
const MSTATUS = { open:{l:'Ανοιχτό', c:'red'}, repair:{l:'Σε επισκευή', c:'orange'}, done:{l:'Ολοκληρώθηκε', c:'green'} };
const ROLES = { admin:'Διαχειριστής', staff:'Προσωπικό', viewer:'Μόνο ανάγνωση', tech:'Τεχνικός (χωρίς τιμές)' };
const FAR = '9999-12-31';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const MODE = window.WH_MODE || 'server';
const SERVER = MODE==='server';
const today = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const isM = () => window.matchMedia('(max-width:700px)').matches;
let _wasM=null; window.addEventListener('resize', ()=>{ const m=isM(); if(_wasM!==null&&m!==_wasM&&typeof scheduleRender==='function') scheduleRender(); _wasM=m; });
const addDays = (s,n) => { const d=new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const diffDays = (a,b) => Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/864e5);
const fmtD = s => s && s!==FAR ? s.split('-').reverse().join('/') : '—';
const fmtDT = ts => ts ? new Date(ts).toLocaleString('el-GR',{dateStyle:'short',timeStyle:'short'}) : '—';
const DOW = ['Κυ','Δε','Τρ','Τε','Πε','Πα','Σα'];
const MONTHS = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
const dow = s => new Date(s+'T00:00:00Z').getUTCDay();
const num = v => { const n=parseFloat(String(v??'').replace(',','.')); return isFinite(n)?n:0; };
const r2 = n => Math.round((n+Number.EPSILON)*100)/100;
const money = n => NOPRICE() ? '—' : r2(+n||0).toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const pill = (st, map=STATUS) => `<span class="pill ${(map[st]||{}).c||'gray'} ${map===STATUS?'solid':''}">${esc((map[st]||{}).l||st)}</span>`;
const PAY = { none:{l:'—',c:'gray'}, due:{l:'Οφειλή',c:'orange'}, partial:{l:'Μερική πληρωμή',c:'orange'}, paid:{l:'Εξοφλήθηκε',c:'green'}, over:{l:'Υπερπληρωμή',c:'purple'} };
function payStatus(o){ const t=orderTotals(o); if(t.total<=0 && !t.paid) return 'none'; if(t.paid<=0) return 'due'; if(t.paid+0.01<t.total) return 'partial'; if(t.paid>t.total+0.01) return 'over'; return 'paid'; }
const initials = s => String(s||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const avColor = s => { let h=0; for(const ch of String(s||'')) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h} 55% 48%)`; };
const can = lvl => { const r=UI.me?.role; return ({admin:3,staff:2,viewer:1,tech:2}[r]||0) >= ({admin:3,staff:2,viewer:1}[lvl]||0); };
const NOPRICE = () => UI.me?.role==='tech';
const settings = () => D.settings.company || {};
const vatRate = () => { const v=settings().vatRate; return v===undefined||v===''?24:num(v); };
const debounce = (fn, ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const deepCopy = o => JSON.parse(JSON.stringify(o));
const sortBy = (arr, f) => arr.slice().sort((a,b)=>{ const x=f(a), y=f(b); return typeof x==='string'? x.localeCompare(y,'el') : x-y; });
function toast(msg, err){ const t=document.createElement('div'); t.textContent=msg; if(err) t.className='err'; const tb=$('#toast'); tb.appendChild(t); while(tb.children.length>3) tb.firstChild.remove(); setTimeout(()=>t.remove(), err?5500:2600); }

/* ---------- API ---------- */
async function api(path, body, method){
  const opt = { method: method || (body!==undefined?'POST':'GET'), headers:{}, credentials:'same-origin' };
  if(body!==undefined){ opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body); }
  let res;
  try{ res = await fetch(path, opt); }catch(e){ throw {status:0, error:'Δεν υπάρχει σύνδεση με τον server της αποθήκης.'}; }
  let data=null; try{ data = await res.json(); }catch(e){}
  if(!res.ok){ if(res.status===401 && path!=='/api/login' && path!=='/api/me'){ UI.me=null; renderLogin(); } throw {status:res.status, error:(data&&data.error)||('Σφάλμα '+res.status)}; }
  return data;
}
async function loadState(){
  const s = await api('/api/state');
  for(const k of ['categories','products','units','customers','orders','maintenance','crew','settings','users']){
    const m={}; for(const d of (s.data[k]||[])) if(d&&d.id) m[d.id]=d; D[k]=m;
  }
  D.counters = s.counters||{}; D.version = s.version; bump();
}
/* ops: [{op:'put'|'del', coll, id, doc}] */
async function commit(ops, summary, quiet){
  if(!can('staff')){ toast('Έχεις δικαίωμα μόνο ανάγνωσης.', true); return false; }
  try{
    const r = await api('/api/batch', {ops, summary:summary||''});
    for(const o of ops){ if(o.op==='del') delete D[o.coll][o.id]; else D[o.coll][o.id] = {...deepCopy(o.doc), id:o.id, updatedAt:Date.now(), createdAt:D[o.coll][o.id]?.createdAt||Date.now()}; }
    D.version = Math.max(D.version, r.version); bump();
    if(summary && !quiet) toast(summary);
    return true;
  }catch(e){ toast(e.error||'Σφάλμα αποθήκευσης', true); return false; }
}
const put = (coll, id, doc, summary, quiet) => commit([{op:'put', coll, id, doc}], summary, quiet);
const del = (coll, id, summary) => commit([{op:'del', coll, id}], summary);
async function nextNumber(name){ const r = await api('/api/next', {name}); return r.n; }
function strip(doc){ const d={...doc}; delete d.id; delete d.updatedAt; delete d.createdAt; delete d.updatedBy; for(const k of Object.keys(d)) if(k.startsWith('_')) delete d[k]; return deepCopy(d); }

let es=null;
function connectEvents(){
  if(es) es.close();
  es = new EventSource('/api/events');
  es.onmessage = ev => { UI.online=true; updateConn(); const v=+ev.data; if(v>D.version) loadState().catch(()=>{}); };
  es.onerror = () => { UI.online=false; updateConn(); };
  es.onopen = () => { checkBuild(); };
}
/* ---------- αυτόματη ανανέωση όταν βγει νέα έκδοση ---------- */
let BUILD=null, _bcheck=0;
async function checkBuild(){
  if(!SERVER||Date.now()-_bcheck<5000) return; _bcheck=Date.now();
  try{ const r=await fetch('/api/build',{cache:'no-store'}); const b=(await r.json()).build; if(!b) return;
    if(BUILD===null){ BUILD=b; return; }
    if(b!==BUILD){
      const busy = modalOpen() || (UI.draft&&(UI.draft._dirty||UI.draft._saving)) || (document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) || document.getElementById('dpov')?.classList.contains('on') || document.querySelector('.cam');
      if(!busy){ location.reload(); return; }
      if(!document.getElementById('newver')){ const d=document.createElement('div'); d.id='newver'; d.innerHTML='Υπάρχει νέα έκδοση της εφαρμογής <button class="btn sm pri" onclick="location.reload()">Ανανέωση</button>'; document.body.appendChild(d); }
    } }catch(e){}
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) checkBuild(); });
setInterval(checkBuild, 120000);
function updateConn(){ const el=$('#conn'); if(!el) return; el.className='conn '+(UI.online?'ok':'bad'); el.title=UI.online?'Συνδεδεμένο — οι αλλαγές συγχρονίζονται ζωντανά':'Χάθηκε η σύνδεση με τον server'; el.querySelector('span').textContent=UI.online?'Live':'Εκτός σύνδεσης'; }

/* ---------- lookups ---------- */
function catPath(id){ const out=[]; let c=D.categories[id], g=0; while(c&&g++<10){ out.unshift(c.name); c=D.categories[c.parent]; } return out.join(' › '); }
function catDesc(id){ const set=new Set([id]); let added=true; while(added){ added=false; for(const c of Object.values(D.categories)) if(c.parent&&set.has(c.parent)&&!set.has(c.id)){ set.add(c.id); added=true; } } return set; }
function catsSorted(){ return Object.values(D.categories).map(c=>({...c, path:catPath(c.id)})).sort((a,b)=>a.path.localeCompare(b.path,'el')); }
function prodsSorted(list){ return sortBy(list||Object.values(D.products), p=>(catPath(p.cat)||'~')+'\u0001'+(p.name||'')); }
function unitsOf(pid, all){ return sortBy(Object.values(D.units).filter(u=>u.productId===pid && (all||u.status!=='retired')), u=>u.code||''); }
function custName(id){ const c=D.customers[id]; return c ? (c.company||c.name||'—') : ''; }
function prodName(id){ return D.products[id]?.name || '(διαγραμμένο)'; }
function findCode(code){
  const c=String(code||'').trim().toLowerCase(); if(!c) return null;
  const u=Object.values(D.units).find(x=>(x.code||'').toLowerCase()===c || (x.serial&&x.serial.toLowerCase()===c));
  if(u) return {type:'unit', unit:u, product:D.products[u.productId]};
  const p=Object.values(D.products).find(x=>(x.sku||'').toLowerCase()===c);
  if(p) return {type:'product', product:p};
  const o=Object.values(D.orders).find(x=>(x.number||'').toLowerCase()===c);
  if(o) return {type:'order', order:o};
  return null;
}
function nextSku(){ let max=0; for(const p of Object.values(D.products)){ const m=/^EQ-(\d+)$/i.exec(p.sku||''); if(m) max=Math.max(max,+m[1]); } return 'EQ-'+String(max+1).padStart(4,'0'); }
/* κωδικός σε μορφή Booqable: ΚΕΦΑΛΑΙΑ_ΜΕ_ΚΑΤΩ_ΠΑΥΛΑ (τα ελληνικά γίνονται λατινικά) */
const GR2LAT={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'TH',ι:'I',ί:'I',ϊ:'I',ΐ:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',ϋ:'Y',ΰ:'Y',φ:'F',χ:'CH',ψ:'PS',ω:'O',ώ:'O'};
function skuFromName(name, selfId){
  let b=[...String(name||'').toLowerCase()].map(c=>GR2LAT[c]??c).join('').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40).replace(/_+$/,'');
  if(!b) return '';
  const used=new Set(); for(const p of Object.values(D.products)) if(p.id!==selfId) used.add((p.sku||'').toUpperCase()); for(const u of Object.values(D.units)) used.add((u.code||'').toUpperCase());
  let s=b, n=2; while(used.has(s)) s=b+'_'+(n++); return s;
}
function nextUnitCode(p, extra=0){ let max=0; const pre=(p.sku||'U')+'-'; for(const u of Object.values(D.units)){ if(u.productId===p.id && (u.code||'').startsWith(pre)){ const n=parseInt(u.code.slice(pre.length)); if(n>max) max=n; } } return pre+String(max+1+extra).padStart(3,'0'); }

/* ---------- availability engine ---------- */
let _cache={ver:-1};
function expandLines(lines, mult=1, depth=0, out={}){
  for(const l of lines||[]){
    if(!l.pid) continue; const p=D.products[l.pid]; if(!p) continue;
    const q=(num(l.qty))*mult; if(!q) continue;
    if(p.kind==='bundle' && depth<4) expandLines(p.components, q, depth+1, out);
    else out[l.pid]=(out[l.pid]||0)+q;
  }
  return out;
}
function orderRange(o){ let s=o.start, e=o.end||o.start; if(o.status==='started' && e<today()) e=today(); return [s,e]; }
function cache(){
  if(_cache.ver===S_ver) return _cache;
  const resv={}; // pid -> [{s,e,q,soft,src}]
  const add=(pid,r)=>{ (resv[pid]=resv[pid]||[]).push(r); };
  const exp={};
  for(const o of Object.values(D.orders)){
    if(!HOLD.includes(o.status) || !o.start) continue;
    const [s,e]=orderRange(o); const x=expandLines(o.lines); exp[o.id]=x;
    // σε εξέλιξη: ό,τι επέστρεψε ήδη δεν δεσμεύεται
    for(const [pid,q] of Object.entries(x)){
      let qq=q;
      if(o.status==='started'){ const p=D.products[pid]; const ret = p?.tracking==='serial' ? (o.returned?.units||[]).filter(id=>D.units[id]?.productId===pid).length : (o.returned?.bulk?.[pid]||0); qq=Math.max(0,q-ret); }
      if(qq) add(pid,{s,e,q:qq,soft:o.status==='option',src:o.id});
    }
  }
  for(const m of Object.values(D.maintenance)){
    if(m.status==='done' || !m.productId || !D.products[m.productId]) continue;
    const s=m.start||today(); const e=m.end&&m.end>=today()?m.end:(m.end?today():FAR);
    add(m.productId,{s,e,q:m.unitId?1:Math.max(1,num(m.qty)),soft:false,src:m.id,mnt:true});
  }
  _cache={ver:S_ver,resv,exp}; return _cache;
}
let S_ver=0; function bump(){ S_ver++; scheduleRender(); }
function stockOf(pid){
  const p=D.products[pid]; if(!p) return 0;
  if(p.kind==='bundle'){ const cs=(p.components||[]).filter(c=>D.products[c.pid]&&num(c.qty)>0); if(!cs.length) return 0; return Math.min(...cs.map(c=>Math.floor(stockOf(c.pid)/num(c.qty)))); }
  if(p.tracking==='serial') return unitsOf(pid).length;
  return Math.max(0, Math.round(num(p.qty)));
}
function peakUse(pid, start, end, exclude){
  const list=(cache().resv[pid]||[]).filter(r=>r.src!==exclude && r.s<=end && r.e>=start);
  if(!list.length) return {hard:0, all:0};
  let hard=0, all=0; const n=Math.min(diffDays(start,end), 400);
  for(let i=0;i<=n;i++){ const d=addDays(start,i); let h=0,o=0; for(const r of list) if(d>=r.s&&d<=r.e){ if(r.soft) o+=r.q; else h+=r.q; } if(h>hard) hard=h; if(h+o>all) all=h+o; }
  return {hard, all};
}
function freeUnits(pid, start, end, exclude){
  const p=D.products[pid]; if(!p||!start) return {free:0, freeOpt:0};
  end=end||start;
  if(p.kind==='bundle'){
    const cs=(p.components||[]).filter(c=>D.products[c.pid]&&num(c.qty)>0); if(!cs.length) return {free:0,freeOpt:0};
    let f=Infinity, fo=Infinity; for(const c of cs){ const r=freeUnits(c.pid,start,end,exclude); f=Math.min(f,Math.floor(r.free/num(c.qty))); fo=Math.min(fo,Math.floor(r.freeOpt/num(c.qty))); }
    return {free:f, freeOpt:fo};
  }
  const u=peakUse(pid,start,end,exclude), st=stockOf(pid);
  return {free:st-u.hard, freeOpt:st-u.all};
}
function freeOnDay(pid, d){ return freeUnits(pid,d,d).free; }
function shortages(o){
  if(!o.start) return [];
  const need=expandLines(o.lines), out=[];
  for(const [pid,q] of Object.entries(need)){ const f=freeUnits(pid,o.start,o.end||o.start,o.id).free; if(q>f) out.push({pid, need:q, free:f, missing:q-Math.max(f,0)}); }
  return out;
}
function avCls(free, need=1){ return free<need||free<0?'bad':(free<=Math.max(1,need)?'low':'ok'); }
/* where is a unit right now */
function unitState(u){
  if(u.status==='retired') return {k:'retired', l:'Αποσύρθηκε', c:'gray'};
  const m=Object.values(D.maintenance).find(m=>m.unitId===u.id && m.status!=='done');
  if(m) return {k:'mnt', l:'Συντήρηση', c:'red', ref:m};
  const o=Object.values(D.orders).find(o=>o.status==='started' && (o.picked?.units||[]).includes(u.id) && !(o.returned?.units||[]).includes(u.id));
  if(o) return {k:'out', l:'Εκτός · '+(o.number||''), c:'orange', ref:o};
  return {k:'in', l:'Στην αποθήκη', c:'green'};
}

/* ---------- pricing ---------- */
function orderDays(o){ return o.start&&o.end ? Math.max(1, diffDays(o.start,o.end)+1) : 1; }
function hasExtra(l){ return l.priceType!=='flat' && l.extraPrice!=='' && l.extraPrice!=null && num(l.extraPrice)!==num(l.price); }
function lineUnitPeriod(l, days){ if(l.priceType==='flat') return num(l.price); const ex=hasExtra(l)?num(l.extraPrice):num(l.price); return num(l.price)+ex*Math.max(0,days-1); }
function lineTotal(l, days){ return r2(lineUnitPeriod(l,days)*num(l.qty)*(1-num(l.discount)/100)); }
/* τιμή επόμενων ημερών προϊόντος ('' = ίδια με την 1η) */
function productExtra(p){
  if(!p || p.priceType==='flat') return '';
  const pr=productPrice(p);
  if(p.extraMode==='amount' && p.extraValue!=='' && p.extraValue!=null) return r2(num(p.extraValue));
  if(p.extraMode==='pct' && p.extraValue!=='' && p.extraValue!=null) return r2(pr*num(p.extraValue)/100);
  if(p.kind==='bundle' && (p.price===''||p.price==null)){ let sum=0, diff=false; for(const c of p.components||[]){ const cp=D.products[c.pid]; if(!cp) continue; const e=productExtra(cp); if(e!==''){ diff=true; sum+=e*num(c.qty); } else sum+=productPrice(cp)*num(c.qty); } return diff?r2(sum):''; }
  return '';
}
function priceLabel(p){ const pr=productPrice(p); if(p.priceType==='flat') return money(pr); const ex=productExtra(p); return ex===''?money(pr)+'/ημ.':`${money(pr)} 1η ημ. · ${money(ex)} επόμ.`; }
/* ---------- συνεργείο ---------- */
const CREW_ROLES=['Ηχολήπτης','Τεχνικός ήχου','Φωτιστής','Τεχνικός φωτισμού','Τεχνικός video / LED','Rigger','Stage hand','Οδηγός','Βοηθός','Υπεύθυνος παραγωγής','Άλλο'];
const PAYT={day:'ανά ημέρα', hour:'ανά ώρα', flat:'κατ\' αποκοπή'};
function crewHours(a){ const f=(a.from||'').split(':'), t=(a.to||'').split(':'); if(f.length<2||t.length<2) return 8; let h=(+t[0]+t[1]/60)-(+f[0]+f[1]/60); if(h<=0) h+=24; return Math.round(h*100)/100; }
function crewDays(a){ return Math.max(1, diffDays(a.start, a.end||a.start)+1); }
function crewQty(basis, a){ return basis==='hour' ? crewHours(a)*crewDays(a) : (basis==='flat' ? 1 : crewDays(a)); }
function crewCost(a){ const p=D.crew[a.cid]||{}; if(a.cost!==undefined&&a.cost!==''&&a.cost!==null) return r2(num(a.cost)); return r2(num(p.cost)*crewQty(p.payType||'day',a)); }
function crewCharge(a){ if(a.bill===false) return 0; const p=D.crew[a.cid]||{}; if(a.charge!==undefined&&a.charge!==''&&a.charge!==null) return r2(num(a.charge)); return r2(num(p.rate)*crewQty(p.payType||'day',a)); }
const CREW_ST=['concept','option','reserved','started'];
function crewBusy(cid, start, end, exceptOrder, exceptAid){ // συγκρούσεις: άλλες παραγγελίες ή μη διαθεσιμότητα
  const out=[]; end=end||start;
  for(const o of Object.values(D.orders)){ if(!CREW_ST.includes(o.status)) continue;
    for(const a of o.crew||[]){ if(a.cid!==cid) continue; if(o.id===exceptOrder&&a.id===exceptAid) continue; const s=a.start, e=a.end||a.start; if(s<=end&&e>=start) out.push({type:'order', order:o, a}); } }
  const p=D.crew[cid]; for(const x of (p&&p.off)||[]){ if(x.start<=end&&(x.end||x.start)>=start) out.push({type:'off', off:x}); }
  return out;
}
function orderTotals(o){
  const days=orderDays(o); let sub=0;
  for(const l of o.lines||[]) sub+=lineTotal(l,days);
  const equip=r2(sub); let crewCh=0, crewCo=0; for(const a of o.crew||[]){ crewCh+=crewCharge(a); crewCo+=crewCost(a); }
  crewCh=r2(crewCh); crewCo=r2(crewCo); sub=r2(equip+crewCh); const disc=r2(sub*num(o.discount)/100); const net=r2(sub-disc); const vr=(o.vatRate!==undefined&&o.vatRate!==''&&o.vatRate!==null)?num(o.vatRate):vatRate(); const vat=r2(net*vr/100);
  const total=r2(net+vat); const paid=r2((o.payments||[]).reduce((s,p)=>s+num(p.amount),0));
  return {days, equip, crewCharge:crewCh, crewCost:crewCo, sub, disc, net, vat, vr, total, deposit:num(o.deposit), paid, due:r2(total-paid)};
}
function productPrice(p){
  if(!p) return 0;
  if(p.kind==='bundle' && (p.price===''||p.price==null)) return r2((p.components||[]).reduce((s,c)=>s+productPrice(D.products[c.pid])*num(c.qty),0));
  return num(p.price);
}

/* ---------- QR ---------- */
function qrMatrix(text){
  try{ const q=new QRLib.QRCode(-1, QRLib.EC.M); q.addData(String(text)); q.make(); const n=q.getModuleCount(); const m=[]; for(let r=0;r<n;r++){ m.push([]); for(let c=0;c<n;c++) m[r].push(q.isDark(r,c)); } return m; }catch(e){ return null; }
}
function qrSVG(text, size=160){
  const m=qrMatrix(text); if(!m) return '';
  const n=m.length, pad=2, tot=n+pad*2; let d='';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(m[r][c]) d+=`M${c+pad} ${r+pad}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot} ${tot}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${tot}" height="${tot}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
function qrPNG(text, px=800){
  const m=qrMatrix(text); if(!m) return null; const n=m.length, pad=4, tot=n+pad*2, s=Math.max(1,Math.floor(px/tot));
  const c=document.createElement('canvas'); c.width=c.height=tot*s; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.fillStyle='#000';
  for(let r=0;r<n;r++) for(let k=0;k<n;k++) if(m[r][k]) x.fillRect((k+pad)*s,(r+pad)*s,s,s);
  return c.toDataURL('image/png');
}
function download(filename, content, type){
  const blob = content instanceof Blob ? content : new Blob([content], {type: type||'text/plain;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function downloadCSV(filename, head, rows){
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  download(filename, '﻿'+[head.map(q).join(';'), ...rows.map(r=>r.map(q).join(';'))].join('\r\n'), 'text/csv;charset=utf-8');
}

/* ---------- QR scanning from camera / photo ---------- */
let jsqrPromise=null;
function loadJsQR(){ if(window.jsQR) return Promise.resolve(true); if(jsqrPromise) return jsqrPromise;
  jsqrPromise=new Promise(res=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload=()=>res(!!window.jsQR); s.onerror=()=>{ jsqrPromise=null; res(false); }; document.head.appendChild(s); });
  return jsqrPromise; }
async function detectInCanvas(canvas){
  if('BarcodeDetector' in window){ try{ const bd=new BarcodeDetector({formats:['qr_code','code_128','ean_13','code_39']}); const r=await bd.detect(canvas); if(r[0]) return r[0].rawValue; }catch(e){} }
  if(await loadJsQR()){ const x=canvas.getContext('2d'); const d=x.getImageData(0,0,canvas.width,canvas.height); const r=jsQR(d.data,canvas.width,canvas.height); if(r) return r.data; }
  return null;
}
function decodeFile(file){
  return new Promise(res=>{ const img=new Image(), url=URL.createObjectURL(file);
    img.onload=async()=>{ const sc=Math.min(1,1400/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=img.width*sc; c.height=img.height*sc; c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); res(await detectInCanvas(c)); };
    img.onerror=()=>res(null); img.src=url; });
}
/* opens camera overlay; calls onCode(code) for each detected code */
function openCamera(onCode, title){
  if(!(navigator.mediaDevices && window.isSecureContext)){
    // χωρίς HTTPS: φωτογραφία από την κάμερα
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.capture='environment';
    inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return; const c=await decodeFile(f); if(c) onCode(c); else toast('Δεν εντοπίστηκε QR στη φωτογραφία. Δοκίμασε πιο κοντά και με καλό φως.', true); };
    inp.click(); return;
  }
  const ov=document.createElement('div'); ov.className='cam';
  ov.innerHTML=`<div class="cam-box"><div class="row between"><b>${esc(title||'Σάρωση QR')}</b><button class="btn sm" data-x>Κλείσιμο</button></div><video playsinline muted></video><div class="small muted" data-msg>Στρέψε την κάμερα στον κωδικό…</div><div class="cam-last" data-last></div></div>`;
  document.body.appendChild(ov);
  const video=ov.querySelector('video'); let stream=null, stop=false, last='', lastT=0;
  const close=()=>{ stop=true; if(stream) stream.getTracks().forEach(t=>t.stop()); ov.remove(); };
  ov.querySelector('[data-x]').onclick=close;
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(s=>{ stream=s; video.srcObject=s; video.play(); loop(); })
    .catch(()=>{ ov.querySelector('[data-msg]').textContent='Δεν επιτράπηκε η πρόσβαση στην κάμερα.'; });
  const c=document.createElement('canvas');
  async function loop(){
    if(stop) return;
    if(video.readyState>=2){ const sc=Math.min(1,900/Math.max(video.videoWidth,1)); c.width=video.videoWidth*sc; c.height=video.videoHeight*sc; c.getContext('2d').drawImage(video,0,0,c.width,c.height);
      const code=await detectInCanvas(c);
      if(code && (code!==last || Date.now()-lastT>2500)){ last=code; lastT=Date.now(); const el=ov.querySelector('[data-last]'); let r=null; try{ r=onCode(code); }catch(e){}
        if(r&&typeof r==='object'&&'ok' in r){ el.textContent=r.msg||code; el.className='cam-last '+(r.ok?'ok':'bad'); ov.querySelector('.cam-box').classList.remove('fl-ok','fl-bad'); void ov.offsetWidth; ov.querySelector('.cam-box').classList.add(r.ok?'fl-ok':'fl-bad'); }
        else { if(navigator.vibrate) navigator.vibrate(60); el.textContent='✓ '+code; el.className='cam-last ok'; } }
    }
    setTimeout(loop, 250);
  }
}

/* ---------- ήχος & δόνηση σάρωσης ---------- */
let _ac=null;
function beep(ok){
  try{ if(navigator.vibrate) navigator.vibrate(ok?60:[120,80,120]); }catch(e){}
  try{ _ac=_ac||new (window.AudioContext||window.webkitAudioContext)(); const t=_ac.currentTime;
    const tone=(f,st,du)=>{ const o=_ac.createOscillator(), g=_ac.createGain(); o.type=ok?'sine':'square'; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t+st); g.gain.exponentialRampToValueAtTime(ok?0.25:0.12,t+st+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+st+du); o.connect(g).connect(_ac.destination); o.start(t+st); o.stop(t+st+du+0.02); };
    if(ok){ tone(1320,0,0.09); } else { tone(220,0,0.16); tone(180,0.2,0.22); } }catch(e){}
}

/* ---------- printing ---------- */
function docHTML(title, body, extraCss, withBtn){ return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  *{box-sizing:border-box} body{font-family:Inter,Arial,sans-serif;color:#111;margin:0;padding:14mm;font-size:10.5pt}
  h1{font-size:20pt;margin:0} table{width:100%;border-collapse:collapse;margin-top:6mm} th{text-align:left;border-bottom:1.5px solid #111;padding:2mm 1.5mm;font-size:9pt}
  td{border-bottom:1px solid #ddd;padding:2mm 1.5mm;vertical-align:top} .r{text-align:right} .muted{color:#666} .row{display:flex;justify-content:space-between;gap:10mm}
  .box{border:1px solid #ddd;border-radius:3mm;padding:4mm;flex:1} .tot{margin-left:auto;width:75mm;margin-top:4mm} .tot div{display:flex;justify-content:space-between;padding:1mm 0}
  .tot .g{font-weight:700;font-size:13pt;border-top:1.5px solid #111;padding-top:2mm} .sig{display:flex;gap:20mm;margin-top:22mm} .sig div{flex:1;border-top:1px solid #111;padding-top:2mm;text-align:center;font-size:9pt}
  .noprint{position:fixed;top:8px;right:8px} @media print{.noprint{display:none} body{padding:0}} @page{margin:12mm}
  ${extraCss}</style></head><body>${withBtn?'<div class="noprint"><button onclick="print()" style="padding:8px 14px;font-size:14px">Εκτύπωση</button></div>':''}${body}</body></html>`; }
function printHTML(title, body, extraCss=''){
  const inApp = isM() || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if(inApp){ // μέσα στην εφαρμογή: προβολή με κουμπί επιστροφής (στο κινητό τα νέα παράθυρα δεν έχουν «πίσω»)
    let ov=document.getElementById('docov'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='docov';
    ov.innerHTML=`<div class="docbar"><button class="btn" data-doc="close">← Πίσω</button><div class="docttl">${esc(title)}</div><button class="btn pri" data-doc="print">Εκτύπωση / PDF</button></div><iframe title="${esc(title)}"></iframe>`;
    document.body.appendChild(ov); document.body.classList.add('docopen');
    const fr=ov.querySelector('iframe'); fr.srcdoc=docHTML(title, body, extraCss, false);
    const PW=820; const fit=()=>{ const wrap=ov.clientWidth, bar=ov.querySelector('.docbar').offsetHeight; const k=Math.min(1, wrap/PW);
      fr.style.width=PW+'px'; fr.style.height=((ov.clientHeight-bar)/k)+'px'; fr.style.transform=`scale(${k})`; fr.style.transformOrigin='0 0'; };
    fit(); window.addEventListener('resize', fit);
    ov.addEventListener('click', e=>{ const a=e.target.closest('[data-doc]'); if(!a) return;
      if(a.dataset.doc==='close'){ ov.remove(); document.body.classList.remove('docopen'); }
      else { try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(_){ toast('Η εκτύπωση δεν είναι διαθέσιμη εδώ.', true); } } });
    history.pushState({doc:1}, ''); const pop=()=>{ if(document.getElementById('docov')){ ov.remove(); document.body.classList.remove('docopen'); } window.removeEventListener('popstate', pop); }; window.addEventListener('popstate', pop);
    return;
  }
  const w=window.open('', '_blank');
  if(!w){ toast('Ο browser μπλόκαρε το νέο παράθυρο — επίτρεψε τα pop-ups για αυτή τη σελίδα.', true); return; }
  w.document.write(docHTML(title, body, extraCss, true));
  w.document.close(); setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 400);
}
function printLabels(items){ // [{code,name,sub}]
  if(!items.length) return toast('Δεν επιλέχθηκαν είδη.', true);
  const body=`<div class="g">${items.map(it=>`<div class="l">${qrSVG(it.code,96)}<div>${LOGO?`<img class="lg" src="${LOGO}" alt="">`:''}<b>${esc(it.name)}</b><span>${esc(it.code)}</span><small>${esc(it.sub||'')}</small></div></div>`).join('')}</div>`;
  printHTML('Ετικέτες QR', body, `.l .lg{display:block;height:5mm;width:auto;margin-bottom:1mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}.l{border:1px dashed #bbb;padding:2.5mm;display:flex;gap:3mm;align-items:center;break-inside:avoid;height:32mm;overflow:hidden}.l svg{width:26mm;height:26mm;flex:none}.l b{display:block;font-size:10pt}.l span{display:block;font-family:monospace;font-size:10pt;margin:1mm 0}.l small{color:#666;font-size:7.5pt}`);
}

/* ---------- modal ---------- */
let M=null;
function openModal(html, cls=''){ $('#modal').innerHTML=`<div class="back" data-act="modal-back"><div class="dlg ${cls}" role="dialog">${html}</div></div>`; const f=$('#modal [autofocus]'); if(f) setTimeout(()=>f.focus(),10); }
function closeModal(){ $('#modal').innerHTML=''; M=null; if(renderPending) render(); }
function modalOpen(){ return !!$('#modal .back'); }
function confirmBox(title, text, yesLabel, onYes, danger=true){
  const prev=M; M={type:'confirm', onYes, prev};
  openModal(`<div class="dlg-h"><h2>${esc(title)}</h2></div><div class="dlg-b"><div>${esc(text)}</div></div><div class="dlg-f"><button class="btn" data-act="confirm-no">Άκυρο</button><button class="btn ${danger?'red':'pri'}" data-act="confirm-yes">${esc(yesLabel||'Ναι')}</button></div>`, 'sm');
}

/* ---------- render scheduling ---------- */
let renderPending=false;
function scheduleRender(){
  if(!UI.me) return;
  const a=document.activeElement;
  if(a && $('#view')?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && !['checkbox','radio','file','button'].includes(a.type) && !(a.dataset.enter && !a.value)){ renderPending=true; return; }
  if(modalOpen()){ renderPending=true; return; }
  render();
}
document.addEventListener('focusout', ()=>setTimeout(()=>{ if(renderPending && !modalOpen()){ const a=document.activeElement; if(!(a && $('#view')?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))){ render(); } } },0));

/* ---------- mode-neutral helpers (overridden in artifact mode) ---------- */
const NAMES = {};
function whoName(v){ return NAMES[v] || v || ''; }
async function loadLog(){ return api('/api/log'); }
async function buildBackup(){ throw {error:'Μη διαθέσιμο'}; }
async function restoreBackup(){ throw {error:'Μη διαθέσιμο'}; }
function dataURLtoBlob(u){ const [h,b]=u.split(','); const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:(h.match(/data:([^;]+)/)||[])[1]||'application/octet-stream'}); }

/* ---------- product images (square) ---------- */
/* λογότυπο για τα έγγραφα (ενσωματωμένο, ώστε να τυπώνεται πάντα) */
let LOGO='';
async function loadLogo(){ try{ const r=await fetch('logo.png'); if(r.ok) LOGO=await blobToDataURL(await r.blob()); }catch(e){} }
function blobToDataURL(b){ return new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(b); }); }
function squareImage(blob, size=600, fit='cover'){
  return new Promise((res,rej)=>{ const url=URL.createObjectURL(blob); const img=new Image();
    img.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,size,size);
      if(fit==='contain'){ const k=size*0.94/Math.max(img.width,img.height), w=img.width*k, h=img.height*k; x.imageSmoothingQuality='high'; x.drawImage(img,(size-w)/2,(size-h)/2,w,h); }
      else { const s=Math.min(img.width,img.height), sx=(img.width-s)/2, sy=(img.height-s)/2; x.drawImage(img,sx,sy,s,s,0,0,size,size); } URL.revokeObjectURL(url); c.toBlob(b=>b?res(b):rej(new Error('Αποτυχία επεξεργασίας εικόνας')),'image/jpeg',0.85); };
    img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('Το αρχείο δεν είναι εικόνα')); }; img.src=url; });
}
let storeImage = async blob => blobToDataURL(blob); // server: αποθήκευση μέσα στο προϊόν
function imgSrc(p){ return p ? (p.image || (SERVER ? p.imageUrl : '') || '') : ''; }
function prodImg(p, size=36){ const src=imgSrc(p); const st=`width:${size}px;height:${size}px`;
  return src ? `<img src="${esc(src)}" class="pimg" style="${st}" loading="lazy" alt="">` : `<span class="pimg ph" style="${st};font-size:${Math.max(9,size/3.2)}px">${esc(initials(p&&p.name))}</span>`; }

/* ---------- μεγάλο ημερολόγιο επιλογής διαστήματος (παραλαβή → επιστροφή) ---------- */
const GR_MON=['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
const GR_MON_S=['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
const GR_DOW=['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
function dpISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function dpParse(s){ const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(s||''); return m?new Date(+m[1],+m[2]-1,+m[3]):null; }
function dpLabel(s){ const d=dpParse(s); return d?`${GR_DOW[d.getDay()]} ${d.getDate()} ${GR_MON_S[d.getMonth()]} ${d.getFullYear()}`:'Επίλεξε ημερομηνία'; }
let DP=null;
function openRangePicker(o){ // o: {start,end,which:'start'|'end',onPick(start,end)}
  const s=dpParse(o.start)||new Date(), base=new Date(s.getFullYear(), s.getMonth(), 1);
  DP={...o, a:o.start, b:o.end, phase:o.which==='end'?1:0, view:base, hover:null};
  let ov=document.getElementById('dpov'); if(!ov){ ov=document.createElement('div'); ov.id='dpov'; document.body.appendChild(ov);
    ov.addEventListener('click', e=>{ const t=e.target.closest('[data-dp]'); if(e.target===ov) return closeRangePicker(); if(!t) return; const a=t.dataset.dp;
      if(a==='prev'){ DP.view=new Date(DP.view.getFullYear(), DP.view.getMonth()-1, 1); drawRangePicker(); }
      else if(a==='next'){ DP.view=new Date(DP.view.getFullYear(), DP.view.getMonth()+1, 1); drawRangePicker(); }
      else if(a==='close') closeRangePicker();
      else if(a==='today'){ const t0=new Date(); DP.view=new Date(t0.getFullYear(), t0.getMonth(), 1); drawRangePicker(); }
      else if(a==='phase'){ DP.phase=+t.dataset.v; drawRangePicker(); }
      else if(a==='ok'){ DP.onPick(DP.a, DP.b); closeRangePicker(); }
      else if(a==='day'){ const v=t.dataset.v;
        if(DP.phase===0){ DP.a=v; if(!DP.b||DP.b<v) DP.b=v; DP.phase=1; }
        else { if(v<DP.a){ DP.a=v; } else { DP.b=v; DP.onPick(DP.a, DP.b); return closeRangePicker(); } }
        drawRangePicker(); }
    });
    ov.addEventListener('mouseover', e=>{ const t=e.target.closest('[data-dp=day]'); const v=t?t.dataset.v:null; if(DP&&DP.phase===1&&v!==DP.hover){ DP.hover=v; ov.querySelectorAll('[data-dp=day]').forEach(c=>{ const x=c.dataset.v, e2=DP.hover&&DP.hover>DP.a?DP.hover:DP.b; c.classList.toggle('inr', x>DP.a&&x<e2); c.classList.toggle('end', x===e2); }); } });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape'&&DP) closeRangePicker(); });
  }
  drawRangePicker();
}
function closeRangePicker(){ DP=null; const ov=document.getElementById('dpov'); if(ov) ov.innerHTML='', ov.classList.remove('on'); }
function drawRangePicker(){
  const ov=document.getElementById('dpov'); if(!ov||!DP) return;
  const today=dpISO(new Date()), months=1;
  const month=(y,m)=>{ const first=new Date(y,m,1), off=(first.getDay()+6)%7, n=new Date(y,m+1,0).getDate(); let cells='';
    for(let i=0;i<off;i++) cells+='<span></span>';
    for(let d=1; d<=n; d++){ const v=dpISO(new Date(y,m,d)); const c=[v===today?'today':'', v===DP.a?'st':'', v===DP.b?'end':'', (v>DP.a&&v<DP.b)?'inr':'', (new Date(y,m,d).getDay()%6===0)?'we':''].join(' ');
      cells+=`<button type="button" data-dp="day" data-v="${v}" class="${c}">${d}</button>`; }
    return `<div class="dp-m"><div class="dp-mh">${GR_MON[m]} ${y}</div><div class="dp-g">${['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'].map(x=>`<b>${x}</b>`).join('')}${cells}</div></div>`; };
  let ms=''; for(let i=0;i<months;i++){ const d=new Date(DP.view.getFullYear(), DP.view.getMonth()+i, 1); ms+=month(d.getFullYear(), d.getMonth()); }
  const days=Math.round((dpParse(DP.b)-dpParse(DP.a))/864e5)+1;
  ov.classList.add('on');
  ov.innerHTML=`<div class="dp">
    <div class="dp-top"><button type="button" data-dp="phase" data-v="0" class="dp-f${DP.phase===0?' on':''}"><small>Παραλαβή</small>${dpLabel(DP.a)}</button><span class="dp-arr">→</span><button type="button" data-dp="phase" data-v="1" class="dp-f${DP.phase===1?' on':''}"><small>Επιστροφή</small>${dpLabel(DP.b)}</button><button type="button" class="icon" data-dp="close" title="Κλείσιμο">✕</button></div>
    <div class="dp-hint">${DP.phase===0?'Διάλεξε ημέρα <b>παραλαβής</b>':'Διάλεξε ημέρα <b>επιστροφής</b>'}</div>
    <div class="dp-body"><button type="button" class="dp-nav" data-dp="prev">‹</button><div class="dp-ms">${ms}</div><button type="button" class="dp-nav" data-dp="next">›</button></div>
    <div class="dp-foot"><button type="button" class="btn sm ghost" data-dp="today">Σήμερα</button><span class="muted small">${days>0?days+(days===1?' ημέρα':' ημέρες'):''}</span><button type="button" class="btn pri" data-dp="ok">Εντάξει</button></div>
  </div>`;
}
