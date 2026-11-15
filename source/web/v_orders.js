/* ===================== DASHBOARD + ORDERS ===================== */
'use strict';

/* ---------- dashboard ---------- */
VIEWS.dashboard = () => {
  const t=today(), orders=Object.values(D.orders);
  const pickToday=orders.filter(o=>o.status==='reserved'&&o.start<=t).sort((a,b)=>a.start.localeCompare(b.start));
  const retToday=orders.filter(o=>o.status==='started'&&(o.end||o.start)===t);
  const late=orders.filter(o=>o.status==='started'&&(o.end||o.start)<t);
  const pickSoon=orders.filter(o=>['reserved','option','concept'].includes(o.status)&&o.start>t&&o.start<=addDays(t,7)).sort((a,b)=>a.start.localeCompare(b.start));
  const retSoon=orders.filter(o=>o.status==='started'&&(o.end||o.start)>t&&(o.end||o.start)<=addDays(t,7)).sort((a,b)=>(a.end||'').localeCompare(b.end||''));
  const m0=t.slice(0,7);
  const rev=orders.filter(o=>REVENUE.includes(o.status)&&(o.start||'').startsWith(m0)).reduce((s,o)=>s+orderTotals(o).net,0);
  const short=orders.filter(o=>HOLD.includes(o.status)&&(o.end||o.start)>=t).map(o=>({o,s:shortages(o)})).filter(x=>x.s.length);
  const mnt=Object.values(D.maintenance).filter(m=>m.status!=='done');
  const oRow=(o,date)=>`<div class="li"><div class="grow"><a class="lk" href="#order-${o.id}">${esc(o.number||'')} · ${esc(o.name||custName(o.customerId)||'Χωρίς τίτλο')}</a><div class="small muted">${esc(custName(o.customerId))} ${date?'· '+date:''}</div></div>${pill(o.status)}</div>`;
  const prods=Object.values(D.products);
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const mq=isM()?`<div class="mquick"><a href="#wh" class="mq-a">${svg('truck')}<b>Αποθήκη</b><small>${pickToday.length} φόρτωση · ${retToday.length+late.length} επιστροφή</small></a><button class="mq-a" data-act="bn-scan">${svg('scan')}<b>Σάρωση</b><small>QR / barcode</small></button>${can('staff')?`<button class="mq-a" data-act="new-order">${svg('orders')}<b>Νέα</b><small>παραγγελία</small></button>`:''}</div>
    ${!standalone&&!UI.noInstall&&(ios||window._bip)?`<div class="banner minst"><img src="icon-192.png" alt=""><div class="grow"><b>Βάλε την Αποθήκη στην αρχική οθόνη</b><div class="small">${ios?'Πάτα <b>Κοινοποίηση</b> <span style="font-size:15px">⎋</span> κάτω και μετά <b>«Προσθήκη στην οθόνη Αφετηρίας»</b>.':'Ανοίγει σαν κανονική εφαρμογή, σε πλήρη οθόνη.'}</div></div>${!ios?'<button class="btn pri sm" data-act="pwa-install">Εγκατάσταση</button>':''}<button class="icon" data-act="pwa-hide">✕</button></div>`:''}`:'';
  return mq+`
  <div class="ph"><div><h1>${(h=>h<12?'Καλημέρα':(h<18?'Καλησπέρα':'Καλό βράδυ'))(new Date().getHours())}${UI.me.name?', '+esc(UI.me.name.split(' ')[0]):''} 👋</h1><p class="sub">${new Date().toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div>
  ${can('staff')?`<div class="row"><button class="btn" data-act="new-product">+ Νέο προϊόν</button><button class="btn pri" data-act="new-order">+ Νέα παραγγελία</button></div>`:''}</div>
  ${!prods.length?`<div class="card" style="margin-bottom:16px"><div class="empty"><b>Καλώς ήρθες! Ας στήσουμε την αποθήκη σου.</b>1. Στοιχεία εταιρείας στις Ρυθμίσεις · 2. Κατηγορίες · 3. Προϊόντα (με ποσότητα ή σειριακούς αριθμούς) · 4. Πελάτες · 5. Παραγγελίες
  <div class="row" style="justify-content:center;margin-top:14px"><a class="btn" href="#setup">Ρυθμίσεις</a><a class="btn" href="#categories">Κατηγορίες</a><button class="btn pri" data-act="new-product">+ Πρώτο προϊόν</button></div></div></div>`:''}
  ${late.length?`<div class="banner red">⚠ ${late.length} παραγγελία(ες) έχουν καθυστερήσει να επιστρέψουν: ${late.map(o=>`<a href="#order-${o.id}" style="color:inherit;font-weight:700">${esc(o.number)}</a>`).join(', ')}</div>`:''}
  <div class="grid g4" style="margin-bottom:16px">
    <div class="card stat click" data-act="go" data-href="#orders"><div class="n">${pickToday.length}</div><div class="l">Για παραλαβή σήμερα</div></div>
    <div class="card stat click" data-act="go" data-href="#orders"><div class="n">${retToday.length+late.length}</div><div class="l">Επιστροφές σήμερα${late.length?` <span class="pill red">${late.length} καθυστ.</span>`:''}</div></div>
    <div class="card stat"><div class="n">${orders.filter(o=>o.status==='started').length}</div><div class="l">Παραγγελίες σε εξέλιξη</div></div>
    <div class="card stat click" data-act="go" data-href="#reports"><div class="n">${money(rev)}</div><div class="l">Έσοδα ${MONTHS[+m0.slice(5)-1]} (καθαρά)</div></div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>Παραλαβές</h2>${pickToday.concat(pickSoon).length?pickToday.map(o=>oRow(o,'<b style="color:var(--orange)">σήμερα</b>')).join('')+pickSoon.map(o=>oRow(o,fmtD(o.start))).join(''):'<div class="muted">Καμία παραλαβή τις επόμενες 7 ημέρες.</div>'}</div>
    <div class="card"><h2>Επιστροφές</h2>${late.concat(retToday,retSoon).length?late.map(o=>oRow(o,`<b style="color:var(--red)">καθυστέρηση από ${fmtD(o.end)}</b>`)).join('')+retToday.map(o=>oRow(o,'<b style="color:var(--orange)">σήμερα</b>')).join('')+retSoon.map(o=>oRow(o,fmtD(o.end))).join(''):'<div class="muted">Καμία επιστροφή τις επόμενες 7 ημέρες.</div>'}</div>
    <div class="card"><h2>Ελλείψεις εξοπλισμού</h2>${short.length?short.map(x=>`<div class="li"><div class="grow"><a class="lk" href="#order-${x.o.id}">${esc(x.o.number)} · ${esc(x.o.name||custName(x.o.customerId))}</a><div class="small" style="color:var(--red)">${x.s.map(s=>`${esc(prodName(s.pid))} −${s.missing}`).join(', ')}</div></div>${pill(x.o.status)}</div>`).join(''):'<div class="muted">Καμία σύγκρουση διαθεσιμότητας 👍</div>'}</div>
    <div class="card"><h2>Συντήρηση σε εξέλιξη</h2>${mnt.length?sortBy(mnt,m=>m.start||'').slice(0,8).map(m=>`<div class="li"><div class="grow"><a class="lk" data-act="edit-mnt" data-id="${m.id}" href="#">${esc(m.title||'Βλάβη')}</a><div class="small muted">${esc(prodName(m.productId))}${m.unitId?' · '+esc(D.units[m.unitId]?.code||''):` · ${num(m.qty)||1} τεμ.`}${m.end?' · έως '+fmtD(m.end):''}</div></div>${pill(m.status,MSTATUS)}</div>`).join(''):'<div class="muted">Όλος ο εξοπλισμός είναι λειτουργικός.</div>'}</div>
  </div>`;
};

/* ---------- orders list ---------- */
UI.ordSt=new Set(); UI.ordPay=new Set(); UI.ordFrom=''; UI.ordTo=''; UI.ordTab='all'; UI.ordPage=1;
VIEWS.orders = () => {
  const t=today(); const all=Object.values(D.orders);
  const stCount={}, payCount={}; for(const o of all){ stCount[o.status]=(stCount[o.status]||0)+1; const ps=payStatus(o); payCount[ps]=(payCount[ps]||0)+1; }
  let list=all;
  if(UI.ordTab==='upcoming') list=list.filter(o=>['concept','option','reserved'].includes(o.status)&&o.start>=t);
  else if(UI.ordTab==='late') list=list.filter(o=>(o.status==='started'&&(o.end||o.start)<t)||(o.status==='reserved'&&o.start<t));
  else if(UI.ordTab==='short') list=list.filter(o=>HOLD.includes(o.status)&&shortages(o).length);
  if(UI.ordSt.size) list=list.filter(o=>UI.ordSt.has(o.status));
  if(UI.ordPay.size) list=list.filter(o=>UI.ordPay.has(payStatus(o)));
  if(UI.ordFrom) list=list.filter(o=>(o.end||o.start)>=UI.ordFrom); if(UI.ordTo) list=list.filter(o=>o.start<=UI.ordTo);
  const q=UI.ordQ.trim().toLowerCase();
  if(q) list=list.filter(o=>[o.number,o.name,o.venue,custName(o.customerId),o.notes].some(v=>(v||'').toLowerCase().includes(q)));
  list=sortBy(list, o=>-(parseInt(String(o.number||'').replace(/\D/g,''))||0));
  const rev=list.filter(o=>REVENUE.includes(o.status)).reduce((s,o)=>s+orderTotals(o).total,0);
  const due=list.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Math.max(0,orderTotals(o).due),0);
  const items=list.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+(o.lines||[]).filter(l=>l.pid).reduce((a,l)=>a+num(l.qty),0),0);
  const per=50, pages=Math.max(1,Math.ceil(list.length/per)); if(UI.ordPage>pages) UI.ordPage=pages; const pageList=list.slice((UI.ordPage-1)*per, UI.ordPage*per);
  const rows=pageList.map(o=>{ const tt=orderTotals(o); const cn=custName(o.customerId); const ps=payStatus(o);
    const lateS=o.status==='reserved'&&o.start<=t, lateE=o.status==='started'&&(o.end||o.start)<=t;
    return `<tr class="click${UI.ordSel.has(o.id)?' sel':''}" data-act="go" data-href="#order-${o.id}">${can('staff')?`<td style="width:34px"><input type="checkbox" data-act="o-sel" data-id="${o.id}" ${UI.ordSel.has(o.id)?'checked':''}></td>`:''}<td class="b">#${esc(String(o.number||'').replace(/^\D+0*/,''))}</td>
    <td>${cn?`<span class="cav" style="background:${avColor(cn)}">${esc(initials(cn))}</span>${esc(cn)}`:'<span class="faint">—</span>'}${o.name?`<div class="xs muted" style="margin-left:32px">${esc(o.name)}</div>`:''}</td>
    <td>${pill(o.status)}</td><td class="${lateS?'late':''}" style="white-space:nowrap">${fmtD(o.start)} ${esc(o.startTime||'')}</td><td class="faint">→</td><td class="${lateE?'late':''}" style="white-space:nowrap">${fmtD(o.end)} ${esc(o.endTime||'')}</td>
    <td class="num b">${money(tt.total)}</td><td>${o.status==='cancelled'?'':pill(ps,PAY)}</td></tr>`; }).join('');
  const mrows=pageList.map(o=>{ const tt=orderTotals(o); const cn=custName(o.customerId); const ps=payStatus(o);
    const late=(o.status==='reserved'&&o.start<=t)||(o.status==='started'&&(o.end||o.start)<=t);
    return `<a class="mrow" href="#order-${o.id}"><div class="mrow-m"><div class="mrow-t"><b>${esc(o.number)}</b> ${pill(o.status)}</div><div class="mrow-n">${esc(cn||o.name||'—')}</div><div class="mrow-s ${late?'late':''}">${fmtD(o.start)} → ${fmtD(o.end)}${o.venue?' · '+esc(o.venue):''}</div></div>
      <div class="mrow-r"><b>${money(tt.total)}</b>${o.status==='cancelled'?'':pill(ps,PAY)}</div></a>`; }).join('');
  const ck=(set,k,l,n)=>`<label><input type="checkbox" data-act="of-ck" data-set="${set}" data-v="${k}" ${UI[set].has(k)?'checked':''}> ${l}<span>(${n||0})</span></label>`;
  const tabs=[['all','Όλες'],['upcoming','Επερχόμενες'],['late','Καθυστερημένες'],['short','Με ελλείψεις']];
  return `<div class="ph"><div><h1>Παραγγελίες</h1></div>${can('staff')?`<button class="btn pri" data-act="new-order">Νέα παραγγελία</button>`:''}</div>
  <div class="split-l">
    ${isM()?`<button class="btn mfilt" data-act="mfilt">${UI.mfilt?'Απόκρυψη φίλτρων ▴':'Φίλτρα & εξαγωγή ▾'}${(UI.ordSt.size||UI.ordPay.size||UI.ordFrom||UI.ordTo)?' •':''}</button>`:''}
    <div class="fpanel${isM()&&!UI.mfilt?' mhide':''}">
      <div class="card"><h4>Κατάσταση</h4><div class="fbody">${ck('ordSt','concept','Πρόχειρο',stCount.concept)}${ck('ordSt','option','Option',stCount.option)}${ck('ordSt','reserved','Κράτηση',stCount.reserved)}${ck('ordSt','started','Παραλήφθηκε',stCount.started)}${ck('ordSt','stopped','Επιστράφηκε',stCount.stopped)}${ck('ordSt','cancelled','Ακυρώθηκε',stCount.cancelled)}</div></div>
      <div class="card"><h4>Πληρωμή</h4><div class="fbody">${ck('ordPay','due','Οφειλή',payCount.due)}${ck('ordPay','partial','Μερική πληρωμή',payCount.partial)}${ck('ordPay','paid','Εξοφλήθηκε',payCount.paid)}${ck('ordPay','over','Υπερπληρωμή',payCount.over)}</div></div>
      <div class="card"><h4>Περίοδος</h4><div style="padding:12px 14px;display:grid;gap:8px"><label class="f">Από<input type="date" data-bindc="ordFrom" value="${esc(UI.ordFrom)}"></label><label class="f">Έως<input type="date" data-bindc="ordTo" value="${esc(UI.ordTo)}"></label>${UI.ordFrom||UI.ordTo||UI.ordSt.size||UI.ordPay.size?'<button class="btn sm" data-act="of-clear">Καθαρισμός φίλτρων</button>':''}</div></div>
      <button class="btn" data-act="o-csv" style="justify-content:center">⬇ Εξαγωγή</button>
    </div>
    <div>
      <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l])=>`<button class="${UI.ordTab===k?'on':''}" data-act="tab" data-k="ordTab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="metrics"><div class="card"><div class="l">Παραγγελίες</div><div class="n">${list.length}</div></div><div class="card"><div class="l">Τεμάχια</div><div class="n">${items.toLocaleString('el-GR')}</div></div><div class="card"><div class="l">Έσοδα</div><div class="n">${money(rev)}</div></div><div class="card"><div class="l">Οφειλές</div><div class="n">${money(due)}</div></div></div>
      <div class="card p0"><div class="card-h"><input type="search" class="grow" placeholder="Αναζήτηση αριθμού, πελάτη, χώρου…" data-bind="ordQ" value="${esc(UI.ordQ)}" style="max-width:380px"><div class="row small muted">${list.length?`${(UI.ordPage-1)*per+1}–${Math.min(list.length,UI.ordPage*per)} από ${list.length}`:''}${pages>1?`<button class="btn sm" data-act="o-page" data-v="-1" ${UI.ordPage<=1?'disabled':''}>‹</button><button class="btn sm" data-act="o-page" data-v="1" ${UI.ordPage>=pages?'disabled':''}>›</button>`:''}</div></div>
      ${list.length&&isM()?`<div class="mlist">${mrows}</div>`:list.length?`${UI.ordSel.size?`<div class="bulkbar"><b>${UI.ordSel.size} επιλεγμένες</b><button class="btn sm" data-act="o-bulk-cancel">Ακύρωση</button>${can('staff')?`<button class="btn sm dangerous" data-act="o-bulk-del">Διαγραφή</button>`:''}<button class="btn sm ghost" data-act="o-sel-clear">Καθαρισμός επιλογής</button></div>`:''}<div class="tw"><table><thead><tr>${can('staff')?`<th><input type="checkbox" data-act="o-sel-all" ${pageList.length&&pageList.every(o=>UI.ordSel.has(o.id))?'checked':''}></th>`:''}<th>#</th><th>Πελάτης</th><th>Κατάσταση</th><th>Από</th><th></th><th>Έως</th><th class="num">Τιμή</th><th>Πληρωμή</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty"><b>Δεν βρέθηκαν παραγγελίες</b></div>`}</div>
    </div>
  </div>`;
};
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); window._bip=e; if(route()==='dashboard') scheduleRender(); });
ACT['pwa-install']=async()=>{ const e=window._bip; if(!e) return; e.prompt(); try{ await e.userChoice; }catch(_){} window._bip=null; render(); };
ACT['pwa-hide']=()=>{ UI.noInstall=true; try{ localStorage.setItem('noInstall','1'); }catch(e){} render(); };
try{ if(localStorage.getItem('noInstall')) UI.noInstall=true; }catch(e){}
ACT['o-sel']=el=>{ el.checked?UI.ordSel.add(el.dataset.id):UI.ordSel.delete(el.dataset.id); render(); };
ACT['o-sel-all']=el=>{ $$('[data-act=o-sel]').forEach(b=>el.checked?UI.ordSel.add(b.dataset.id):UI.ordSel.delete(b.dataset.id)); render(); };
ACT['o-sel-clear']=()=>{ UI.ordSel.clear(); render(); };
ACT['o-bulk-cancel']=()=>{ const ids=[...UI.ordSel].filter(id=>D.orders[id]&&!['cancelled','stopped'].includes(D.orders[id].status)); const out=ids.filter(id=>D.orders[id].status==='started');
  if(!ids.length) return toast('Οι επιλεγμένες είναι ήδη ακυρωμένες ή ολοκληρωμένες.', true);
  confirmBox(`Ακύρωση ${ids.length} παραγγελιών;`, (out.length?`Προσοχή: ${out.length} έχουν εξοπλισμό εκτός αποθήκης. `:'')+'Ο εξοπλισμός και το συνεργείο θα αποδεσμευτούν. Μπορείς να τις επαναφέρεις αργότερα.', 'Ακύρωση παραγγελιών', async()=>{
    const ops=ids.map(id=>{ const {id:_,...doc}=D.orders[id]; return {op:'put',coll:'orders',id,doc:{...doc,status:'cancelled'}}; });
    if(await commit(ops, `Ακύρωση ${ids.length} παραγγελιών`)) UI.ordSel.clear(); render(); }); };
ACT['o-bulk-del']=()=>{ const ids=[...UI.ordSel].filter(id=>D.orders[id]); const paid=ids.filter(id=>(D.orders[id].payments||[]).length).length; const out=ids.filter(id=>D.orders[id].status==='started').length;
  confirmBox(`Οριστική διαγραφή ${ids.length} παραγγελιών;`, `Δεν αναιρείται.${out?` ${out} έχουν εξοπλισμό εκτός αποθήκης.`:''}${paid?` ${paid} έχουν καταχωρημένες πληρωμές.`:''} Αν θέλεις απλώς να μην ισχύουν, προτίμησε «Ακύρωση».`, 'Διαγραφή', async()=>{
    if(await commit(ids.map(id=>({op:'del',coll:'orders',id})), `Διαγραφή ${ids.length} παραγγελιών`)) UI.ordSel.clear(); render(); }); };
ACT['mfilt']=()=>{ UI.mfilt=!UI.mfilt; render(); };
ACT['of-ck']=el=>{ const set=UI[el.dataset.set]; el.checked?set.add(el.dataset.v):set.delete(el.dataset.v); UI.ordPage=1; render(); };
ACT['of-clear']=()=>{ UI.ordSt.clear(); UI.ordPay.clear(); UI.ordFrom=''; UI.ordTo=''; render(); };
ACT['o-page']=el=>{ UI.ordPage+=+el.dataset.v; render(); window.scrollTo(0,0); };
ACT['o-csv']=()=>downloadCSV(`paraggelies-${today()}.csv`,['Αριθμός','Πελάτης','Τίτλος','Κατάσταση','Από','Έως','Καθαρή αξία','ΦΠΑ','Σύνολο','Πληρώθηκαν','Οφειλή'],
  sortBy(Object.values(D.orders),o=>o.number||'').map(o=>{ const t=orderTotals(o); return [o.number,custName(o.customerId),o.name,STATUS[o.status]?.l,o.start,o.end,t.net,t.vat,t.total,t.paid,t.due]; }));

/* ---------- new order ---------- */
async function createOrder(base){
  if(!can('staff')) return toast('Δεν έχεις δικαίωμα.', true);
  const n=await nextNumber('order'); const pre=settings().orderPrefix||'ORD-';
  const t=today(); const id=uid('or');
  const doc=Object.assign({number:pre+String(n).padStart(4,'0'), name:'', customerId:'', venue:'', start:t, end:addDays(t,1), startTime:'10:00', endTime:'10:00', status:'concept', lines:[], discount:0, deposit:0, notes:'', internalNotes:'', picked:{units:[],bulk:{}}, returned:{units:[],bulk:{}}}, base||{});
  if(await put('orders', id, doc, 'Δημιουργήθηκε η παραγγελία '+doc.number, true)) location.hash='order-'+id;
}
ACT['new-order']=()=>createOrder();

/* ---------- order draft ---------- */
const autosave = debounce(()=>saveOrder(), 900);
function leaveOrder(){ if(UI.draft&&UI.draft._dirty) saveOrder(); UI.draft=null; }
function getDraft(id){
  const srv=D.orders[id]; if(!srv) return null;
  if(!UI.draft || UI.draft.id!==id){ UI.draft=deepCopy(srv); UI.draft._dirty=false; }
  else if(!UI.draft._dirty && !UI.draft._saving && (srv.updatedAt||0)>(UI.draft.updatedAt||0)){ UI.draft=deepCopy(srv); UI.draft._dirty=false; }
  const d=UI.draft; d.lines=d.lines||[]; d.picked=d.picked||{units:[],bulk:{}}; d.returned=d.returned||{units:[],bulk:{}};
  d.picked.units=d.picked.units||[]; d.picked.bulk=d.picked.bulk||{}; d.returned.units=d.returned.units||[]; d.returned.bulk=d.returned.bulk||{};
  return d;
}
function dirty(rerender=true){ if(!UI.draft) return; UI.draft._dirty=true; autosave(); if(rerender) render(); else { const s=$('#saveState'); if(s) s.innerHTML='<span class="faint">Αποθήκευση…</span>'; } }
async function saveOrder(summary){
  const d=UI.draft; if(!d || !can('staff')) return;
  if(d.end && d.start && d.end<d.start) d.end=d.start;
  d._dirty=false; d._saving=true;
  const ok=await put('orders', d.id, strip(d), summary, !summary);
  d._saving=false;
  if(ok){ d.updatedAt=D.orders[d.id]?.updatedAt; } else d._dirty=true;
  const s=$('#saveState'); if(s) s.innerHTML=ok?'<span class="faint">✓ Αποθηκεύτηκε</span>':'<span style="color:var(--red)">Δεν αποθηκεύτηκε</span>';
}

/* ---------- order page ---------- */
VIEWS.order = id => {
  const d=getDraft(id);
  if(!d) return `<div class="empty"><b>Η παραγγελία δεν βρέθηκε</b><a href="#orders">← Παραγγελίες</a></div>`;
  const ro=!can('staff') || ['stopped','cancelled'].includes(d.status);
  const tt=orderTotals(d); const sh=shortages(d), shMap={}; sh.forEach(s=>shMap[s.pid]=s);
  const cust=D.customers[d.customerId]; const cn=custName(d.customerId);
  const t=today(); const late=d.status==='started'&&(d.end||d.start)<t;
  let primary='';
  if(can('staff')){
    if(d.status==='concept'||d.status==='option') primary=`<button class="btn pri" data-act="o-status" data-v="reserved">Κράτηση</button>`;
    else if(d.status==='reserved') primary=`<button class="btn orange" data-act="o-pickup">⤴ Παραλαβή</button>`;
    else if(d.status==='started') primary=`<button class="btn green" data-act="o-return">⤵ Επιστροφή</button>`;
    else if(d.status==='cancelled') primary=`<button class="btn" data-act="o-status" data-v="concept">Επαναφορά σε πρόχειρο</button>`;
  }
  const lineRows=d.lines.map((l,i)=>{
    const p=l.pid?D.products[l.pid]:null;
    if(l.pid && !p) return `<tr><td colspan="7" class="muted">Το προϊόν διαγράφηκε ${ro?'':`<button class="icon" data-act="o-line-del" data-i="${i}">✕</button>`}</td></tr>`;
    let avail='<span class="faint">—</span>', problem='', sub='';
    if(p){
      const fr=freeUnits(l.pid,d.start,d.end,d.id); const cls=avCls(fr.free, num(l.qty));
      avail=`<span class="avpill ${cls}" title="Διαθέσιμα για ${fmtD(d.start)}–${fmtD(d.end)} πέρα από αυτή την παραγγελία">${cls==='bad'?'⚠':'✓'} ${fr.free} διαθ.</span>${fr.freeOpt<fr.free?`<div class="xs" style="color:var(--purple)">${fr.freeOpt} με options</div>`:''}`;
      if(p.kind==='bundle'){ const bad=(p.components||[]).filter(c=>shMap[c.pid]); if(bad.length) problem=`<div class="xs" style="color:var(--red)">Λείπουν: ${bad.map(c=>`${esc(prodName(c.pid))} −${shMap[c.pid].missing}`).join(', ')}</div>`;
        sub=`<div class="xs muted">${(p.components||[]).map(c=>`${esc(prodName(c.pid))} ×${num(c.qty)*num(l.qty)}`).join(' · ')}</div>`; }
      else if(shMap[l.pid]) problem=`<div class="xs" style="color:var(--red)">Λείπουν ${shMap[l.pid].missing} τεμ. στις ημερομηνίες</div>`;
    }
    const name = p ? `<div class="line-name pcell" style="gap:8px">${prodImg(p,34)}<span><a class="lk" href="#product-${p.id}">${esc(p.name)}</a> ${p.kind==='bundle'?'<span class="tag">Bundle</span>':''}${p.tracking==='serial'?'<span class="tag">S/N</span>':''}</span></div>${ro?(l.note?`<div class="xs muted">${esc(l.note)}</div>`:''):`<input type="text" value="${esc(l.note||'')}" data-ol="${i}" data-f="note" placeholder="Σημείωση γραμμής" class="xs" style="border:none;padding:2px 0;width:100%;background:transparent;color:var(--muted)">`}`
      : `<input type="text" value="${esc(l.name)}" data-ol="${i}" data-f="name" placeholder="Περιγραφή (π.χ. Μεταφορά, Τεχνικός)" ${ro?'disabled':''} style="width:100%">`;
    return `<tr><td>${name}${sub}${problem}</td>
      <td>${avail}</td>
      <td>${ro?`<b>${num(l.qty)}</b>`:`<span class="qbox"><button data-act="o-qty" data-i="${i}" data-d="-1">−</button><input type="number" min="0" step="1" value="${esc(l.qty)}" data-ol="${i}" data-f="qty"><button data-act="o-qty" data-i="${i}" data-d="1">+</button></span>`}</td>
      <td style="white-space:nowrap"><select data-ol="${i}" data-f="priceType" ${ro?'disabled':''} style="padding:5px 4px;font-size:12px;max-width:96px"><option value="day" ${l.priceType!=='flat'?'selected':''}>/ημέρα ×${tt.days}</option><option value="flat" ${l.priceType==='flat'?'selected':''}>περιόδου</option></select> <input type="number" class="price" min="0" step="0.01" value="${esc(l.price)}" data-ol="${i}" data-f="price" ${ro?'disabled':''} title="${l.priceType==='flat'?'Τιμή για όλη την περίοδο':'Τιμή 1ης ημέρας'}">${l.priceType!=='flat'&&tt.days>1?`<div class="xs muted" style="margin-top:3px;text-align:right">επόμενες ${tt.days-1} ημ. × <input type="number" min="0" step="0.01" value="${esc(hasExtra(l)?l.extraPrice:'')}" placeholder="${esc(l.price)}" data-ol="${i}" data-f="extraPrice" ${ro?'disabled':''} style="width:70px;padding:2px 5px;font-size:12px;text-align:right" title="Τιμή για κάθε επόμενη ημέρα (κενό = ίδια με την 1η)"> €</div>`:''}</td>
      <td><input type="number" class="pct" min="0" max="100" step="1" value="${esc(l.discount||'')}" placeholder="0%" data-ol="${i}" data-f="discount" ${ro?'disabled':''} title="Έκπτωση γραμμής %"></td>
      <td class="num b" style="white-space:nowrap">${money(lineTotal(l,tt.days))}</td>
      <td class="num">${ro?'':`<button class="icon" data-act="o-line-del" data-i="${i}" title="Αφαίρεση">✕</button>`}</td></tr>`;
  }).join('');
  const custOpts=sortBy(Object.values(D.customers),c=>c.company||c.name||'').map(c=>`<option value="${c.id}" ${c.id===d.customerId?'selected':''}>${esc(c.company||c.name)}${c.company&&c.name?' — '+esc(c.name):''}</option>`).join('');
  const showFlow = ['reserved','started','stopped'].includes(d.status) && d.lines.some(l=>l.pid);
  const ps=payStatus(d);
  return `
  <div class="ohead"><h1><a href="#orders" style="color:var(--muted);text-decoration:none;font-weight:600">Παραγγελίες</a> <span class="faint">›</span> #${esc(String(d.number||'').replace(/^\D+0*/,''))} ${pill(d.status)} ${late?'<span class="pill red solid">Καθυστέρηση</span>':''}</h1>
    <span id="saveState" class="small"></span><div class="grow"></div>
    ${primary}
    ${can('staff')?`<div class="dd"><button class="btn" data-act="dd">⋯ Ενέργειες</button><div class="dd-m">
      ${['concept','reserved'].includes(d.status)?'<button data-act="o-status" data-v="option">Option (προσωρινή δέσμευση)</button>':''}
      ${d.status==='option'?'<button data-act="o-status" data-v="concept">Επαναφορά σε πρόχειρο</button>':''}
      ${d.status==='reserved'?'<button data-act="o-status" data-v="concept">Αποδέσμευση (πρόχειρο)</button>':''}
      ${d.status==='started'?'<button data-act="o-status" data-v="reserved">Αναίρεση παραλαβής</button>':''}
      ${d.status==='stopped'?'<button data-act="o-status" data-v="started">Επαναφορά σε «Παραλήφθηκε»</button>':''}
      <button data-act="o-dup">Αντιγραφή παραγγελίας</button>
      ${!['cancelled','stopped'].includes(d.status)?'<button data-act="o-status" data-v="cancelled" style="color:var(--red)">Ακύρωση παραγγελίας</button>':''}
      <button data-act="o-del" style="color:var(--red)">Διαγραφή</button></div></div>`:''}</div>
  ${sh.length&&HOLD.includes(d.status)?`<div class="banner red">⚠ Δεν επαρκεί ο εξοπλισμός: ${sh.map(s=>`${esc(prodName(s.pid))} (λείπουν ${s.missing})`).join(', ')}</div>`:''}
  ${sh.length&&d.status==='concept'?`<div class="banner orange">Αν γίνει κράτηση θα υπάρξουν ελλείψεις: ${sh.map(s=>`${esc(prodName(s.pid))} −${s.missing}`).join(', ')}</div>`:''}
  <div class="ogrid">
    <div class="grid" style="align-content:start">
      <div class="otop">
        <div class="card"><h2>Πελάτης</h2>
          ${cust?`<div class="row" style="margin-bottom:12px;flex-wrap:nowrap"><span class="cav" style="background:${avColor(cn)};width:38px;height:38px;font-size:13px">${esc(initials(cn))}</span><div class="grow"><a class="lk" href="#customer-${cust.id}" style="font-size:15px">${esc(cn)}</a><div class="xs muted">${esc([cust.company?cust.name:'',cust.phone,cust.email].filter(Boolean).join(' · '))}</div>${num(cust.discount)?`<div class="xs b" style="color:var(--green)">Έκπτωση πελάτη ${num(cust.discount)}%</div>`:''}</div></div>`:''}
          ${ro?'':`<div class="row" style="flex-wrap:nowrap"><div class="cpick"><span class="cpick-i">${svg('search')}</span><input type="text" id="custQ" placeholder="${cust?'Αλλαγή πελάτη — ':''}Γράψε όνομα, εταιρεία, τηλέφωνο ή ΑΦΜ…" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="cpick-dd" id="custDD"></div></div>${cust?'<button class="btn sm ghost" data-act="o-cust-clear" title="Αφαίρεση πελάτη">✕</button>':''}<button class="btn sm" data-act="o-new-cust" title="Νέος πελάτης">+ Νέος</button></div>`}
          <div style="margin-top:12px" class="grid"><label class="f">Τίτλος / εκδήλωση<input type="text" data-o="name" value="${esc(d.name)}" placeholder="π.χ. Συνέδριο" ${ro?'disabled':''}></label><label class="f">Χώρος / διεύθυνση παράδοσης<input type="text" data-o="venue" value="${esc(d.venue)}" ${ro?'disabled':''}></label></div>
        </div>
        <div class="card"><h2>Παραλαβή & επιστροφή</h2>
          <div class="grid" style="gap:12px">
            <div><div class="small muted b" style="margin-bottom:4px">Από</div><div class="row" style="flex-wrap:nowrap"><button type="button" class="dpbtn" data-act="o-dp" data-which="start" ${ro?'disabled':''}>${svg('cal')}${dpLabel(d.start)}</button><input type="time" data-o="startTime" value="${esc(d.startTime)}" ${ro?'disabled':''} style="width:120px;flex:none"></div></div>
            <div><div class="small muted b" style="margin-bottom:4px">Έως</div><div class="row" style="flex-wrap:nowrap"><button type="button" class="dpbtn" data-act="o-dp" data-which="end" ${ro?'disabled':''}>${svg('cal')}${dpLabel(d.end)}</button><input type="time" data-o="endTime" value="${esc(d.endTime)}" ${ro?'disabled':''} style="width:120px;flex:none"></div></div>
            <div class="small muted">${tt.days} ${tt.days===1?'ημέρα':'ημέρες'} χρέωσης</div>
          </div></div>
      </div>
      <div class="card p0">
        ${ro?'':`<div style="padding:12px 16px;border-bottom:1px solid var(--line)" class="row">
          <div class="pick-add grow"><input type="search" id="oAdd" placeholder="🔍 Αναζήτηση για προσθήκη προϊόντων ή σάρωση κωδικού + Enter" data-enter="o-add-code" autocomplete="off" style="width:100%"><div class="gres" id="oAddRes" style="display:none"></div></div>
          <button class="btn" data-act="o-cam-add" title="Σάρωση με κάμερα">📷</button><button class="btn" data-act="o-custom">+ Ελεύθερη γραμμή</button></div>`}
        ${d.lines.length?`<div class="tw"><table><thead><tr><th class="ocol-name">Προϊόν</th><th>Διαθέσιμα</th><th>Ποσότητα</th><th>Χρέωση</th><th>Έκπτ.</th><th class="num">Σύνολο</th><th></th></tr></thead><tbody>${lineRows}</tbody></table></div>`
        :'<div class="empty" style="padding:30px">Δεν έχουν προστεθεί προϊόντα ακόμη.</div>'}
        <div class="sum" style="padding:12px 16px;border-top:1px solid var(--line);max-width:360px;margin-left:auto">
          ${tt.crewCharge?`<div><span class="muted">Εξοπλισμός</span><span>${money(tt.equip)}</span></div><div><span class="muted">Συνεργείο</span><span>${money(tt.crewCharge)}</span></div>`:''}
          <div><span class="muted">Υποσύνολο</span><span>${money(tt.sub)}</span></div>
          <div><span class="muted">Έκπτωση <input type="number" class="pct" min="0" max="100" step="0.01" data-o="discount" value="${esc(d.discount||'')}" placeholder="0" ${ro?'disabled':''} style="padding:3px 6px"> %</span><span>−${money(tt.disc)}</span></div>
          <div><span class="muted">Καθαρή αξία</span><span>${money(tt.net)}</span></div>
          <div><span class="muted">ΦΠΑ ${tt.vr}%</span><span>${money(tt.vat)}</span></div>
          <div class="g"><span>Σύνολο</span><span>${money(tt.total)}</span></div>
          <div><span class="muted">Εγγύηση</span><span><input type="number" class="price" min="0" step="1" data-o="deposit" value="${esc(d.deposit||'')}" placeholder="0" ${ro?'disabled':''} style="padding:3px 6px"> €</span></div>
        </div>
      </div>
      ${crewCard(d,ro)}
      ${showFlow?flowCard(d):''}
    </div>
    <div class="grid" style="align-content:start">
      <div class="card sidecard"><h4>Έγγραφα</h4><div class="sb">
        <button class="sidebtn" data-act="doc" data-v="quote">📄 ${d.quoteNo?'Προσφορά '+esc(d.quoteNo):'Νέα προσφορά'}</button>
        <button class="sidebtn" data-act="doc" data-v="contract">✍️ Συμφωνητικό</button>
        <button class="sidebtn" data-act="doc" data-v="delivery">🚚 Δελτίο αποστολής / packing slip</button></div></div>
      <div class="card sidecard"><h4>Τιμολόγια</h4><div class="sb"><button class="sidebtn" data-act="doc" data-v="invoice">🧾 ${d.invoiceNo?'Προτιμολόγιο '+esc(d.invoiceNo):'Νέο προτιμολόγιο'}<span style="margin-left:auto" class="b">${money(tt.total)}</span></button></div></div>
      <div class="card sidecard"><h4>Πληρωμές ${d.status!=='cancelled'?pill(ps,PAY):''}</h4><div class="sb">
        <div class="sum" style="font-size:13.5px"><div><span class="muted">Πληρώθηκαν</span><span>${money(tt.paid)}</span></div><div><span class="muted">Οφειλή</span><span class="b">${money(tt.due)}</span></div></div>
        ${(d.payments||[]).map((p,i)=>`<div class="li" style="padding:6px 0"><div><div class="small b">${money(p.amount)}</div><div class="xs muted">${fmtD(p.date)} · ${esc(p.method||'')}${p.note?' · '+esc(p.note):''}</div></div>${can('staff')?`<button class="icon" data-act="o-pay-del" data-i="${i}">✕</button>`:''}</div>`).join('')}
        ${can('staff')&&d.status!=='cancelled'?'<button class="btn" data-act="o-pay-new" style="justify-content:center">+ Νέα πληρωμή</button>':''}</div></div>
      <div class="card sidecard"><h4>Σημειώσεις</h4><div class="sb">
        <label class="f">Στα έγγραφα<textarea data-o="notes" ${ro?'disabled':''}>${esc(d.notes)}</textarea></label>
        <label class="f">Εσωτερικές<textarea data-o="internalNotes" ${ro?'disabled':''}>${esc(d.internalNotes)}</textarea></label>
        <div class="xs faint">Δημιουργία ${fmtDT(d.createdAt)} · Αλλαγή ${fmtDT(d.updatedAt)} ${d.updatedBy?'από '+esc(whoName(d.updatedBy)):''}</div></div></div>
    </div>
  </div>`;
};
ACT['o-qty']=el=>{ const l=UI.draft.lines[+el.dataset.i]; l.qty=Math.max(0,num(l.qty)+(+el.dataset.d)); dirty(); };
ACT['o-pay-new']=()=>{ const d=UI.draft, tt=orderTotals(d); M={type:'pay'};
  openModal(`<div class="dlg-h"><h2>Νέα πληρωμή · ${esc(d.number)}</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <div class="f2"><label class="f">Ποσό €<input type="number" id="payAmt" step="0.01" value="${Math.max(0,tt.due).toFixed(2)}" autofocus></label><label class="f">Ημερομηνία<input type="date" id="payDate" value="${today()}"></label></div>
  <label class="f">Τρόπος<select id="payMethod"><option>Μετρητά</option><option>Κάρτα</option><option>Τραπεζική κατάθεση</option><option>Επιταγή</option><option>Άλλο</option></select></label>
  <label class="f">Σημείωση<input type="text" id="payNote"></label></div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="o-pay-save" data-primary>Καταχώριση</button></div>`,'sm'); };
ACT['o-pay-save']=async()=>{ const a=num($('#payAmt').value); if(!a) return toast('Συμπλήρωσε ποσό.', true); const d=UI.draft; d.payments=d.payments||[]; d.payments.push({id:uid('pay'), amount:a, date:$('#payDate').value||today(), method:$('#payMethod').value, note:$('#payNote').value}); closeModal(); d._dirty=true; await saveOrder('Πληρωμή '+money(a)+' · '+d.number); render(); };
ACT['o-pay-del']=el=>{ const d=UI.draft, i=+el.dataset.i, p=d.payments[i]; confirmBox('Διαγραφή πληρωμής;', money(p.amount)+' · '+fmtD(p.date), 'Διαγραφή', async()=>{ d.payments.splice(i,1); d._dirty=true; await saveOrder('Διαγραφή πληρωμής · '+d.number); render(); }); };

/* pick (reserved) / return (started) card */
function flowCard(d){
  const need=expandLines(d.lines);
  const mode=d.status==='reserved'?'pick':(d.status==='started'?'return':'done');
  const field=mode==='return'?'returned':'picked';
  let tot=0, doneN=0;
  const rows=Object.entries(need).map(([pid,q])=>{
    const p=D.products[pid]; if(!p) return '';
    let v, chips='';
    if(p.tracking==='serial'){
      const src = mode==='return' ? d.returned.units : d.picked.units;
      const mine = src.filter(id=>D.units[id]?.productId===pid);
      v=mine.length;
      chips = mine.map(id=>`<span class="chip">${esc(D.units[id]?.code||'?')}${mode!=='done'&&can('staff')?`<button data-act="o-unit-rm" data-id="${id}" title="Αφαίρεση">✕</button>`:''}</span>`).join('');
      if(mode==='return'){ const out=d.picked.units.filter(id=>D.units[id]?.productId===pid && !d.returned.units.includes(id)); if(out.length) chips+=`<div class="xs muted">Εκκρεμούν: ${out.map(id=>esc(D.units[id]?.code||'?')).join(', ')}</div>`; }
    } else v = (mode==='return'? d.returned.bulk[pid] : d.picked.bulk[pid]) || 0;
    tot+=q; doneN+=Math.min(v,q);
    const ctrl = mode==='done'||!can('staff') ? '' : (p.tracking==='serial' ? `<button class="btn sm" data-act="o-unit-pick" data-id="${pid}">Επιλογή</button>` : `<button class="icon" data-act="o-bulk" data-id="${pid}" data-d="-1">−</button><button class="icon" data-act="o-bulk" data-id="${pid}" data-d="1">+</button><button class="icon" data-act="o-bulk" data-id="${pid}" data-d="all" title="Όλα">✓✓</button>`);
    const dmg = mode==='return'&&can('staff') ? `<button class="btn sm dangerous" data-act="o-damage" data-id="${pid}">Βλάβη</button>` : '';
    return `<tr><td><div class="b">${esc(p.name)}</div><div class="xs muted mono">${esc(p.sku)}${p.location?' · 📍 '+esc(p.location):''}</div>${chips?`<div>${chips}</div>`:''}</td>
      <td class="num" style="white-space:nowrap"><b class="${v>=q?'av ok':''}">${v}</b> / ${q}</td><td class="num" style="white-space:nowrap">${ctrl} ${dmg}</td></tr>`;
  }).join('');
  const pct = tot?Math.round(100*doneN/tot):0;
  const title = mode==='pick'?'Προετοιμασία & παραλαβή':(mode==='return'?'Επιστροφή εξοπλισμού':'Ολοκληρώθηκε');
  return `<div class="card p0"><div class="card-h"><h2>${title}</h2><span class="small muted">${mode==='done'?'Επιστράφηκαν':(mode==='pick'?'Έτοιμα':'Επέστρεψαν')} ${doneN}/${tot}</span></div>
    <div style="padding:12px 18px;display:grid;gap:10px"><div class="bar"><i style="width:${pct}%"></i></div>
    ${mode!=='done'&&can('staff')?`<div class="scanbox"><span>▣</span><input type="text" id="flowScan" placeholder="Σκάναρε QR τεμαχίου ή προϊόντος + Enter (${mode==='pick'?'φόρτωση':'επιστροφή'})" data-enter="o-flow-scan" autocomplete="off"><button class="btn sm" data-act="o-cam-flow">📷 Κάμερα</button></div>`:''}</div>
    <div class="tw"><table><tbody>${rows}</tbody></table></div>
    ${mode==='pick'&&can('staff')?`<div class="row end" style="padding:12px 18px;border-top:1px solid var(--line)">${pct<100?`<span class="small" style="color:var(--orange)">Δεν έχουν σκαναριστεί όλα</span>`:''}<button class="btn orange" data-act="o-pickup">Ολοκλήρωση παραλαβής →</button></div>`:''}
    ${mode==='return'&&can('staff')?`<div class="row end" style="padding:12px 18px;border-top:1px solid var(--line)">${pct<100?`<span class="small" style="color:var(--orange)">Εκκρεμούν ${tot-doneN} τεμ.</span>`:''}<button class="btn green" data-act="o-return">Ολοκλήρωση επιστροφής ✓</button></div>`:''}
  </div>`;
}

/* ---------- order: editing handlers ---------- */
ON_INPUT.push((el)=>{
  if(!UI.draft) return false;
  if(el.dataset.o && ['name','venue','notes','internalNotes'].includes(el.dataset.o)){ UI.draft[el.dataset.o]=el.value; dirty(false); return true; }
  if(el.dataset.ol!==undefined && (el.dataset.f==='name'||el.dataset.f==='note')){ UI.draft.lines[+el.dataset.ol][el.dataset.f]=el.value; dirty(false); return true; }
  if(el.id==='oAdd'){ drawAddResults(el.value); return true; }
  return false;
});
ACT['o-dp']=el=>{ const d=UI.draft; if(!d) return; openRangePicker({start:d.start, end:d.end, which:el.dataset.which, onPick:(a,b)=>{ if(!UI.draft) return; UI.draft.start=a; UI.draft.end=b<a?a:b; dirty(); }}); };
ON_CHANGE.push((el)=>{
  if(!UI.draft) return false;
  const d=UI.draft;
  if(el.dataset.o){
    const k=el.dataset.o; if(['name','venue','notes','internalNotes'].includes(k)) return true;
    d[k] = ['discount','deposit'].includes(k) ? num(el.value) : el.value;
    if(k==='start' && d.end<d.start) d.end=d.start;
    if(k==='end' && d.end<d.start) d.start=d.end;
    if(k==='customerId'){ const c=D.customers[el.value]; if(c && num(c.discount) && !num(d.discount)) d.discount=num(c.discount); }
    dirty(); return true;
  }
  if(el.dataset.ol!==undefined){ const l=d.lines[+el.dataset.ol]; const f=el.dataset.f; if(f==='name'||f==='note') return true;
    l[f] = f==='priceType' ? el.value : (f==='qty'?Math.max(0,Math.round(num(el.value))):(f==='extraPrice'&&el.value===''?'':num(el.value))); dirty(); return true; }
  return false;
});
function drawAddResults(q){
  const box=$('#oAddRes'); if(!box) return; q=(q||'').trim().toLowerCase();
  const d=UI.draft;
  let list=prodsSorted(Object.values(D.products).filter(p=>!p.archived));
  if(q) list=list.filter(p=>[p.name,p.sku,catPath(p.cat)].some(v=>(v||'').toLowerCase().includes(q)));
  list=list.slice(0,30);
  const need=expandLines(d.lines);
  box.innerHTML = list.map(p=>{ const fr=freeUnits(p.id,d.start,d.end,d.id).free - (p.kind!=='bundle'?(need[p.id]||0):0);
    return `<a href="#" data-act="o-add" data-id="${p.id}"><span class="pcell">${prodImg(p,32)}<span><b>${esc(p.name)}</b> ${p.kind==='bundle'?'<span class="tag">Bundle</span>':''}<br><span class="xs muted">${esc(p.sku)} · ${esc(catPath(p.cat))} · ${priceLabel(p)}</span></span></span><span class="avb ${avCls(fr)}" title="Διαθέσιμα">${fr}</span></a>`; }).join('') || '<div class="empty" style="padding:16px">Κανένα προϊόν</div>';
  box.style.display='block';
}
document.addEventListener('focusin', e=>{ if(e.target.id==='oAdd') drawAddResults(e.target.value); });
function addProductLine(pid, qty=1){
  const d=UI.draft, p=D.products[pid]; if(!p) return;
  const l=d.lines.find(x=>x.pid===pid);
  if(l) l.qty=num(l.qty)+qty; else d.lines.push({id:uid('ln'), pid, qty, price:productPrice(p), extraPrice:productExtra(p), priceType:p.priceType||'day', discount:0});
  dirty();
}
ACT['o-add']=el=>{ addProductLine(el.dataset.id); const i=$('#oAdd'); if(i){ i.value=''; } $('#oAddRes')&&($('#oAddRes').style.display='none'); };
ENTER['o-add-code']=v=>{ const f=findCode(v); let p=f&&f.product;
  if(!p){ const list=prodsSorted().filter(x=>[x.name,x.sku].some(s=>(s||'').toLowerCase().includes(v.toLowerCase()))); if(list.length===1) p=list[0]; }
  if(!p) return toast('Δεν βρέθηκε προϊόν: '+v, true);
  addProductLine(p.id); toast('+1 '+p.name); setTimeout(()=>{ const i=$('#oAdd'); if(i) i.focus(); },30); };
ACT['o-cam-add']=()=>openCamera(code=>{ const f=findCode(code); if(f&&f.product){ addProductLine(f.product.id); toast('+1 '+f.product.name); } else toast('Άγνωστος κωδικός: '+code, true); }, 'Προσθήκη προϊόντων');
ACT['o-custom']=()=>{ UI.draft.lines.push({id:uid('ln'), pid:'', name:'', qty:1, price:0, priceType:'flat', discount:0}); dirty(); };
ACT['o-line-del']=el=>{ UI.draft.lines.splice(+el.dataset.i,1); dirty(); };
ACT['o-new-cust']=()=>customerModal(null, id=>{ UI.draft.customerId=id; dirty(); });
/* ---------- αναζήτηση πελάτη (combobox) ---------- */
function normQ(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ς/g,'σ'); }
function latQ(s){ return [...normQ(s)].map(c=>GR2LAT[c]??c).join('').toLowerCase(); }
function custSearch(q){
  const cnt={}; for(const o of Object.values(D.orders)) if(o.customerId) cnt[o.customerId]=(cnt[o.customerId]||0)+1;
  const last={}; for(const o of Object.values(D.orders)) if(o.customerId&&(o.start||'')>(last[o.customerId]||'')) last[o.customerId]=o.start||'';
  const all=Object.values(D.customers);
  if(!q.trim()) return {list:sortBy(all,c=>last[c.id]||'').reverse().slice(0,6), cnt, recent:true};
  const terms=normQ(q).split(/\s+/).filter(Boolean), digits=q.replace(/\D/g,'');
  const scored=[];
  for(const c of all){ const hay=normQ([c.company,c.name,c.email,c.city,c.vat].join(' ')), hayL=latQ([c.company,c.name].join(' ')); const ph=String(c.phone||'').replace(/\D/g,'');
    let sc=0, ok=true;
    for(const t of terms){ const tl=latQ(t); const i=hay.indexOf(t), j=hayL.indexOf(tl);
      if(i<0&&j<0&&!(digits.length>=3&&/^\d+$/.test(t)&&(ph.includes(t)||String(c.vat||'').includes(t)))){ ok=false; break; }
      sc += (i===0||j===0)?3 : ((i>0&&/\s|\W/.test(hay[i-1]))||(j>0&&/\s|\W/.test(hayL[j-1])))?2 : 1; }
    if(ok) scored.push([c, sc+Math.min(2,(cnt[c.id]||0)/5)]); }
  return {list:scored.sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]), cnt};
}
let CP={i:0, items:[]};
function drawCustDD(){
  const inp=$('#custQ'), dd=$('#custDD'); if(!inp||!dd) return; const q=inp.value; const {list,cnt,recent}=custSearch(q);
  CP.items=list.map(c=>({type:'c',id:c.id})); if(q.trim().length>=1) CP.items.push({type:'new'}); if(CP.i>=CP.items.length) CP.i=0;
  dd.innerHTML=(recent&&list.length?'<div class="cpick-h">Πρόσφατοι πελάτες</div>':'')+list.map((c,i)=>{ const nm=c.company||c.name||'—';
    return `<button type="button" class="cpick-it${i===CP.i?' on':''}" data-act="o-cust-pick" data-id="${c.id}"><span class="cav" style="background:${avColor(nm)};width:30px;height:30px;font-size:11px;margin:0;flex:none">${esc(initials(nm))}</span><span class="grow" style="min-width:0"><b>${esc(nm)}</b>${c.company&&c.name?` <span class="muted">· ${esc(c.name)}</span>`:''}<small>${esc([c.phone,c.email,c.vat?'ΑΦΜ '+c.vat:''].filter(Boolean).join(' · '))}</small></span><span class="xs faint">${cnt[c.id]?cnt[c.id]+' παρ.':''}</span></button>`; }).join('')
    +(q.trim()&&!list.length?'<div class="cpick-h">Δεν βρέθηκε πελάτης</div>':'')
    +(q.trim()?`<button type="button" class="cpick-it new${CP.i===list.length?' on':''}" data-act="o-cust-newq">＋ Νέος πελάτης «${esc(q.trim())}»</button>`:'');
  dd.classList.toggle('on', CP.items.length>0);
}
function pickCustomer(id){ const d=UI.draft; if(!d) return; d.customerId=id; const c=D.customers[id]; if(c&&num(c.discount)&&!num(d.discount)) d.discount=num(c.discount); dirty(); }
function newCustFromQ(q){ q=(q||'').trim(); const pre={}; if(/^[+\d\s()-]{6,}$/.test(q)) pre.phone=q; else if(/@/.test(q)) pre.email=q; else if(/^\d{9}$/.test(q)) pre.vat=q; else pre.name=q;
  customerModal(null, id=>pickCustomer(id), pre); }
ACT['o-cust-pick']=el=>pickCustomer(el.dataset.id);
ACT['o-cust-newq']=()=>newCustFromQ($('#custQ')?.value);
ACT['o-cust-clear']=()=>{ UI.draft.customerId=''; dirty(); };
ON_INPUT.unshift(el=>{ if(el.id==='custQ'){ CP.i=0; drawCustDD(); return true; } return false; });
document.addEventListener('focusin', e=>{ if(e.target.id==='custQ'){ CP.i=0; drawCustDD(); } });
document.addEventListener('focusout', e=>{ if(e.target.id==='custQ') setTimeout(()=>{ const dd=$('#custDD'); if(dd&&!dd.contains(document.activeElement)) dd.classList.remove('on'); }, 180); });
document.addEventListener('keydown', e=>{ if(e.target.id!=='custQ') return; const n=CP.items.length;
  if(e.key==='ArrowDown'&&n){ e.preventDefault(); CP.i=(CP.i+1)%n; drawCustDD(); }
  else if(e.key==='ArrowUp'&&n){ e.preventDefault(); CP.i=(CP.i-1+n)%n; drawCustDD(); }
  else if(e.key==='Enter'){ e.preventDefault(); const it=CP.items[CP.i]; if(!it) return; if(it.type==='c') pickCustomer(it.id); else newCustFromQ(e.target.value); }
  else if(e.key==='Escape'){ $('#custDD')?.classList.remove('on'); e.target.blur(); } });

/* ---------- status flow ---------- */
ACT['o-status']=async el=>{
  const d=UI.draft, v=el.dataset.v;
  if(v==='reserved'){ const sh=shortages(d); if(!d.lines.length) return toast('Πρόσθεσε πρώτα προϊόντα.', true);
    if(sh.length){ confirmBox('Υπάρχουν ελλείψεις', `Δεν επαρκούν: ${sh.map(s=>`${prodName(s.pid)} (−${s.missing})`).join(', ')}. Να γίνει κράτηση παρ' όλα αυτά;`, 'Κράτηση', async()=>{ d.status='reserved'; await saveOrder('Κράτηση '+d.number); render(); }, false); return; } }
  if(v==='cancelled'){ confirmBox('Ακύρωση παραγγελίας;', 'Ο εξοπλισμός θα αποδεσμευτεί.', 'Ακύρωση παραγγελίας', async()=>{ d.status='cancelled'; await saveOrder('Ακύρωση '+d.number); render(); }); return; }
  const labels={reserved:'Κράτηση',concept:'Πρόχειρο',option:'Option',started:'Σε εξέλιξη'};
  d.status=v; await saveOrder((labels[v]||'Ενημέρωση')+' '+d.number); render();
};
ACT['o-pickup']=async()=>{
  const d=UI.draft; if(d.status!=='reserved') return;
  const need=expandLines(d.lines); let missing=0;
  for(const [pid,q] of Object.entries(need)){ const p=D.products[pid]; const v=p?.tracking==='serial'?d.picked.units.filter(id=>D.units[id]?.productId===pid).length:(d.picked.bulk[pid]||0); missing+=Math.max(0,q-v); }
  const go=async()=>{ // ό,τι μαζικό δεν σκαναρίστηκε θεωρείται ότι έφυγε
    for(const [pid,q] of Object.entries(need)){ const p=D.products[pid]; if(p&&p.tracking!=='serial' && !(d.picked.bulk[pid]>0)) d.picked.bulk[pid]=q; }
    d.status='started'; d.pickedAt=Date.now(); await saveOrder('Παραλαβή '+d.number); afterFlow('Η φόρτωση ολοκληρώθηκε ✓'); };
  if(missing) confirmBox('Παραλαβή με εκκρεμότητες;', `Δεν έχουν σκαναριστεί ${missing} τεμάχια. Να ολοκληρωθεί η παραλαβή;`, 'Ολοκλήρωση παραλαβής', go, false);
  else go();
};
ACT['o-return']=async()=>{
  const d=UI.draft; if(d.status!=='started') return;
  const need=expandLines(d.lines); let missing=0;
  for(const [pid,q] of Object.entries(need)){ const p=D.products[pid]; const v=p?.tracking==='serial'?d.returned.units.filter(id=>D.units[id]?.productId===pid).length:(d.returned.bulk[pid]||0); missing+=Math.max(0,q-v); }
  const go=async(all)=>{ if(all){ for(const [pid,q] of Object.entries(need)){ const p=D.products[pid]; if(p&&p.tracking!=='serial') d.returned.bulk[pid]=q; } for(const id of d.picked.units) if(!d.returned.units.includes(id)) d.returned.units.push(id); }
    d.status='stopped'; d.returnedAt=Date.now(); await saveOrder('Επιστροφή '+d.number); afterFlow('Η επιστροφή ολοκληρώθηκε ✓'); };
  if(missing){ M={type:'ret', redraw:null};
    openModal(`<div class="dlg-h"><h2>Εκκρεμούν ${missing} τεμάχια</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">Δεν έχουν σκαναριστεί όλα τα τεμάχια ως επιστραμμένα. Τι θέλεις να γίνει;</div>
    <div class="dlg-f"><button class="btn" data-act="modal-close">Πίσω</button><button class="btn" data-act="o-ret-partial">Κλείσιμο — τα υπόλοιπα λείπουν</button><button class="btn green" data-act="o-ret-all" data-primary>Επέστρεψαν όλα</button></div>`,'sm');
    ACT['o-ret-all']=async()=>{ closeModal(); await go(true); };
    ACT['o-ret-partial']=async()=>{ closeModal(); d.internalNotes=(d.internalNotes?d.internalNotes+'\n':'')+`[${fmtD(today())}] Κλείσιμο με ${missing} τεμ. που δεν επιστράφηκαν.`; await go(false); };
  } else go(false);
};
ACT['o-dup']=()=>{ const d=UI.draft; createOrder({name:(d.name||'')+' (αντίγραφο)', customerId:d.customerId, venue:d.venue, lines:deepCopy(d.lines), discount:d.discount, deposit:d.deposit, notes:d.notes, start:d.start, end:d.end, startTime:d.startTime, endTime:d.endTime}); };
ACT['o-del']=()=>{ const d=UI.draft; confirmBox(`Διαγραφή ${d.number};`, 'Η παραγγελία θα διαγραφεί οριστικά και δεν αναιρείται.'+(d.status==='started'?' Προσοχή: ο εξοπλισμός της είναι εκτός αποθήκης.':'')+((d.payments||[]).length?' Έχει καταχωρημένες πληρωμές.':'')+(d.status!=='cancelled'?' Αν θέλεις απλώς να μην ισχύει, προτίμησε «Ακύρωση».':''), 'Διαγραφή', async()=>{ const id=d.id; UI.draft=null; if(await del('orders', id, 'Διαγράφηκε η '+d.number)) location.hash='orders'; }); };

/* ---------- scanning in pick / return ---------- */
function flowScan(code){
  const d=UI.draft; if(!d) return {ok:false,msg:''};
  const mode=d.status==='reserved'?'pick':(d.status==='started'?'return':null); if(!mode) return {ok:false,msg:'Η παραγγελία δεν είναι σε φόρτωση/επιστροφή'};
  const need=expandLines(d.lines); const f=findCode(code);
  if(!f || f.type==='order') return scanBad('Άγνωστος κωδικός: '+code);
  if(f.type==='unit'){
    const u=f.unit, p=f.product; if(!need[u.productId]) return scanBad(`Το ${p?.name||'τεμάχιο'} δεν ανήκει σε αυτή την παραγγελία.`);
    if(mode==='pick'){
      if(d.picked.units.includes(u.id)) return scanBad(`Το ${u.code} έχει ήδη σκαναριστεί.`);
      const st=unitState(u); if(st.k==='mnt') return scanBad(`Το ${u.code} είναι σε συντήρηση!`); if(st.k==='out') return scanBad(`Το ${u.code} είναι ήδη εκτός (${st.ref.number}).`); if(st.k==='retired') return scanBad(`Το ${u.code} έχει αποσυρθεί.`);
      if(d.picked.units.filter(id=>D.units[id]?.productId===u.productId).length>=need[u.productId]) return scanBad(`Έχουν σκαναριστεί ήδη όλα τα ${p.name} (${need[u.productId]}).`);
      d.picked.units.push(u.id);
    } else {
      if(!d.picked.units.includes(u.id)) return scanBad(`Το ${u.code} δεν είχε φύγει με αυτή την παραγγελία.`);
      if(d.returned.units.includes(u.id)) return scanBad(`Το ${u.code} έχει ήδη επιστραφεί.`);
      d.returned.units.push(u.id);
    }
    dirty(); return scanOk('✓ '+(p?.name||'')+' · '+u.code);
  }
  const p=f.product;
  if(p.kind==='bundle'){ // όλα τα μαζικά περιεχόμενα του bundle
    let any=false; for(const c of p.components||[]){ const cp=D.products[c.pid]; if(cp&&cp.tracking!=='serial'&&need[c.pid]){ bulkAdj(c.pid, num(c.qty), true); any=true; } }
    if(!any) return scanBad('Σκάναρε τα τεμάχια του bundle ένα-ένα.');
    dirty(); return scanOk('✓ '+p.name);
  }
  if(!need[p.id]) return scanBad(`Το ${p.name} δεν ανήκει σε αυτή την παραγγελία.`);
  if(p.tracking==='serial') return scanBad(`Το ${p.name} έχει σειριακούς — σκάναρε το QR του συγκεκριμένου τεμαχίου.`);
  if(!bulkAdj(p.id,1)){ beep(false); return {ok:false,msg:'Έχουν σκαναριστεί ήδη όλα τα '+p.name}; }
  dirty(); return scanOk('✓ '+p.name);
}
function afterFlow(msg){ if(route().startsWith('wh-')){ toast(msg); beep(true); location.hash='wh'; } else render(); }
function flowProgress(d){ d=d||UI.draft; if(!d) return ''; const need=expandLines(d.lines); let tot=0, done=0; const ret=d.status==='started';
  for(const [pid,q] of Object.entries(need)){ const p=D.products[pid]; if(!p) continue; let v; if(p.tracking==='serial'){ v=(ret?d.returned.units:d.picked.units).filter(id=>D.units[id]?.productId===pid).length; } else v=(ret?d.returned.bulk[pid]:d.picked.bulk[pid])||0; tot+=q; done+=Math.min(v,q); }
  return {tot, done}; }
function scanOk(msg){ toast(msg); beep(true); const pr=flowProgress(); return {ok:true, msg: msg+(pr&&pr.tot?`  (${pr.done}/${pr.tot})`:'')}; }
function scanBad(msg){ toast(msg, true); beep(false); return {ok:false, msg}; }
function bulkAdj(pid, delta, silent){
  const d=UI.draft; const need=expandLines(d.lines)[pid]||0; const box=d.status==='started'?d.returned.bulk:d.picked.bulk;
  let v=(box[pid]||0)+delta;
  if(delta==='all') v=need;
  if(v>need){ if(!silent) toast(`Έχουν σκαναριστεί ήδη όλα (${need}).`, true); v=need; if(!silent) return false; }
  box[pid]=Math.max(0,v); return true;
}
ENTER['o-flow-scan']=v=>{ flowScan(v); setTimeout(()=>{ const i=$('#flowScan'); if(i) i.focus(); },30); };
ACT['o-cam-flow']=()=>openCamera(code=>flowScan(code), UI.draft.status==='reserved'?'Φόρτωση εξοπλισμού':'Επιστροφή εξοπλισμού');
ACT['o-bulk']=el=>{ const dd=el.dataset.d; bulkAdj(el.dataset.id, dd==='all'?'all':+dd, true); dirty(); };
ACT['o-unit-rm']=el=>{ const d=UI.draft; const arr=d.status==='started'?d.returned.units:d.picked.units; const i=arr.indexOf(el.dataset.id); if(i>=0) arr.splice(i,1); dirty(); };
ACT['o-unit-pick']=el=>{
  const d=UI.draft, pid=el.dataset.id, p=D.products[pid]; const ret=d.status==='started';
  const units = ret ? d.picked.units.filter(id=>D.units[id]?.productId===pid).map(id=>D.units[id]) : unitsOf(pid);
  const sel = new Set((ret?d.returned.units:d.picked.units).filter(id=>D.units[id]?.productId===pid));
  M={type:'unitpick'};
  openModal(`<div class="dlg-h"><h2>${esc(p.name)} — ${ret?'επιστροφή':'επιλογή τεμαχίων'}</h2><button class="icon" data-act="modal-close">✕</button></div>
  <div class="dlg-b"><div class="small muted">Χρειάζονται ${expandLines(d.lines)[pid]} τεμάχια.</div><div style="max-height:50vh;overflow:auto">${units.map(u=>{ const st=unitState(u); const blocked=!ret&&!sel.has(u.id)&&['mnt','out','retired'].includes(st.k);
    return `<label class="li ck" style="${blocked?'opacity:.5':''}"><span><input type="checkbox" data-up="${u.id}" ${sel.has(u.id)?'checked':''} ${blocked?'disabled':''}> <b class="mono">${esc(u.code)}</b> ${u.serial?`<span class="muted small">S/N ${esc(u.serial)}</span>`:''}</span>${pill(st.k,{[st.k]:st})}</label>`; }).join('')||'<div class="muted">Δεν υπάρχουν τεμάχια.</div>'}</div></div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="o-unit-pick-ok" data-id="${pid}" data-primary>OK</button></div>`);
};
ACT['o-unit-pick-ok']=el=>{ const d=UI.draft, pid=el.dataset.id; const arr=d.status==='started'?d.returned.units:d.picked.units;
  const chosen=$$('[data-up]').filter(x=>x.checked).map(x=>x.dataset.up);
  const keep=arr.filter(id=>D.units[id]?.productId!==pid); arr.length=0; arr.push(...keep, ...chosen); closeModal(); dirty(); };
ACT['o-damage']=el=>{ const d=UI.draft; maintenanceModal(null, {productId:el.dataset.id, orderId:d.id, title:'Βλάβη από '+d.number, start:today()}); };

/* ---------- documents ---------- */
ACT['doc']=async el=>{
  const d=UI.draft; if(!d) return; const kind=el.dataset.v;
  if(d._dirty) await saveOrder();
  if(kind==='quote' && !d.quoteNo && can('staff')){ d.quoteNo=(settings().quotePrefix||'ΠΡ-')+String(await nextNumber('quote')).padStart(4,'0'); await saveOrder(); }
  if(kind==='invoice' && !d.invoiceNo && can('staff')){ d.invoiceNo=(settings().invoicePrefix||'ΠΤ-')+String(await nextNumber('invoice')).padStart(4,'0'); await saveOrder(); }
  printOrderDoc(d, kind);
};
function printOrderDoc(o, kind){
  const s=settings(), c=D.customers[o.customerId]||{}, tt=orderTotals(o);
  const titles={quote:'ΠΡΟΣΦΟΡΑ', delivery:'ΔΕΛΤΙΟ ΑΠΟΣΤΟΛΗΣ', invoice:'ΠΡΟΤΙΜΟΛΟΓΙΟ', contract:'ΣΥΜΦΩΝΗΤΙΚΟ ΕΝΟΙΚΙΑΣΗΣ ΕΞΟΠΛΙΣΜΟΥ'};
  const no = kind==='quote'?o.quoteNo:(kind==='invoice'?o.invoiceNo:o.number);
  const head=`<div class="row"><div>${LOGO?`<img src="${LOGO}" alt="" style="height:19mm;width:auto;display:block;margin:0 0 3mm -1mm">`:''}<div style="font-weight:700;font-size:${LOGO?'11pt':'20pt'}">${esc(s.name||(LOGO?'':'Η εταιρεία μου'))}</div><div class="muted">${esc(s.address||'')} ${esc(s.city||'')}<br>${s.phone?'Τηλ. '+esc(s.phone):''} ${s.email?' · '+esc(s.email):''}<br>${s.vat?'ΑΦΜ '+esc(s.vat):''} ${s.doy?' · ΔΟΥ '+esc(s.doy):''}</div></div>
    <div style="text-align:right"><div style="font-size:15pt;font-weight:700">${titles[kind]}</div><div>Αρ. <b>${esc(no||'')}</b></div><div class="muted">Ημ/νία: ${fmtD(today())}</div><div class="muted">Παραγγελία: ${esc(o.number)}</div></div></div>
    <div style="height:1mm;background:#f2c428;margin-top:5mm;border-radius:1mm;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div><div class="row" style="margin-top:5mm"><div class="box"><div class="muted" style="font-size:8.5pt">ΠΕΛΑΤΗΣ</div><b>${esc(c.company||c.name||'—')}</b><br>${c.company&&c.name?esc(c.name)+'<br>':''}${esc(c.address||'')} ${esc(c.city||'')}<br>${c.vat?'ΑΦΜ '+esc(c.vat):''} ${c.doy?' · ΔΟΥ '+esc(c.doy):''}<br>${esc(c.phone||'')} ${c.email?' · '+esc(c.email):''}</div>
    <div class="box"><div class="muted" style="font-size:8.5pt">ΠΕΡΙΟΔΟΣ ΕΝΟΙΚΙΑΣΗΣ</div><b>${fmtD(o.start)} ${esc(o.startTime||'')} → ${fmtD(o.end)} ${esc(o.endTime||'')}</b><br>${tt.days} ${tt.days===1?'ημέρα':'ημέρες'}<br>${o.name?'Εκδήλωση: '+esc(o.name)+'<br>':''}${o.venue?'Χώρος: '+esc(o.venue):''}</div></div>`;
  let body='';
  if(kind==='delivery'){
    const need=expandLines(o.lines);
    body=`<table><thead><tr><th>Κωδικός</th><th>Περιγραφή</th><th>Σειριακοί / τεμάχια</th><th class="r">Ποσ.</th><th class="r">✓ Αποστ.</th><th class="r">✓ Επιστρ.</th></tr></thead><tbody>${
      Object.entries(need).map(([pid,q])=>{ const p=D.products[pid]; const us=(o.picked?.units||[]).filter(id=>D.units[id]?.productId===pid).map(id=>D.units[id].code+(D.units[id].serial?' ('+D.units[id].serial+')':'')).join(', ');
        return `<tr><td class="mono">${esc(p?.sku)}</td><td>${esc(p?.name)}${p?.location?`<br><small class="muted">📍 ${esc(p.location)}</small>`:''}</td><td style="font-size:8.5pt">${esc(us)}</td><td class="r">${q}</td><td class="r">☐</td><td class="r">☐</td></tr>`; }).join('')}</tbody></table>
      ${(o.crew||[]).length?`<h3 style="margin:6mm 0 0;font-size:11pt">Συνεργείο</h3><table><thead><tr><th>Όνομα</th><th>Ρόλος</th><th>Ημέρες</th><th>Ώρες</th><th>Τηλέφωνο</th></tr></thead><tbody>${(o.crew||[]).map(a=>{ const c=D.crew[a.cid]||{}; return `<tr><td>${esc(c.name||'')}</td><td>${esc(a.role||'')}</td><td>${fmtD(a.start)}${a.end&&a.end!==a.start?' → '+fmtD(a.end):''}</td><td>${esc(a.from||'')}–${esc(a.to||'')}</td><td>${esc(c.phone||'')}</td></tr>`; }).join('')}</tbody></table>`:''}
      ${o.notes?`<p><b>Σημειώσεις:</b> ${esc(o.notes)}</p>`:''}
      <div class="sig"><div>Παρέδωσε</div><div>Παρέλαβε (${esc(c.name||c.company||'πελάτης')})</div><div>Επιστροφή — έλεγχος</div></div>`;
  } else {
    const lines=o.lines.map(l=>{ const p=D.products[l.pid]; return `<tr><td>${esc(p?p.name:l.name)}${l.note?`<br><small class="muted">${esc(l.note)}</small>`:''}${p&&p.kind==='bundle'?`<br><small class="muted">${(p.components||[]).map(c=>esc(prodName(c.pid))+' ×'+num(c.qty)).join(', ')}</small>`:''}</td><td class="r">${num(l.qty)}</td><td class="r">${money(l.price)}${l.priceType==='flat'?'':'/ημ.'}${hasExtra(l)&&tt.days>1?`<br><small class="muted">επόμ. ${money(l.extraPrice)}/ημ.</small>`:''}</td><td class="r">${l.priceType==='flat'?'—':tt.days}</td><td class="r">${num(l.discount)?num(l.discount)+'%':''}</td><td class="r">${money(lineTotal(l,tt.days))}</td></tr>`; }).join('');
    const crewRows=(o.crew||[]).filter(a=>a.bill!==false&&crewCharge(a)>0).map(a=>{ const c=D.crew[a.cid]||{}; const b=c.payType||'day'; const qn=crewQty(b,a); const manual=a.charge!==undefined&&a.charge!==''&&a.charge!==null;
      return `<tr><td>Τεχνικό προσωπικό — ${esc(a.role||c.role||'')}<br><small class="muted">${fmtD(a.start)}${a.end&&a.end!==a.start?' → '+fmtD(a.end):''} · ${esc(a.from||'')}–${esc(a.to||'')}</small></td><td class="r">1</td><td class="r">${manual||b==='flat'?money(crewCharge(a)):money(num(c.rate))+(b==='hour'?'/ώρα':'')}</td><td class="r">${b==='flat'||manual?'—':(b==='hour'?qn+' ώρ.':qn)}</td><td class="r">—</td><td class="r">${money(crewCharge(a))}</td></tr>`; }).join('');
    body=`<table><thead><tr><th>Περιγραφή</th><th class="r">Ποσ.</th><th class="r">Τιμή</th><th class="r">Ημέρες</th><th class="r">Έκπτ.</th><th class="r">Αξία</th></tr></thead><tbody>${lines}${crewRows}</tbody></table>
    <div class="tot"><div><span>Υποσύνολο</span><span>${money(tt.sub)}</span></div>${tt.disc?`<div><span>Έκπτωση ${num(o.discount)}%</span><span>−${money(tt.disc)}</span></div>`:''}<div><span>Καθαρή αξία</span><span>${money(tt.net)}</span></div><div><span>ΦΠΑ ${tt.vr}%</span><span>${money(tt.vat)}</span></div><div class="g"><span>Σύνολο</span><span>${money(tt.total)}</span></div>${tt.deposit?`<div><span>Εγγύηση</span><span>${money(tt.deposit)}</span></div>`:''}</div>
    ${o.notes?`<p><b>Σημειώσεις:</b> ${esc(o.notes)}</p>`:''}
    ${kind==='quote'?`<p class="muted">Η προσφορά ισχύει για ${esc(s.quoteValidity||15)} ημέρες. Η διαθεσιμότητα του εξοπλισμού επιβεβαιώνεται με την κράτηση.</p>`:''}
    ${s.bank?`<p><b>Τραπεζικοί λογαριασμοί:</b><br>${esc(s.bank).replace(/\n/g,'<br>')}</p>`:''}
    ${kind==='invoice'?`<p class="muted" style="font-size:8.5pt">Το παρόν είναι προτιμολόγιο και δεν αποτελεί φορολογικό παραστατικό.</p>`:''}
    ${kind==='contract'?`<h3 style="margin-top:8mm">Όροι ενοικίασης</h3><div style="font-size:9pt;white-space:pre-wrap">${esc(s.terms||'1. Ο μισθωτής ευθύνεται για τον εξοπλισμό από την παραλαβή έως την επιστροφή του.\n2. Βλάβες, απώλειες ή κλοπές χρεώνονται με βάση την αξία αντικατάστασης.\n3. Καθυστέρηση επιστροφής χρεώνεται με την ημερήσια τιμή ανά ημέρα καθυστέρησης.\n4. Η εγγύηση επιστρέφεται μετά τον έλεγχο του εξοπλισμού.')}</div><div class="sig"><div>Ο εκμισθωτής</div><div>Ο μισθωτής</div></div>`:''}`;
  }
  printHTML(titles[kind]+' '+(no||''), head+body+(s.footer?`<p class="muted" style="margin-top:10mm;font-size:8.5pt;text-align:center">${esc(s.footer)}</p>`:''));
}

/* ===================== ΛΕΙΤΟΥΡΓΙΑ ΑΠΟΘΗΚΗΣ (κινητό) ===================== */
VIEWS.wh = id => id ? whOrder(id) : whList();
function whList(){
  const t=today(), soon=addDays(t,7);
  const all=Object.values(D.orders);
  const pick=sortBy(all.filter(o=>o.status==='reserved'&&o.start<=soon), o=>o.start+(o.startTime||''));
  const ret=sortBy(all.filter(o=>o.status==='started'), o=>(o.end||o.start)+(o.endTime||''));
  const card=(o,kind)=>{ const pr=flowProgress(o)||{tot:0,done:0}; const late=kind==='ret'?(o.end||o.start)<t:o.start<t; const when=kind==='ret'?(o.end||o.start):o.start;
    const dl=when===t?'Σήμερα':(when===addDays(t,1)?'Αύριο':fmtD(when));
    return `<a class="whc" href="#wh-${o.id}"><div class="whc-l"><div class="whc-n">${esc(o.number)}<span class="whc-d ${late?'late':(when===t?'today':'')}">${late?'Καθυστέρηση · ':''}${dl} ${esc(kind==='ret'?(o.endTime||''):(o.startTime||''))}</span></div>
      <div class="whc-c">${esc(custName(o.customerId)||o.name||'—')}</div>${o.venue?`<div class="whc-v">📍 ${esc(o.venue)}</div>`:''}</div>
      <div class="whc-r"><b>${pr.done}/${pr.tot}</b><small>${kind==='ret'?'επέστρεψαν':'έτοιμα'}</small></div></a>`; };
  return `<div class="ph"><div><h1>Λειτουργία αποθήκης</h1><p class="sub">Φόρτωση και επιστροφή εξοπλισμού με σάρωση</p></div></div>
    <h2 class="whh">⤴ Για φόρτωση <span>${pick.length}</span></h2>
    ${pick.length?pick.map(o=>card(o,'pick')).join(''):'<div class="card empty" style="padding:22px">Καμία κράτηση για φόρτωση τις επόμενες 7 ημέρες.</div>'}
    <h2 class="whh">⤵ Για επιστροφή <span>${ret.length}</span></h2>
    ${ret.length?ret.map(o=>card(o,'ret')).join(''):'<div class="card empty" style="padding:22px">Δεν υπάρχει εξοπλισμός εκτός.</div>'}`;
}
function whOrder(id){
  const d=getDraft(id);
  if(!d) return `<div class="empty"><b>Η παραγγελία δεν βρέθηκε</b><a href="#wh">← Λειτουργία αποθήκης</a></div>`;
  const mode=d.status==='reserved'?'pick':(d.status==='started'?'return':'none');
  const need=expandLines(d.lines); const pr=flowProgress(d)||{tot:0,done:0}; const pct=pr.tot?Math.round(100*pr.done/pr.tot):0;
  const staff=can('staff')&&mode!=='none';
  const head=`<div class="whtop"><a class="btn ghost whback" href="#wh">${svg('back')}</a><div class="grow"><div class="whtop-n">${esc(d.number)} ${pill(d.status)}</div><div class="whtop-c">${esc(custName(d.customerId)||d.name||'')}</div></div><a class="btn sm" href="#order-${d.id}">Παραγγελία</a></div>`;
  if(mode==='none') return head+`<div class="card whdone">${svg('check')}<h2>${d.status==='stopped'?'Η επιστροφή ολοκληρώθηκε':'Δεν υπάρχει φόρτωση/επιστροφή'}</h2><p class="muted">${esc(d.number)} · ${pill(d.status)}</p><a class="btn pri" href="#wh">← Πίσω στη λίστα</a></div>`;
  const items=Object.entries(need).map(([pid,q])=>{ const p=D.products[pid]; if(!p) return null; let v, chips='';
    if(p.tracking==='serial'){ const src=mode==='return'?d.returned.units:d.picked.units; const mine=src.filter(x=>D.units[x]?.productId===pid); v=mine.length;
      chips=mine.map(x=>`<span class="chip">${esc(D.units[x]?.code||'?')}${staff?`<button data-act="o-unit-rm" data-id="${x}">✕</button>`:''}</span>`).join('');
      if(mode==='return'){ const out=d.picked.units.filter(x=>D.units[x]?.productId===pid && !d.returned.units.includes(x)); if(out.length) chips+=`<div class="xs muted">Εκκρεμούν: ${out.map(x=>esc(D.units[x]?.code||'?')).join(', ')}</div>`; }
    } else v=(mode==='return'?d.returned.bulk[pid]:d.picked.bulk[pid])||0;
    return {p,q,v,chips}; }).filter(Boolean).sort((a,b)=>(a.v>=a.q)-(b.v>=b.q));
  const rows=items.map(({p,q,v,chips})=>{ const ok=v>=q;
    const ctrl=!staff?'':(p.tracking==='serial'?`<button class="btn" data-act="o-unit-pick" data-id="${p.id}">Επιλογή τεμαχίων</button>`:
      `<div class="whq"><button data-act="o-bulk" data-id="${p.id}" data-d="-1" aria-label="Λιγότερα">−</button><button data-act="o-bulk" data-id="${p.id}" data-d="1" aria-label="Περισσότερα">+</button><button class="all" data-act="o-bulk" data-id="${p.id}" data-d="all">Όλα</button></div>`);
    return `<div class="whi${ok?' ok':''}">${prodImg(p,52)}<div class="whi-m"><div class="whi-n">${esc(p.name)}</div><div class="whi-s mono">${esc(p.sku)}${p.location?' · 📍 '+esc(p.location):''}</div>${chips?`<div class="whi-ch">${chips}</div>`:''}
      <div class="whi-a">${ctrl}${mode==='return'&&staff?`<button class="btn sm dangerous" data-act="o-damage" data-id="${p.id}">Βλάβη</button>`:''}</div></div>
      <div class="whi-q">${ok?svg('check'):''}<b>${v}</b><small>/ ${q}</small></div></div>`; }).join('');
  return head+`<div class="card whprog"><div class="row between"><b>${mode==='pick'?'Φόρτωση':'Επιστροφή'}</b><span><b>${pr.done}</b> / ${pr.tot} τεμ. · ${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    ${staff?`<button class="whscan" data-act="o-cam-flow">${svg('scan')} Σάρωση με κάμερα</button>
    <div class="scanbox whkb"><span>▣</span><input type="text" id="flowScan" placeholder="ή barcode scanner / κωδικός + Enter" data-enter="o-flow-scan" autocomplete="off" inputmode="text"></div>`:''}
    <div class="whlist">${rows||'<div class="card empty">Η παραγγελία δεν έχει εξοπλισμό.</div>'}</div>
    ${staff?`<div class="whfoot">${mode==='pick'?`<button class="btn orange" data-act="o-pickup">${pct<100?`Ολοκλήρωση φόρτωσης (λείπουν ${pr.tot-pr.done})`:'Ολοκλήρωση φόρτωσης ✓'}</button>`:`<button class="btn green" data-act="o-return">${pct<100?`Ολοκλήρωση επιστροφής (εκκρεμούν ${pr.tot-pr.done})`:'Ολοκλήρωση επιστροφής ✓'}</button>`}</div>`:''}`;
}
