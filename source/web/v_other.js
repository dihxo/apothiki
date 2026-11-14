/* ===================== CALENDAR, CUSTOMERS, MAINTENANCE, REPORTS, SCAN, SETTINGS ===================== */
'use strict';

/* ---------- calendar ---------- */
VIEWS.calendar = () => {
  const start=UI.calStart||addDays(today(),-2), n=UI.calDays, t=today();
  const days=[...Array(n)].map((_,i)=>addDays(start,i)), end=days[n-1];
  const head=days.map(d=>`<th class="${[0,6].includes(dow(d))?'we':''} ${d===t?'td':''}">${DOW[dow(d)]}<br>${d.slice(8)}/${d.slice(5,7)}</th>`).join('');
  const ctrl=`<div class="row"><div class="seg"><button class="${UI.calMode==='orders'?'on':''}" data-act="tab" data-k="calMode" data-v="orders">Παραγγελίες</button><button class="${UI.calMode==='avail'?'on':''}" data-act="tab" data-k="calMode" data-v="avail">Διαθεσιμότητα</button></div>
    ${UI.calMode==='avail'?`<select data-bindc="calCat"><option value="all">Όλες οι κατηγορίες</option>${catsSorted().map(c=>`<option value="${c.id}" ${UI.calCat===c.id?'selected':''}>${esc(c.path)}</option>`).join('')}</select>`:''}
    <button class="btn" data-act="cal-mv" data-v="-7">‹</button><input type="date" data-bindc="calStart" value="${start}"><button class="btn" data-act="cal-mv" data-v="7">›</button><button class="btn" data-act="cal-today">Σήμερα</button></div>`;
  let body='';
  if(UI.calMode==='orders'){
    const list=sortBy(Object.values(D.orders).filter(o=>o.start&&o.status!=='cancelled'&&o.start<=end&&(orderRange(o)[1])>=start), o=>o.start);
    const W=40; // px per day (min-width cells)
    body=list.length?`<div class="cal gantt"><table style="min-width:${230+n*W}px"><thead><tr><th class="nm">Παραγγελία</th>${head}</tr></thead><tbody>${list.map(o=>{
      const [s,e]=orderRange(o); const a=Math.max(0,diffDays(start,s)), b=Math.min(n-1,diffDays(start,e)); const st=STATUS[o.status]||{};
      return `<tr><td class="nm"><a class="lk" href="#order-${o.id}">${esc(o.number)}</a> <span class="xs muted">${esc(custName(o.customerId)||o.name||'')}</span></td><td class="cell" colspan="${n}"><div class="gbar ${st.c}" style="left:calc(${a}/${n}*100% + 2px);width:calc(${b-a+1}/${n}*100% - 4px)" data-act="go" data-href="#order-${o.id}" title="${esc(o.number)} · ${fmtD(o.start)}–${fmtD(o.end)} · ${esc(st.l)}">${esc(o.name||custName(o.customerId)||o.number)}</div></td></tr>`; }).join('')}</tbody></table></div>`
      :'<div class="card empty"><b>Καμία παραγγελία σε αυτό το διάστημα</b></div>';
    body+=`<div class="row small muted" style="margin-top:10px;gap:14px">${Object.entries(STATUS).filter(([k])=>k!=='cancelled').map(([k,v])=>`<span>${pill(k)}</span>`).join('')}</div>`;
  } else {
    let list=Object.values(D.products).filter(p=>!p.archived);
    if(UI.calCat!=='all'){ const set=catDesc(UI.calCat); list=list.filter(p=>set.has(p.cat)); }
    list=prodsSorted(list); let last=null, rows='';
    for(const p of list){ const cp=catPath(p.cat)||'Χωρίς κατηγορία'; if(cp!==last){ rows+=`<tr class="grp"><td class="nm">${esc(cp)}</td><td colspan="${n}"></td></tr>`; last=cp; }
      const st=stockOf(p.id);
      rows+=`<tr><td class="nm"><a class="lk" href="#product-${p.id}">${esc(p.name)}</a> ${p.kind==='bundle'?'<span class="tag">B</span>':''}<div class="xs muted">${st} σύνολο</div></td>${days.map(d=>{ const f=freeOnDay(p.id,d); return `<td class="${f<=0?'c-bad':(st&&f<=Math.ceil(st*.2)?'c-low':'c-ok')} ${[0,6].includes(dow(d))?'we':''} ${d===t?'td':''}" title="${fmtD(d)}: ${f} διαθέσιμα">${f}</td>`; }).join('')}</tr>`; }
    body=list.length?`<div class="cal"><table><thead><tr><th class="nm">Προϊόν</th>${head}</tr></thead><tbody>${rows}</tbody></table></div><div class="small muted" style="margin-top:8px">Ελεύθερα τεμάχια ανά ημέρα — αφαιρούνται κρατήσεις, παραγγελίες σε εξέλιξη και συντήρηση (όχι τα options).</div>`:'<div class="card empty"><b>Δεν υπάρχουν προϊόντα</b></div>';
  }
  return `<div class="ph"><div><h1>Ημερολόγιο</h1><p class="sub">${fmtD(start)} – ${fmtD(end)}</p></div>${ctrl}</div>${body}`;
};
ACT['cal-mv']=el=>{ UI.calStart=addDays(UI.calStart||addDays(today(),-2), +el.dataset.v); render(); };
ACT['cal-today']=()=>{ UI.calStart=null; render(); };

/* ---------- customers ---------- */
VIEWS.customers = () => {
  const q=UI.custQ.trim().toLowerCase();
  let list=Object.values(D.customers); if(q) list=list.filter(c=>[c.name,c.company,c.email,c.phone,c.vat,c.city].some(v=>(v||'').toLowerCase().includes(q)));
  list=sortBy(list,c=>c.company||c.name||'');
  const stats={}; for(const o of Object.values(D.orders)){ if(!o.customerId) continue; const s=stats[o.customerId]=stats[o.customerId]||{n:0,rev:0,last:''}; s.n++; if(REVENUE.includes(o.status)) s.rev+=orderTotals(o).net; if((o.start||'')>s.last) s.last=o.start; }
  return `<div class="ph"><div><h1>Πελάτες</h1><p class="sub">${Object.keys(D.customers).length} πελάτες</p></div><div class="row"><button class="btn" data-act="c-csv">Εξαγωγή CSV</button>${can('staff')?`<button class="btn pri" data-act="new-customer">+ Νέος πελάτης</button>`:''}</div></div>
  <div class="card p0"><div class="card-h"><input type="search" class="grow" style="max-width:420px" placeholder="Αναζήτηση ονόματος, εταιρείας, τηλεφώνου, ΑΦΜ…" data-bind="custQ" value="${esc(UI.custQ)}"></div>
  ${list.length&&isM()?`<div class="mlist">${list.map(c=>{ const s=stats[c.id]||{n:0,rev:0,last:''}; const nm=c.company||c.name||'—'; return `<a class="mrow" href="#customer-${c.id}"><span class="cav" style="background:${avColor(nm)}">${esc(initials(nm))}</span><div class="mrow-m"><div class="mrow-n">${esc(nm)}</div><div class="mrow-s">${esc(c.phone||c.email||'')}</div></div><div class="mrow-r"><b>${s.n}</b><small>παραγγ.</small></div></a>`; }).join('')}</div>`:list.length?`<div class="tw"><table><thead><tr><th>Πελάτης</th><th>Επικοινωνία</th><th>ΑΦΜ</th><th class="num">Παραγγελίες</th><th class="num">Έσοδα</th><th>Τελευταία</th></tr></thead><tbody>${list.map(c=>{ const s=stats[c.id]||{n:0,rev:0,last:''}; return `<tr class="click" data-act="go" data-href="#customer-${c.id}"><td><b>${esc(c.company||c.name)}</b>${c.company&&c.name?`<div class="xs muted">${esc(c.name)}</div>`:''}</td><td class="small">${esc(c.phone||'')}${c.email?`<div class="muted">${esc(c.email)}</div>`:''}</td><td class="mono">${esc(c.vat||'')}</td><td class="num">${s.n}</td><td class="num">${money(s.rev)}</td><td class="small">${fmtD(s.last)}</td></tr>`; }).join('')}</tbody></table></div>`
  :`<div class="empty"><b>${Object.keys(D.customers).length?'Κανένα αποτέλεσμα':'Δεν υπάρχουν πελάτες ακόμη'}</b></div>`}</div>`;
};
VIEWS.customer = id => {
  const c=D.customers[id]; if(!c) return `<div class="empty"><b>Ο πελάτης δεν βρέθηκε</b><a href="#customers">← Πελάτες</a></div>`;
  const orders=sortBy(Object.values(D.orders).filter(o=>o.customerId===id),o=>'~'+(9e15-new Date(o.start||0).getTime()));
  const rev=orders.filter(o=>REVENUE.includes(o.status)).reduce((s,o)=>s+orderTotals(o).net,0);
  return `<div class="ohead"><a href="#customers" class="btn ghost">←</a><div><h1>${esc(c.company||c.name)}</h1>${c.company&&c.name?`<div class="muted">${esc(c.name)}</div>`:''}</div><div class="grow"></div>${can('staff')?`<button class="btn" data-act="edit-customer" data-id="${id}">✎ Επεξεργασία</button><button class="btn pri" data-act="c-new-order" data-id="${id}">+ Νέα παραγγελία</button>`:''}</div>
  <div class="grid g4" style="margin-bottom:16px"><div class="card stat"><div class="n">${orders.length}</div><div class="l">Παραγγελίες</div></div><div class="card stat"><div class="n">${money(rev)}</div><div class="l">Έσοδα (καθαρά)</div></div><div class="card stat"><div class="n">${orders.filter(o=>HOLD.includes(o.status)).length}</div><div class="l">Ενεργές</div></div><div class="card stat"><div class="n">${num(c.discount)||0}%</div><div class="l">Έκπτωση πελάτη</div></div></div>
  <div class="split"><div class="card p0"><div class="card-h"><h2>Παραγγελίες</h2></div>${orders.length?`<div class="tw"><table><thead><tr><th>Αρ.</th><th>Τίτλος</th><th>Περίοδος</th><th>Κατάσταση</th><th class="num">Σύνολο</th></tr></thead><tbody>${orders.map(o=>`<tr class="click" data-act="go" data-href="#order-${o.id}"><td><b>${esc(o.number)}</b></td><td>${esc(o.name||'')}</td><td style="white-space:nowrap">${fmtD(o.start)} → ${fmtD(o.end)}</td><td>${pill(o.status)}</td><td class="num">${money(orderTotals(o).total)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Καμία παραγγελία ακόμη.</div>'}</div>
  <div class="card"><h2>Στοιχεία</h2><dl class="kv"><dt>Τηλέφωνο</dt><dd>${esc(c.phone||'—')}</dd><dt>Email</dt><dd>${esc(c.email||'—')}</dd><dt>Διεύθυνση</dt><dd>${esc([c.address,c.city].filter(Boolean).join(', ')||'—')}</dd><dt>ΑΦΜ</dt><dd>${esc(c.vat||'—')}</dd><dt>ΔΟΥ</dt><dd>${esc(c.doy||'—')}</dd></dl>${c.notes?`<hr><div class="small" style="white-space:pre-wrap">${esc(c.notes)}</div>`:''}</div></div>`;
};
function customerModal(id, onSaved){
  const c=id?deepCopy(D.customers[id]):{id:null,name:'',company:'',vat:'',doy:'',email:'',phone:'',address:'',city:'',discount:'',notes:''};
  M={type:'cust', c, onSaved};
  const f=(k,l,t='text')=>`<label class="f">${l}<input type="${t}" data-cm="${k}" value="${esc(c[k])}" ${k==='name'?'autofocus':''}></label>`;
  openModal(`<div class="dlg-h"><h2>${id?'Επεξεργασία':'Νέος'} πελάτης</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <div class="f2">${f('name','Ονοματεπώνυμο / υπεύθυνος')}${f('company','Εταιρεία (προαιρετικό)')}</div>
  <div class="f2">${f('phone','Τηλέφωνο','tel')}${f('email','Email','email')}</div>
  <div class="f2">${f('address','Διεύθυνση')}${f('city','Πόλη / ΤΚ')}</div>
  <div class="f3">${f('vat','ΑΦΜ')}${f('doy','ΔΟΥ')}${f('discount','Έκπτωση %','number')}</div>
  <label class="f">Σημειώσεις<textarea data-cm="notes">${esc(c.notes)}</textarea></label></div>
  <div class="dlg-f">${id?'<button class="btn dangerous" data-act="c-del" style="margin-right:auto">Διαγραφή</button>':''}<button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="c-save" data-primary>Αποθήκευση</button></div>`);
}
ON_INPUT.push(el=>{ if(el.dataset.cm!==undefined&&M&&M.type==='cust'){ M.c[el.dataset.cm]=el.value; return true; } return false; });
ACT['new-customer']=()=>customerModal(null);
ACT['edit-customer']=el=>customerModal(el.dataset.id);
ACT['c-new-order']=el=>{ const c=D.customers[el.dataset.id]; createOrder({customerId:c.id, discount:num(c.discount)}); };
ACT['c-save']=async()=>{ const c=M.c; if(!(c.name||'').trim() && !(c.company||'').trim()) return toast('Συμπλήρωσε όνομα ή εταιρεία.', true);
  const id=c.id||uid('cu'); const cb=M.onSaved; const d=strip(c); d.discount=num(d.discount)||'';
  if(await put('customers',id,d,'Αποθηκεύτηκε ο πελάτης')){ closeModal(); if(cb) cb(id); } };
ACT['c-del']=()=>{ const c=M.c; const n=Object.values(D.orders).filter(o=>o.customerId===c.id).length; if(n) return toast(`Ο πελάτης έχει ${n} παραγγελίες και δεν μπορεί να διαγραφεί.`, true);
  confirmBox('Διαγραφή πελάτη;', c.company||c.name, 'Διαγραφή', async()=>{ if(await del('customers',c.id,'Διαγράφηκε ο πελάτης')) location.hash='customers'; }); };
ACT['c-csv']=()=>downloadCSV(`pelates-${today()}.csv`,['Όνομα','Εταιρεία','Τηλέφωνο','Email','Διεύθυνση','Πόλη','ΑΦΜ','ΔΟΥ','Έκπτωση'],sortBy(Object.values(D.customers),c=>c.company||c.name||'').map(c=>[c.name,c.company,c.phone,c.email,c.address,c.city,c.vat,c.doy,c.discount]));

/* ---------- maintenance ---------- */
VIEWS.maintenance = () => {
  const tab=UI.mntTab; let list=Object.values(D.maintenance);
  const cnt={open:list.filter(m=>m.status!=='done').length, done:list.filter(m=>m.status==='done').length, all:list.length};
  if(tab==='open') list=list.filter(m=>m.status!=='done'); else if(tab==='done') list=list.filter(m=>m.status==='done');
  list=sortBy(list,m=>(m.status==='done'?'1':'0')+(m.start||''));
  const cost=Object.values(D.maintenance).filter(m=>(m.start||'').startsWith(today().slice(0,4))).reduce((s,m)=>s+num(m.cost),0);
  return `<div class="ph"><div><h1>Συντήρηση & βλάβες</h1><p class="sub">Ο εξοπλισμός σε συντήρηση αφαιρείται αυτόματα από τη διαθεσιμότητα · κόστος ${today().slice(0,4)}: <b>${money(cost)}</b></p></div>${can('staff')?`<button class="btn pri" data-act="new-mnt">+ Νέα εγγραφή</button>`:''}</div>
  <div class="tabs">${[['open','Σε εξέλιξη'],['done','Ολοκληρωμένα'],['all','Όλα']].map(([k,l])=>`<button class="${tab===k?'on':''}" data-act="tab" data-k="mntTab" data-v="${k}">${l}<span class="c">${cnt[k]}</span></button>`).join('')}</div>
  <div class="card p0">${list.length?`<div class="tw"><table><thead><tr><th>Αρ.</th><th>Θέμα</th><th>Εξοπλισμός</th><th>Περίοδος</th><th>Συνεργείο</th><th class="num">Κόστος</th><th>Κατάσταση</th></tr></thead><tbody>${list.map(m=>`<tr class="click" data-act="edit-mnt" data-id="${m.id}"><td class="mono">${esc(m.number||'')}</td><td><b>${esc(m.title||'Βλάβη')}</b>${m.orderId&&D.orders[m.orderId]?`<div class="xs muted">από ${esc(D.orders[m.orderId].number)}</div>`:''}</td><td>${esc(prodName(m.productId))}<div class="xs muted">${m.unitId?esc(D.units[m.unitId]?.code||''):(num(m.qty)||1)+' τεμ.'}</div></td><td class="small" style="white-space:nowrap">${fmtD(m.start)} → ${m.end?fmtD(m.end):'<span class="faint">αόριστα</span>'}</td><td class="small">${esc(m.vendor||'')}</td><td class="num">${m.cost?money(m.cost):''}</td><td>${pill(m.status,MSTATUS)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>Καμία εγγραφή</b>Κατέγραψε βλάβες, επισκευές και service. Μπορείς να δηλώσεις βλάβη και κατά την επιστροφή μιας παραγγελίας.</div>'}</div>`;
};
function maintenanceModal(id, preset){
  const m=id?deepCopy(D.maintenance[id]):Object.assign({id:null,productId:'',unitId:'',qty:1,title:'',description:'',status:'open',start:today(),end:'',vendor:'',cost:'',orderId:''},preset||{});
  M={type:'mnt', m, redraw:drawMnt}; drawMnt();
}
function drawMnt(){
  const m=M.m, p=D.products[m.productId];
  const prodOpts=prodsSorted(Object.values(D.products).filter(x=>x.kind!=='bundle')).map(x=>`<option value="${x.id}" ${x.id===m.productId?'selected':''}>${esc(x.name)} · ${esc(x.sku)}</option>`).join('');
  openModal(`<div class="dlg-h"><h2>${m.id?'Συντήρηση '+esc(m.number||''):'Νέα εγγραφή συντήρησης'}</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
    <label class="f">Προϊόν *<select data-mm="productId"><option value="">— Επίλεξε —</option>${prodOpts}</select></label>
    ${p?(p.tracking==='serial'?`<label class="f">Τεμάχιο *<select data-mm="unitId"><option value="">— Επίλεξε τεμάχιο —</option>${unitsOf(p.id).map(u=>`<option value="${u.id}" ${u.id===m.unitId?'selected':''}>${esc(u.code)}${u.serial?' · S/N '+esc(u.serial):''}</option>`).join('')}</select></label>`:`<label class="f">Ποσότητα<input type="number" min="1" data-mm="qty" value="${esc(m.qty)}"></label>`):''}
    <label class="f">Θέμα *<input type="text" data-mm="title" value="${esc(m.title)}" placeholder="π.χ. Σπασμένο βύσμα" ${m.id?'':'autofocus'}></label>
    <label class="f">Περιγραφή<textarea data-mm="description">${esc(m.description)}</textarea></label>
    <div class="f3"><label class="f">Από<input type="date" data-mm="start" value="${esc(m.start)}"></label><label class="f">Αναμ. επιστροφή<input type="date" data-mm="end" value="${esc(m.end)}"></label><label class="f">Κατάσταση<select data-mm="status">${Object.entries(MSTATUS).map(([k,v])=>`<option value="${k}" ${m.status===k?'selected':''}>${v.l}</option>`).join('')}</select></label></div>
    <div class="f2"><label class="f">Συνεργείο / τεχνικός<input type="text" data-mm="vendor" value="${esc(m.vendor)}"></label><label class="f">Κόστος €<input type="number" min="0" step="0.01" data-mm="cost" value="${esc(m.cost)}"></label></div>
    <div class="xs muted">Όσο η εγγραφή δεν είναι «Ολοκληρώθηκε», ο εξοπλισμός δεν είναι διαθέσιμος για παραγγελίες (χωρίς ημ. επιστροφής: αόριστα).</div></div>
  <div class="dlg-f">${m.id?'<button class="btn dangerous" data-act="m-del" style="margin-right:auto">Διαγραφή</button>':''}${m.id&&m.status!=='done'?'<button class="btn green" data-act="m-done">✓ Ολοκληρώθηκε</button>':''}<button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="m-save" data-primary>Αποθήκευση</button></div>`);
}
ON_INPUT.push(el=>{ if(el.dataset.mm!==undefined&&M&&M.type==='mnt'){ M.m[el.dataset.mm]=el.value; return true; } return false; });
ON_CHANGE.push(el=>{ if(el.dataset.mm!==undefined&&M&&M.type==='mnt'){ M.m[el.dataset.mm]=el.value; if(el.dataset.mm==='productId'){ M.m.unitId=''; drawMnt(); } return true; } return false; });
ACT['new-mnt']=()=>maintenanceModal(null);
ACT['edit-mnt']=el=>maintenanceModal(el.dataset.id);
ACT['m-done']=()=>{ M.m.status='done'; if(!M.m.end||M.m.end>today()) M.m.end=today(); ACT['m-save'](); };
ACT['m-save']=async()=>{ const m=M.m; const p=D.products[m.productId];
  if(!p) return toast('Επίλεξε προϊόν.', true); if(p.tracking==='serial'&&!m.unitId) return toast('Επίλεξε τεμάχιο.', true); if(!(m.title||'').trim()) return toast('Συμπλήρωσε θέμα.', true);
  if(!m.number) m.number='SRV-'+String(await nextNumber('maintenance')).padStart(4,'0');
  const d=strip(m); d.qty=p.tracking==='serial'?1:Math.max(1,Math.round(num(m.qty))); d.cost=num(m.cost)||''; if(d.status==='done'&&!d.closedAt) d.closedAt=Date.now();
  if(await put('maintenance',m.id||uid('mt'),d,'Αποθηκεύτηκε η συντήρηση '+d.number)) closeModal(); };
ACT['m-del']=()=>{ const m=M.m; confirmBox('Διαγραφή εγγραφής;', m.title, 'Διαγραφή', async()=>{ await del('maintenance',m.id,'Διαγράφηκε'); }); };

/* ---------- reports ---------- */
VIEWS.reports = () => {
  const y=today().slice(0,4); const from=UI.repFrom||y+'-01-01', to=UI.repTo||y+'-12-31';
  const orders=Object.values(D.orders).filter(o=>REVENUE.includes(o.status)&&o.start&&o.start>=from&&o.start<=to);
  const totNet=orders.reduce((s,o)=>s+orderTotals(o).net,0);
  // per month
  const months={}; for(let d=from.slice(0,7); d<=to.slice(0,7); ){ months[d]=0; let [yy,mm]=d.split('-').map(Number); mm++; if(mm>12){mm=1;yy++;} d=yy+'-'+String(mm).padStart(2,'0'); if(Object.keys(months).length>36) break; }
  for(const o of orders){ const k=o.start.slice(0,7); if(k in months) months[k]+=orderTotals(o).net; }
  const maxM=Math.max(1,...Object.values(months));
  // products
  const P={}; for(const o of orders){ const tt=orderTotals(o); for(const l of o.lines||[]){ if(!l.pid) continue; const r=P[l.pid]=P[l.pid]||{n:0,qty:0,unitDays:0,rev:0}; r.n++; r.qty+=num(l.qty); r.unitDays+=num(l.qty)*tt.days; r.rev+=lineTotal(l,tt.days)*(1-num(o.discount)/100); } }
  const topP=Object.entries(P).sort((a,b)=>b[1].rev-a[1].rev);
  const maxP=Math.max(1,...topP.map(x=>x[1].rev));
  // utilization
  const span=Math.max(1,Math.min(diffDays(from,to),diffDays(from,today()))+1);
  const util=Object.values(D.products).filter(p=>p.kind!=='bundle'&&!p.archived&&stockOf(p.id)>0).map(p=>{ let ud=0; for(const o of orders){ const q=expandLines(o.lines)[p.id]; if(q){ const s=o.start>from?o.start:from, e=(o.end||o.start)<to?(o.end||o.start):to; if(e>=s) ud+=q*(diffDays(s,e)+1); } } return {p, ud, pct:Math.min(100,100*ud/(stockOf(p.id)*span))}; }).sort((a,b)=>b.pct-a.pct);
  // customers
  const C={}; for(const o of orders){ const k=o.customerId||'_'; const r=C[k]=C[k]||{n:0,rev:0}; r.n++; r.rev+=orderTotals(o).net; }
  const topC=Object.entries(C).sort((a,b)=>b[1].rev-a[1].rev);
  const mnt=Object.values(D.maintenance).filter(m=>(m.start||'')>=from&&(m.start||'')<=to);
  UI._rep={topP,topC,util,months};
  return `<div class="ph"><div><h1>Αναφορές</h1><p class="sub">Βάσει παραγγελιών με κράτηση, σε εξέλιξη ή επιστραμμένων · ποσά χωρίς ΦΠΑ</p></div>
    <div class="row"><label class="f" style="flex-direction:row;align-items:center;gap:6px">Από <input type="date" data-bindc="repFrom" value="${from}"></label><label class="f" style="flex-direction:row;align-items:center;gap:6px">Έως <input type="date" data-bindc="repTo" value="${to}"></label>
    <div class="seg"><button data-act="rep-preset" data-v="month">Μήνας</button><button data-act="rep-preset" data-v="year">Έτος</button><button data-act="rep-preset" data-v="last">Πέρσι</button></div></div></div>
  <div class="grid g4" style="margin-bottom:16px"><div class="card stat"><div class="n">${money(totNet)}</div><div class="l">Καθαρά έσοδα</div></div><div class="card stat"><div class="n">${orders.length}</div><div class="l">Παραγγελίες</div></div><div class="card stat"><div class="n">${money(orders.length?totNet/orders.length:0)}</div><div class="l">Μέση αξία παραγγελίας</div></div><div class="card stat"><div class="n">${money(mnt.reduce((s,m)=>s+num(m.cost),0))}</div><div class="l">Κόστος συντήρησης (${mnt.length})</div></div></div>
  <div class="card" style="margin-bottom:16px"><div class="row between"><h2>Έσοδα ανά μήνα</h2><button class="btn sm" data-act="rep-csv" data-v="months">CSV</button></div><div class="vbars">${Object.entries(months).map(([k,v])=>`<div title="${money(v)}"><b>${v?Math.round(v).toLocaleString('el-GR'):''}</b><i style="height:${Math.round(100*v/maxM)}%"></i><span>${MONTHS[+k.slice(5)-1]} ${k.slice(2,4)}</span></div>`).join('')}</div></div>
  <div class="grid g2">
    <div class="card p0"><div class="card-h"><h2>Προϊόντα με τα περισσότερα έσοδα</h2><button class="btn sm" data-act="rep-csv" data-v="products">CSV</button></div>${topP.length?`<div class="tw"><table><thead><tr><th>Προϊόν</th><th class="num">Ενοικ.</th><th class="num">Τεμ.×ημ.</th><th style="width:30%">Έσοδα</th></tr></thead><tbody>${topP.slice(0,15).map(([pid,r])=>`<tr><td><a class="lk" href="#product-${pid}">${esc(prodName(pid))}</a></td><td class="num">${r.n}</td><td class="num">${r.unitDays}</td><td><div class="hbar"><div class="bar"><i style="width:${100*r.rev/maxP}%"></i></div><span class="small num" style="min-width:80px">${money(r.rev)}</span></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Δεν υπάρχουν δεδομένα.</div>'}</div>
    <div class="card p0"><div class="card-h"><h2>Αξιοποίηση εξοπλισμού</h2><button class="btn sm" data-act="rep-csv" data-v="util">CSV</button></div>${util.length?`<div class="tw"><table><thead><tr><th>Προϊόν</th><th class="num">Απόθ.</th><th style="width:45%">% χρόνου ενοικιασμένο</th></tr></thead><tbody>${util.slice(0,15).map(u=>`<tr><td><a class="lk" href="#product-${u.p.id}">${esc(u.p.name)}</a></td><td class="num">${stockOf(u.p.id)}</td><td><div class="hbar"><div class="bar"><i style="width:${u.pct}%;background:${u.pct>70?'var(--green)':(u.pct<10?'var(--faint)':'var(--pri)')}"></i></div><span class="small num" style="min-width:44px">${u.pct<10?u.pct.toFixed(1):u.pct.toFixed(0)}%</span></div></td></tr>`).join('')}</tbody></table></div><div class="xs muted" style="padding:10px 18px">Χαμηλή αξιοποίηση = υποψήφιο για πώληση· υψηλή = ίσως χρειάζεσαι περισσότερα τεμάχια.</div>`:'<div class="empty">Δεν υπάρχουν δεδομένα.</div>'}</div>
    <div class="card p0"><div class="card-h"><h2>Καλύτεροι πελάτες</h2><button class="btn sm" data-act="rep-csv" data-v="customers">CSV</button></div>${topC.length?`<div class="tw"><table><thead><tr><th>Πελάτης</th><th class="num">Παραγγελίες</th><th class="num">Έσοδα</th></tr></thead><tbody>${topC.slice(0,15).map(([cid,r])=>`<tr><td>${cid==='_'?'<span class="muted">Χωρίς πελάτη</span>':`<a class="lk" href="#customer-${cid}">${esc(custName(cid))}</a>`}</td><td class="num">${r.n}</td><td class="num">${money(r.rev)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Δεν υπάρχουν δεδομένα.</div>'}</div>
    <div class="card p0"><div class="card-h"><h2>Συντήρηση ανά προϊόν</h2></div>${mnt.length?`<table><tbody>${Object.entries(mnt.reduce((a,m)=>{ const r=a[m.productId]=a[m.productId]||{n:0,c:0}; r.n++; r.c+=num(m.cost); return a; },{})).sort((a,b)=>b[1].n-a[1].n).slice(0,12).map(([pid,r])=>`<tr><td>${esc(prodName(pid))}</td><td class="num">${r.n} βλάβες</td><td class="num">${money(r.c)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Καμία βλάβη στην περίοδο 👍</div>'}</div>
  </div>`;
};
ACT['rep-preset']=el=>{ const t=today(), y=+t.slice(0,4); if(el.dataset.v==='month'){ UI.repFrom=t.slice(0,8)+'01'; UI.repTo=addDays(new Date(Date.UTC(y,+t.slice(5,7),1)).toISOString().slice(0,10),-1); } else if(el.dataset.v==='year'){ UI.repFrom=y+'-01-01'; UI.repTo=y+'-12-31'; } else { UI.repFrom=(y-1)+'-01-01'; UI.repTo=(y-1)+'-12-31'; } render(); };
ACT['rep-csv']=el=>{ const R=UI._rep, v=el.dataset.v;
  if(v==='months') downloadCSV('esoda-ana-mina.csv',['Μήνας','Καθαρά έσοδα'],Object.entries(R.months).map(([k,x])=>[k,r2(x)]));
  if(v==='products') downloadCSV('proionta-esoda.csv',['Κωδικός','Προϊόν','Ενοικιάσεις','Τεμάχια×ημέρες','Έσοδα'],R.topP.map(([pid,r])=>[D.products[pid]?.sku,prodName(pid),r.n,r.unitDays,r2(r.rev)]));
  if(v==='util') downloadCSV('axiopoiisi.csv',['Κωδικός','Προϊόν','Απόθεμα','Τεμάχια×ημέρες','%'],R.util.map(u=>[u.p.sku,u.p.name,stockOf(u.p.id),u.ud,u.pct.toFixed(1)]));
  if(v==='customers') downloadCSV('pelates-esoda.csv',['Πελάτης','Παραγγελίες','Έσοδα'],R.topC.map(([cid,r])=>[custName(cid)||'—',r.n,r2(r.rev)])); };

/* ---------- scan ---------- */
VIEWS.scan = () => {
  const r=UI.scan; let res='';
  if(r){
    const f=r.found, t=today();
    if(!f) res=`<div class="card"><div class="empty"><b>Δεν βρέθηκε τίποτα με κωδικό «${esc(r.code)}»</b>${can('staff')?`<button class="btn pri" data-act="scan-new" data-code="${esc(r.code)}" style="margin-top:12px">+ Νέο προϊόν με αυτόν τον κωδικό</button>`:''}</div></div>`;
    else if(f.type==='order') res=`<div class="card"><div class="row between"><div><div class="muted small">Παραγγελία</div><h1>${esc(f.order.number)} ${pill(f.order.status)}</h1><div class="muted">${esc(custName(f.order.customerId))} · ${fmtD(f.order.start)} → ${fmtD(f.order.end)}</div></div><a class="btn pri" href="#order-${f.order.id}">Άνοιγμα →</a></div></div>`;
    else { const p=f.product, u=f.unit, fr=freeUnits(p.id,t,t).free; const us=u?unitState(u):null;
      const book=sortBy(Object.values(D.orders).filter(o=>HOLD.includes(o.status)&&orderRange(o)[1]>=t&&expandLines(o.lines)[p.id]),o=>o.start);
      res=`<div class="card"><div class="row" style="align-items:flex-start;gap:20px">${imgSrc(p)?prodImg(p,120):''}<div style="width:120px">${qrSVG(u?u.code:p.sku,120)}</div><div class="grow">
        <div class="muted small">${u?'Τεμάχιο':'Προϊόν'} · <span class="mono">${esc(u?u.code:p.sku)}</span>${u&&u.serial?' · S/N '+esc(u.serial):''}</div><h1>${esc(p.name)}</h1><div class="muted">${esc(catPath(p.cat))}${(u&&u.location)||p.location?' · 📍 <b>'+esc((u&&u.location)||p.location)+'</b>':''}</div>
        ${us?`<div style="margin-top:10px">${pill(us.k,{[us.k]:us})} ${us.ref&&us.k==='out'?`<a href="#order-${us.ref.id}">${esc(us.ref.number)}</a>`:''}${us.ref&&us.k==='mnt'?`<a href="#" data-act="edit-mnt" data-id="${us.ref.id}">${esc(us.ref.title)}</a>`:''}</div>`:''}
        <div class="row" style="margin-top:14px;gap:28px"><div class="stat"><div class="n">${stockOf(p.id)}</div><div class="l">Απόθεμα</div></div><div class="stat"><div class="n av ${avCls(fr)}">${fr}</div><div class="l">Διαθέσιμα σήμερα</div></div><div class="stat"><div class="n">${money(productPrice(p))}</div><div class="l">Τιμή</div></div></div></div>
        <div class="grid" style="gap:6px"><a class="btn" href="#product-${p.id}">Καρτέλα προϊόντος</a>${can('staff')?`<button class="btn" data-act="${u?'u-edit':'edit-product'}" data-id="${u?u.id:p.id}">✎ Επεξεργασία</button><button class="btn" data-act="new-mnt-scan" data-p="${p.id}" data-u="${u?u.id:''}">🔧 Βλάβη</button>`:''}</div></div>
        <h2 style="margin-top:18px">Επόμενες κρατήσεις</h2>${book.length?book.map(o=>`<div class="li"><div><a class="lk" href="#order-${o.id}">${esc(o.number)} · ${esc(o.name||custName(o.customerId))}</a><div class="small muted">${fmtD(o.start)} → ${fmtD(o.end)} · ${expandLines(o.lines)[p.id]} τεμ.</div></div>${pill(o.status)}</div>`).join(''):'<div class="muted">Καμία.</div>'}</div>`; }
  }
  return `<div class="ph"><div><h1>Σάρωση QR</h1><p class="sub">Barcode scanner (USB/Bluetooth), κάμερα κινητού ή πληκτρολόγηση κωδικού</p></div></div>
  <div class="scanbox" style="margin-bottom:16px;padding:16px"><span style="font-size:22px">▣</span><input type="text" id="scanInput" data-enter="scan" data-autofocus placeholder="Σκάναρε ή γράψε κωδικό και πάτα Enter" style="font-size:17px;padding:10px 12px" autocomplete="off"><button class="btn pri" data-act="scan-cam">📷 Κάμερα</button></div>
  ${SERVER&&!window.isSecureContext?`<div class="small muted" style="margin:-6px 0 14px">Για ζωντανή σάρωση με την κάμερα του κινητού άνοιξε την εφαρμογή μέσω <b>https://</b> (δες Ρυθμίσεις › Δίκτυο). Χωρίς https η κάμερα τραβάει φωτογραφία του κωδικού.</div>`:''}
  ${res}`;
};
ENTER['scan']=v=>{ UI.scan={code:v, found:findCode(v)}; render(); };
ACT['scan-cam']=()=>openCamera(code=>{ UI.scan={code, found:findCode(code)}; render(); });
ACT['scan-new']=el=>{ productModal(null,'item'); M.p.sku=el.dataset.code; drawProductModal(); };
ACT['new-mnt-scan']=el=>maintenanceModal(null,{productId:el.dataset.p, unitId:el.dataset.u, start:today()});

/* ---------- settings ---------- */
VIEWS.setup = () => {
  const tab=UI.setTab; const admin=can('admin');
  const tabs=(SERVER?[['company','Εταιρεία & έγγραφα'],['users','Χρήστες'],['network','Δίκτυο & συσκευές'],['backup','Αντίγραφα ασφαλείας'],['log','Ιστορικό ενεργειών'],['me','Ο λογαριασμός μου']]:[['company','Εταιρεία & έγγραφα'],['access','Χρήστες & πρόσβαση'],['backup','Αντίγραφα ασφαλείας'],['log','Ιστορικό ενεργειών']]).filter(([k])=>admin||['network','me','access'].includes(k));
  const cur=tabs.find(t=>t[0]===tab)?tab:tabs[0][0];
  let body='';
  if(cur==='company'){ const s=settings(); const f=(k,l,t='text',ph='')=>`<label class="f">${l}<input type="${t}" data-sm="${k}" value="${esc(s[k]??'')}" placeholder="${esc(ph)}"></label>`;
    body=`<div class="card grid" style="gap:14px;max-width:820px"><h2 style="margin:0">Στοιχεία εταιρείας</h2>
    <div class="f2">${f('name','Επωνυμία')}${f('phone','Τηλέφωνο')}</div><div class="f2">${f('address','Διεύθυνση')}${f('city','Πόλη / ΤΚ')}</div><div class="f3">${f('vat','ΑΦΜ')}${f('doy','ΔΟΥ')}${f('email','Email')}</div>
    <hr style="margin:4px 0"><h2 style="margin:0">Τιμολόγηση & αρίθμηση</h2>
    <div class="f4">${f('vatRate','ΦΠΑ %','number','24')}${f('orderPrefix','Πρόθεμα παραγγελιών','text','ORD-')}${f('quotePrefix','Πρόθεμα προσφορών','text','ΠΡ-')}${f('invoicePrefix','Πρόθεμα προτιμολογίων','text','ΠΤ-')}</div>
    <div class="f2">${f('quoteValidity','Ισχύς προσφοράς (ημέρες)','number','15')}${f('footer','Υποσέλιδο εγγράφων')}</div>
    <label class="f">Τραπεζικοί λογαριασμοί (στα έγγραφα)<textarea data-sm="bank">${esc(s.bank||'')}</textarea></label>
    <label class="f">Όροι ενοικίασης (στο συμφωνητικό)<textarea data-sm="terms" rows="6">${esc(s.terms||'')}</textarea></label>
    <div class="row end"><button class="btn pri" data-act="s-save">Αποθήκευση</button></div></div>`; }
  if(cur==='users'){ const us=sortBy(Object.values(D.users),u=>u.username||'');
    body=`<div class="card p0" style="max-width:900px"><div class="card-h"><h2>Χρήστες</h2><button class="btn pri sm" data-act="usr-new">+ Νέος χρήστης</button></div><table><thead><tr><th>Όνομα χρήστη</th><th>Όνομα</th><th>Ρόλος</th><th>Κατάσταση</th><th></th></tr></thead><tbody>${us.map(u=>`<tr><td class="b">${esc(u.username)}</td><td>${esc(u.name||'')}</td><td>${esc(ROLES[u.role]||u.role)}</td><td>${u.disabled?pill('x',{x:{l:'Ανενεργός',c:'gray'}}):pill('x',{x:{l:'Ενεργός',c:'green'}})}</td><td class="num"><button class="icon" data-act="usr-edit" data-id="${u.id}">✎</button>${u.id!==UI.me.id?`<button class="icon" data-act="usr-del" data-id="${u.id}">✕</button>`:''}</td></tr>`).join('')}</tbody></table>
    <div class="xs muted" style="padding:12px 18px"><b>Διαχειριστής:</b> όλα, χρήστες & ρυθμίσεις · <b>Προσωπικό:</b> προϊόντα, παραγγελίες, πελάτες, συντήρηση · <b>Μόνο ανάγνωση:</b> προβολή χωρίς αλλαγές.</div></div>`; }
  if(cur==='network'){ const i=UI.info;
    if(!i){ api('/api/info').then(x=>{ UI.info=x; render(); }).catch(()=>{}); }
    body=`<div class="card" style="max-width:820px">${i?`<h2>Σύνδεση από άλλες συσκευές</h2><p class="muted">Ο server τρέχει στον υπολογιστή <b>${esc(i.host)}</b>. Από υπολογιστές και κινητά στο ίδιο δίκτυο άνοιξε μία από τις διευθύνσεις:</p>
      ${i.ips.map(ip=>`<div class="row" style="margin:12px 0;align-items:flex-start;gap:18px"><div>${qrSVG(`http://${ip}:${i.httpPort}`,110)}</div><div><div class="mono b" style="font-size:15px">http://${esc(ip)}:${i.httpPort}</div><div class="small muted">Για υπολογιστές</div><div class="mono b" style="font-size:15px;margin-top:8px">https://${esc(ip)}:${i.httpsPort}</div><div class="small muted">Για κινητά με ζωντανή σάρωση κάμερας (την πρώτη φορά πάτα «Για προχωρημένους › Συνέχεια» στην προειδοποίηση ασφαλείας)</div></div></div>`).join('')||'<div class="muted">Δεν βρέθηκε δίκτυο.</div>'}
      <hr><div class="small muted">Έκδοση ${esc(i.version)} · Δεδομένα: <span class="mono">${esc(i.dataDir)}</span><br>Αν δεν συνδέονται άλλες συσκευές, επίτρεψε το πρόγραμμα στο Τείχος προστασίας των Windows (ιδιωτικά δίκτυα).</div>`:'<div class="muted">Φόρτωση…</div>'}</div>`; }
  if(cur==='backup'){ body=`<div class="card grid" style="max-width:820px;gap:14px"><h2 style="margin:0">Αντίγραφα ασφαλείας</h2>
    <p class="muted" style="margin:0">Ο server κρατά αυτόματα ένα ημερήσιο αντίγραφο (τελευταίες 60 ημέρες) στον φάκελο <span class="mono">data\\backups</span> δίπλα στο πρόγραμμα. Καλό είναι να κατεβάζεις τακτικά ένα αντίγραφο και σε άλλο μέσο (USB, cloud).</p>
    <div class="row"><button class="btn pri" data-act="s-backup">⬇ Λήψη αντιγράφου τώρα</button></div><hr style="margin:0">
    <h2 style="margin:0">Επαναφορά</h2><p class="muted" style="margin:0">Αντικαθιστά <b>όλα</b> τα τρέχοντα δεδομένα με αυτά του αρχείου (κρατιέται αντίγραφο της τρέχουσας κατάστασης).</p>
    <div class="row"><input type="file" accept=".json,application/json" id="restoreFile"><button class="btn red" data-act="s-restore">Επαναφορά</button></div></div>`; }
  if(cur==='log'){ if(!UI._log){ loadLog().then(x=>{ UI._log=x; render(); }).catch(()=>{}); }
    body=`<div class="card p0" style="max-width:900px"><div class="card-h"><h2>Ιστορικό ενεργειών</h2><button class="btn sm" data-act="s-log-refresh">Ανανέωση</button></div>${UI._log?`<div class="tw" style="max-height:65vh;overflow:auto"><table><tbody>${UI._log.map(l=>`<tr><td class="small muted" style="white-space:nowrap">${fmtDT(l.ts)}</td><td class="b small">${esc(whoName(l.user))}</td><td>${esc(l.summary)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Φόρτωση…</div>'}</div>`; }
  if(cur==='access'){ body=`<div class="card" style="max-width:760px"><h2>Ποιος έχει πρόσβαση</h2><p>Η εφαρμογή τρέχει μέσα στο Claude. Οι συνεργάτες προστίθενται από το κουμπί <b>Share</b> της σελίδας:</p><dl class="kv"><dt><b>Editor</b></dt><dd>Διαχειριστής — όλα, μαζί με ρυθμίσεις, αντίγραφα και ιστορικό</dd><dt><b>Contributor</b></dt><dd>Προσωπικό — προϊόντα, παραγγελίες, πελάτες, συντήρηση</dd><dt><b>Viewer</b></dt><dd>Μόνο ανάγνωση</dd></dl><hr><div class="small muted">Είσαι συνδεδεμένος ως <b>${esc(UI.me.name||'—')}</b> · ρόλος: <b>${esc(ROLES[UI.me.role])}</b>. Όταν μεταφερθεί η εφαρμογή σε δικό σας server, κατέβασε ένα αντίγραφο ασφαλείας και κάνε επαναφορά εκεί — μεταφέρονται όλα τα δεδομένα.</div></div>`; }
  if(cur==='me'){ body=`<div class="card" style="max-width:520px"><dl class="kv"><dt>Χρήστης</dt><dd>${esc(UI.me.username)}</dd><dt>Όνομα</dt><dd>${esc(UI.me.name||'—')}</dd><dt>Ρόλος</dt><dd>${esc(ROLES[UI.me.role])}</dd></dl><hr><button class="btn" data-act="s-pw">Αλλαγή κωδικού</button></div>`; }
  return `<div class="ph"><div><h1>Ρυθμίσεις</h1></div></div><div class="tabs">${tabs.map(([k,l])=>`<button class="${cur===k?'on':''}" data-act="tab" data-k="setTab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
};
ACT['s-save']=async()=>{ const s={...strip(settings())}; $$('[data-sm]').forEach(el=>s[el.dataset.sm]=el.value); if(await put('settings','company',s,'Αποθηκεύτηκαν οι ρυθμίσεις')){ const lg=$('.logo div'); if(lg) lg.firstChild.textContent=s.name||'Αποθήκη'; } };
ACT['s-pw']=()=>passwordModal(false);
ACT['s-backup']=async()=>{ if(SERVER){ location.href='/api/backup'; return; } const b=await buildBackup(); download('apothiki-backup-'+today()+'.json', JSON.stringify(b,null,1), 'application/json'); };
ACT['s-log-refresh']=()=>{ UI._log=null; render(); };
ACT['s-restore']=()=>{ const f=$('#restoreFile').files[0]; if(!f) return toast('Επίλεξε αρχείο αντιγράφου.', true);
  confirmBox('Επαναφορά αντιγράφου;', 'Όλα τα τρέχοντα δεδομένα θα αντικατασταθούν από το αρχείο '+f.name+'.', 'Επαναφορά', async()=>{ try{ const data=JSON.parse(await f.text()); if(SERVER){ await api('/api/restore',data); await loadState(); } else await restoreBackup(data); toast('Η επαναφορά ολοκληρώθηκε'); }catch(e){ toast(e.error||'Μη έγκυρο αρχείο', true); } }); };
function userModal(id){ const u=id?{...D.users[id]}:{id:'',username:'',name:'',role:'staff',disabled:false}; M={type:'usr',u};
  openModal(`<div class="dlg-h"><h2>${id?'Επεξεργασία':'Νέος'} χρήστης</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <div class="f2"><label class="f">Όνομα χρήστη<input type="text" id="uUser" value="${esc(u.username)}" autofocus autocomplete="off"></label><label class="f">Ονοματεπώνυμο<input type="text" id="uName" value="${esc(u.name)}"></label></div>
  <div class="f2"><label class="f">Ρόλος<select id="uRole">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="f">${id?'Νέος κωδικός (κενό = ίδιος)':'Κωδικός'}<input type="password" id="uPass" autocomplete="new-password"></label></div>
  ${id?`<label class="ck"><input type="checkbox" id="uDis" ${u.disabled?'checked':''}> Ανενεργός (δεν μπορεί να συνδεθεί)</label>`:''}<div class="xs muted">Με νέο κωδικό ο χρήστης θα του ζητηθεί να τον αλλάξει στην πρώτη σύνδεση.</div></div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="usr-save" data-primary>Αποθήκευση</button></div>`,'sm'); }
ACT['usr-new']=()=>userModal(null);
ACT['usr-edit']=el=>userModal(el.dataset.id);
ACT['usr-save']=async()=>{ try{ await api('/api/users/save',{id:M.u.id, username:$('#uUser').value, name:$('#uName').value, role:$('#uRole').value, password:$('#uPass').value, disabled:!!($('#uDis')&&$('#uDis').checked)}); closeModal(); toast('Ο χρήστης αποθηκεύτηκε'); await loadState(); }catch(e){ toast(e.error, true); } };
ACT['usr-del']=el=>{ const u=D.users[el.dataset.id]; confirmBox(`Διαγραφή χρήστη ${u.username};`, 'Δεν θα μπορεί πλέον να συνδεθεί.', 'Διαγραφή', async()=>{ try{ await api('/api/users/del',{id:u.id}); toast('Διαγράφηκε'); await loadState(); }catch(e){ toast(e.error,true); return false; } }); };

/* ---------- documents ---------- */
UI.docTab='all';
VIEWS.documents = () => {
  const rows=[];
  for(const o of Object.values(D.orders)){ const t=orderTotals(o);
    if(o.quoteNo) rows.push({type:'quote', no:o.quoteNo, o, t});
    if(o.invoiceNo) rows.push({type:'invoice', no:o.invoiceNo, o, t}); }
  const cnt={all:rows.length, quote:rows.filter(r=>r.type==='quote').length, invoice:rows.filter(r=>r.type==='invoice').length};
  let list=UI.docTab==='all'?rows:rows.filter(r=>r.type===UI.docTab);
  const q=(UI.docQ||'').trim().toLowerCase(); if(q) list=list.filter(r=>[r.no,r.o.number,custName(r.o.customerId)].some(v=>(v||'').toLowerCase().includes(q)));
  list=sortBy(list,r=>'~'+(9e15-(new Date(r.o.start||0)).getTime()));
  const TL={quote:'Προσφορά', invoice:'Προτιμολόγιο'};
  return `<div class="ph"><div><h1>Έγγραφα</h1><p class="sub">Προσφορές και προτιμολόγια παραγγελιών · νέο έγγραφο φτιάχνεις μέσα από την παραγγελία</p></div></div>
  <div class="tabs">${[['all','Όλα'],['quote','Προσφορές'],['invoice','Προτιμολόγια']].map(([k,l])=>`<button class="${UI.docTab===k?'on':''}" data-act="tab" data-k="docTab" data-v="${k}">${l}<span class="c">${cnt[k]}</span></button>`).join('')}</div>
  <div class="card p0"><div class="card-h"><input type="search" class="grow" style="max-width:380px" placeholder="Αναζήτηση αριθμού ή πελάτη…" data-bind="docQ" value="${esc(UI.docQ||'')}"></div>
  ${list.length?`<div class="tw"><table><thead><tr><th>Έγγραφο</th><th>Αριθμός</th><th>Παραγγελία</th><th>Πελάτης</th><th>Περίοδος</th><th class="num">Σύνολο</th><th>Πληρωμή</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td>${TL[r.type]}</td><td class="b mono">${esc(r.no)}</td><td><a class="lk" href="#order-${r.o.id}">${esc(r.o.number)}</a></td><td>${esc(custName(r.o.customerId))}</td><td class="small" style="white-space:nowrap">${fmtD(r.o.start)} → ${fmtD(r.o.end)}</td><td class="num b">${money(r.t.total)}</td><td>${pill(payStatus(r.o),PAY)}</td><td><button class="btn sm" data-act="doc-open" data-id="${r.o.id}" data-v="${r.type}">Άνοιγμα</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>Κανένα έγγραφο</b></div>'}</div>`;
};
ACT['doc-open']=el=>{ const o=D.orders[el.dataset.id]; if(o) printOrderDoc(o, el.dataset.v); };
