/* ===================== INVENTORY: products, units, bundles, categories ===================== */
'use strict';

VIEWS.products = () => {
  const t=today(), tab=UI.prodTab;
  let list=Object.values(D.products);
  const cnt={all:list.filter(p=>!p.archived).length, item:list.filter(p=>p.kind!=='bundle'&&!p.archived).length, bundle:list.filter(p=>p.kind==='bundle'&&!p.archived).length, archived:list.filter(p=>p.archived).length};
  list = tab==='archived' ? list.filter(p=>p.archived) : list.filter(p=>!p.archived);
  if(tab==='item') list=list.filter(p=>p.kind!=='bundle'); if(tab==='bundle') list=list.filter(p=>p.kind==='bundle');
  if(UI.prodCat==='none') list=list.filter(p=>!p.cat||!D.categories[p.cat]);
  else if(UI.prodCat!=='all'){ const set=catDesc(UI.prodCat); list=list.filter(p=>set.has(p.cat)); }
  const q=UI.prodQ.trim().toLowerCase();
  if(q) list=list.filter(p=>[p.name,p.sku,p.location,p.supplier,p.notes,catPath(p.cat)].some(v=>(v||'').toLowerCase().includes(q)));
  list=prodsSorted(list);
  const counts={}; for(const p of Object.values(D.products)){ if(p.archived) continue; let c=D.categories[p.cat], g=0; while(c&&g++<10){ counts[c.id]=(counts[c.id]||0)+1; c=D.categories[c.parent]; } }
  UI.catOpen=UI.catOpen||new Set();
  const tree=(parent,depth)=>depth>9?"":sortBy(Object.values(D.categories).filter(c=>(c.parent||'')===(parent||'')),c=>c.name).map(c=>{ const kids=Object.values(D.categories).some(x=>x.parent===c.id); const open=UI.catOpen.has(c.id);
    return `<a class="${UI.prodCat===c.id?'on':''}${depth?'':' main'}" data-act="cat-tog" data-v="${c.id}" style="padding-left:${9+depth*14}px">${kids?`<i class="caret${open?' open':''}">›</i>`:`<i class="caret"></i>`}<em class="tn">${esc(c.name)}</em><span>${depth?(counts[c.id]||0):catCount(c.id)}</span></a>`+(kids&&open?tree(c.id,depth+1):''); }).join('');
  const noCat=Object.values(D.products).filter(p=>!p.archived&&(!p.cat||!D.categories[p.cat])).length;
  const allSel=list.length&&list.every(p=>UI.prodSel.has(p.id));
  const rows=list.map(p=>{ const st=stockOf(p.id), fr=freeUnits(p.id,t,t).free; const mnt=Object.values(D.maintenance).filter(m=>m.productId===p.id&&m.status!=='done').length;
    return `<tr><td><input type="checkbox" data-act="p-sel" data-id="${p.id}" ${UI.prodSel.has(p.id)?'checked':''}></td>
    <td><div class="pcell">${prodImg(p,38)}<div><a class="lk" href="#product-${p.id}">${esc(p.name)}</a> ${p.kind==='bundle'?'<span class="tag">Bundle</span>':''}${mnt?` <span class="pill red" title="Σε συντήρηση">🔧 ${mnt}</span>`:''}<div class="xs muted mono">${esc(p.sku)}</div></div></div></td>
    <td class="small c-type">${p.kind==='bundle'?'Bundle':(p.tracking==='serial'?'Σειριακοί':'Ποσότητα')}</td>
    <td class="num">${can('staff')&&p.kind!=='bundle'&&p.tracking!=='serial'?`<input type="number" min="0" step="1" class="qedit" data-qe="qty" data-id="${p.id}" value="${esc(p.qty??0)}" title="Απόθεμα — γράψε και πάτα Enter">`:st}</td><td class="num"><span class="avb ${avCls(fr)}">${fr}</span></td>
    <td class="num small pr" style="white-space:nowrap">${can('staff')?`<span class="qprice"><input type="number" min="0" step="0.01" class="qedit" data-qe="price" data-id="${p.id}" value="${esc(p.price??'')}" placeholder="${p.kind==='bundle'?'αυτόμ.':'0'}" title="Τιμή 1ης ημέρας (€, χωρίς ΦΠΑ) — γράψε και πάτα Enter"><span class="xs muted" title="${p.priceType!=='flat'&&productExtra(p)!==''?'Επόμενες ημέρες: '+money(productExtra(p)):''}">€${p.priceType==='flat'?'':'/ημ.'}</span></span>`:priceLabel(p)}</td>
    <td class="small c-loc">${esc(p.location||'')}</td>
    <td class="num" style="white-space:nowrap"><button class="icon" data-act="qr" data-code="${esc(p.sku)}" data-name="${esc(p.name)}" title="QR">▣</button>${can('staff')?`<button class="icon" data-act="edit-product" data-id="${p.id}" title="Επεξεργασία">✎</button>`:''}</td></tr>`; }).join('');
  return `<div class="ph"><div><h1>Προϊόντα</h1><p class="sub">Εξοπλισμός, bundles και απόθεμα</p></div>
    <div class="row"><button class="btn" data-act="p-labels" ${UI.prodSel.size?'':'disabled'}>Ετικέτες QR${UI.prodSel.size?` (${UI.prodSel.size})`:''}</button><button class="btn" data-act="p-csv">Εξαγωγή CSV</button>${can('staff')?`<button class="btn" data-act="p-import">Εισαγωγή CSV</button><button class="btn" data-act="new-bundle">+ Bundle</button><button class="btn pri" data-act="new-product">+ Νέο προϊόν</button>`:''}</div></div>
  <div class="tabs">${[['all','Όλα'],['item','Προϊόντα'],['bundle','Bundles'],['archived','Αρχειοθετημένα']].map(([k,l])=>`<button class="${tab===k?'on':''}" data-act="tab" data-k="prodTab" data-v="${k}">${l}<span class="c">${cnt[k]}</span></button>`).join('')}</div>
  <div class="split-l">
    <div class="card tree" style="padding:10px"><a class="${UI.prodCat==='all'?'on':''}" data-act="tab" data-k="prodCat" data-v="all">Όλες οι κατηγορίες<span>${cnt.all}</span></a>${tree('',0)}${noCat?`<a class="${UI.prodCat==='none'?'on':''}" data-act="tab" data-k="prodCat" data-v="none">Χωρίς κατηγορία<span>${noCat}</span></a>`:''}<div style="padding:8px 9px 2px"><a href="#categories" class="small" style="padding:0;color:var(--pri)">Διαχείριση κατηγοριών →</a></div></div>
    <div class="card p0"><div class="card-h"><input type="search" class="grow" style="max-width:420px" placeholder="Αναζήτηση ονόματος, κωδικού, θέσης…" data-bind="prodQ" value="${esc(UI.prodQ)}"><span class="xs muted hide-m">«Διαθέσιμα» = ελεύθερα σήμερα</span></div>
    ${isM()?mcatChips(cnt.all,noCat):''}
    ${list.length&&isM()?`<div class="mlist">${list.slice(0,UI.mProdN||60).map(p=>{ const st=stockOf(p.id), fr=freeUnits(p.id,t,t).free; return `<a class="mrow" href="#product-${p.id}">${prodImg(p,46)}<div class="mrow-m"><div class="mrow-n">${esc(p.name)}</div><div class="mrow-s mono">${esc(p.sku)}</div><div class="mrow-s">${p.cat&&D.categories[p.cat]?esc(catShort(D.categories[p.cat].name)):''}${p.location?' · 📍 '+esc(p.location):''}</div></div><div class="mrow-r"><span class="avb ${avCls(fr)}">${fr}</span><small>από ${st}</small></div></a>`; }).join('')}${list.length>(UI.mProdN||60)?`<button class="btn mmore" data-act="mprod-more">Εμφάνιση περισσότερων (${list.length-(UI.mProdN||60)})</button>`:''}</div>`:list.length?`<div class="tw ptab"><table><thead><tr><th><input type="checkbox" data-act="p-sel-all" ${allSel?'checked':''}></th><th>Προϊόν</th><th class="c-type">Τύπος</th><th class="num">Απόθεμα</th><th class="num">Διαθέσιμα</th><th class="num pr">Τιμή</th><th class="c-loc">Θέση</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    :`<div class="empty"><b>${Object.keys(D.products).length?'Κανένα αποτέλεσμα':'Δεν υπάρχουν προϊόντα ακόμη'}</b>${Object.keys(D.products).length?'Δοκίμασε άλλη αναζήτηση ή κατηγορία.':'Πρόσθεσε το πρώτο σου προϊόν.'}</div>`}</div>
  </div>`;
};
ACT['mprod-more']=()=>{ UI.mProdN=(UI.mProdN||60)+60; render(); };
ACT['p-sel']=el=>{ el.checked?UI.prodSel.add(el.dataset.id):UI.prodSel.delete(el.dataset.id); render(); };
ACT['p-sel-all']=el=>{ $$('[data-act=p-sel]').forEach(b=>el.checked?UI.prodSel.add(b.dataset.id):UI.prodSel.delete(b.dataset.id)); render(); };
ACT['p-labels']=()=>{ const items=[]; for(const id of UI.prodSel){ const p=D.products[id]; if(!p) continue; if(p.tracking==='serial'){ const us=unitsOf(id); if(us.length){ us.forEach(u=>items.push({code:u.code,name:p.name,sub:u.serial?'S/N '+u.serial:catPath(p.cat)})); continue; } } items.push({code:p.sku,name:p.name,sub:catPath(p.cat)}); } printLabels(items); };
ACT['p-csv']=()=>{ const t=today(); downloadCSV(`proionta-${t}.csv`, ['Κωδικός','Όνομα','Τύπος','Παρακολούθηση','Κατηγορία','Απόθεμα','Διαθέσιμα σήμερα','Τιμή','Τύπος τιμής','Αξία αντικατάστασης','Θέση','Προμηθευτής','Περιεχόμενα','Σημειώσεις'],
  prodsSorted().map(p=>[p.sku,p.name,p.kind==='bundle'?'Bundle':'Προϊόν',p.tracking==='serial'?'Σειριακοί':'Ποσότητα',catPath(p.cat),stockOf(p.id),freeUnits(p.id,t,t).free,productPrice(p),p.priceType==='flat'?'σταθερή':'ημέρα',p.replacement||'',p.location||'',p.supplier||'',(p.components||[]).map(c=>(D.products[c.pid]?.sku||'?')+' x'+c.qty).join('; '),p.notes||''])); };

/* ---------- CSV import ---------- */
ACT['p-import']=()=>{
  M={type:'import'};
  openModal(`<div class="dlg-h"><h2>Εισαγωγή προϊόντων από CSV</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <div class="small">Στήλες (με επικεφαλίδες, διαχωριστικό <b>;</b> ή <b>,</b>): <span class="mono">Κωδικός; Όνομα; Κατηγορία; Ποσότητα; Τιμή; Θέση; Προμηθευτής; Αξία αντικατάστασης</span>. Η κατηγορία μπορεί να είναι «Ήχος › Μικρόφωνα» — δημιουργείται αν δεν υπάρχει. Αν υπάρχει ήδη ο κωδικός, το προϊόν ενημερώνεται.</div>
  <input type="file" accept=".csv,text/csv" id="csvFile"><div id="csvPrev" class="small muted"></div></div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="p-import-go" data-primary>Εισαγωγή</button></div>`);
};
function parseCSV(text){
  const sep = (text.split('\n')[0].match(/;/g)||[]).length >= (text.split('\n')[0].match(/,/g)||[]).length ? ';' : ',';
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===sep){ row.push(cur); cur=''; } else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; } else if(ch!=='\r') cur+=ch; }
  if(cur||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.some(c=>c.trim()));
}
ACT['p-import-go']=async()=>{
  const f=$('#csvFile').files[0]; if(!f) return toast('Επίλεξε αρχείο.', true);
  const rows=parseCSV((await f.text()).replace(/^﻿/,'')); if(rows.length<2) return toast('Το αρχείο είναι κενό.', true);
  const head=rows[0].map(h=>h.trim().toLowerCase());
  const col=(...names)=>head.findIndex(h=>names.some(n=>h.includes(n)));
  const ci={sku:col('κωδικ','sku','code'), name:col('όνομα','ονομα','name','περιγρ'), cat:col('κατηγ','categ'), qty:col('ποσότ','ποσοτ','απόθ','qty','quant','stock'), price:col('τιμή','τιμη','price'), loc:col('θέση','θεση','locat'), sup:col('προμηθ','suppl'), rep:col('αντικατ','replac')};
  if(ci.name<0) return toast('Δεν βρέθηκε στήλη «Όνομα».', true);
  const ops=[]; const catByPath={}; for(const c of catsSorted()) catByPath[c.path.toLowerCase()]=c.id;
  const ensureCat=path=>{ if(!path) return ''; const parts=path.split(/›|>|\//).map(s=>s.trim()).filter(Boolean); let parent='', acc='';
    for(const part of parts){ acc=acc?acc+' › '+part:part; const k=acc.toLowerCase(); if(!catByPath[k]){ const id=uid('ct'); catByPath[k]=id; ops.push({op:'put',coll:'categories',id,doc:{name:part,parent}}); } parent=catByPath[k]; } return parent; };
  let skuN=0; const nextAutoSku=()=>{ let max=0; for(const p of Object.values(D.products)){ const m=/^EQ-(\d+)$/i.exec(p.sku||''); if(m) max=Math.max(max,+m[1]); } skuN++; return 'EQ-'+String(max+skuN).padStart(4,'0'); };
  let n=0;
  for(const r of rows.slice(1)){ const g=i=>i>=0?(r[i]||'').trim():''; const name=g(ci.name); if(!name) continue;
    const sku=g(ci.sku)||nextAutoSku(); const ex=Object.values(D.products).find(p=>(p.sku||'').toLowerCase()===sku.toLowerCase());
    const doc=ex?strip(ex):{kind:'item',tracking:'bulk',priceType:'day',components:[]};
    Object.assign(doc,{name,sku}); if(ci.cat>=0) doc.cat=ensureCat(g(ci.cat)); if(ci.qty>=0&&g(ci.qty)) doc.qty=Math.round(num(g(ci.qty))); if(ci.price>=0&&g(ci.price)) doc.price=num(g(ci.price));
    if(ci.loc>=0) doc.location=g(ci.loc); if(ci.sup>=0) doc.supplier=g(ci.sup); if(ci.rep>=0&&g(ci.rep)) doc.replacement=num(g(ci.rep));
    ops.push({op:'put',coll:'products',id:ex?ex.id:uid('pr'),doc}); n++; }
  if(await commit(ops, `Εισαγωγή ${n} προϊόντων από CSV`)) closeModal();
};

/* ---------- product page ---------- */
VIEWS.product = id => {
  const p=D.products[id]; if(!p) return `<div class="empty"><b>Το προϊόν δεν βρέθηκε</b><a href="#products">← Προϊόντα</a></div>`;
  const t=today(), st=stockOf(id), fr=freeUnits(id,t,t).free;
  const days=[...Array(30)].map((_,i)=>addDays(t,i));
  const strip=days.map(d=>{ const f=freeOnDay(id,d); return `<div class="${f<=0?'c-bad':(st&&f<=Math.ceil(st*.2)?'c-low':'c-ok')}" title="${fmtD(d)}: ${f} διαθέσιμα">${f}<small>${d.slice(8)}</small></div>`; }).join('');
  const orders=Object.values(D.orders).filter(o=>!['cancelled'].includes(o.status) && (orderRange(o)[1]>=addDays(t,-60)) && (expandLines(o.lines)[id] || (o.lines||[]).some(l=>l.pid===id)));
  const ordRows=sortBy(orders,o=>o.start||'').map(o=>`<tr class="click" data-act="go" data-href="#order-${o.id}"><td><b>${esc(o.number)}</b> ${esc(o.name||'')}</td><td>${esc(custName(o.customerId))}</td><td style="white-space:nowrap">${fmtD(o.start)} → ${fmtD(o.end)}</td><td class="num">${expandLines(o.lines)[id]||(o.lines||[]).filter(l=>l.pid===id).reduce((s,l)=>s+num(l.qty),0)}</td><td>${pill(o.status)}</td></tr>`).join('');
  const mnts=sortBy(Object.values(D.maintenance).filter(m=>m.productId===id),m=>m.status==='done'?'1'+(m.start||''):'0'+(m.start||''));
  const usedIn=Object.values(D.products).filter(b=>b.kind==='bundle'&&(b.components||[]).some(c=>c.pid===id));
  let unitsCard='';
  if(p.kind!=='bundle' && p.tracking==='serial'){
    const us=unitsOf(id,true);
    unitsCard=`<div class="card p0"><div class="card-h"><h2>Τεμάχια (${us.filter(u=>u.status!=='retired').length})</h2><div class="row">${us.length?`<button class="btn sm" data-act="u-labels" data-id="${id}">Ετικέτες όλων</button>`:''}${can('staff')?`<button class="btn sm pri" data-act="u-add" data-id="${id}">+ Τεμάχια</button>`:''}</div></div>
    ${us.length?`<div class="tw"><table><thead><tr><th>Κωδικός QR</th><th>Σειριακός</th><th>Κατάσταση</th><th>Θέση</th><th>Αγορά</th><th></th></tr></thead><tbody>${us.map(u=>{ const s=unitState(u); return `<tr style="${u.status==='retired'?'opacity:.55':''}"><td class="mono b">${esc(u.code)}</td><td class="mono">${esc(u.serial||'—')}</td><td>${s.ref&&s.k==='out'?`<a href="#order-${s.ref.id}" style="text-decoration:none">${pill(s.k,{[s.k]:s})}</a>`:pill(s.k,{[s.k]:s})}</td><td class="small">${esc(u.location||p.location||'')}</td><td class="small">${u.purchaseDate?fmtD(u.purchaseDate):''}${u.purchasePrice?' · '+money(u.purchasePrice):''}</td>
      <td class="num" style="white-space:nowrap"><button class="icon" data-act="qr" data-code="${esc(u.code)}" data-name="${esc(p.name)}" data-sub="${esc(u.serial?'S/N '+u.serial:'')}">▣</button>${can('staff')?`<button class="icon" data-act="u-edit" data-id="${u.id}">✎</button>`:''}</td></tr>`; }).join('')}</tbody></table></div>`
    :`<div class="empty" style="padding:26px">Δεν υπάρχουν τεμάχια. Πρόσθεσε τεμάχια με σειριακό αριθμό — το καθένα παίρνει δικό του QR.</div>`}</div>`;
  }
  return `<div class="ohead"><a href="#products" class="btn ghost">←</a>${prodImg(p,52)}<div><h1>${esc(p.name)} ${p.kind==='bundle'?'<span class="tag">Bundle</span>':''}${p.archived?' <span class="pill gray">Αρχειοθετημένο</span>':''}</h1><div class="small muted"><span class="mono">${esc(p.sku)}</span> · ${esc(catPath(p.cat)||'Χωρίς κατηγορία')}</div></div><div class="grow"></div>
    <button class="btn" data-act="qr" data-code="${esc(p.sku)}" data-name="${esc(p.name)}">▣ QR</button>${can('staff')?`<button class="btn" data-act="new-mnt-for" data-id="${id}">🔧 Συντήρηση</button><button class="btn pri" data-act="edit-product" data-id="${id}">✎ Επεξεργασία</button>`:''}</div>
  <div class="grid g4" style="margin-bottom:16px">
    <div class="card stat"><div class="n">${st}</div><div class="l">${p.kind==='bundle'?'Σετ που συντίθενται':'Συνολικό απόθεμα'}</div></div>
    <div class="card stat"><div class="n av ${avCls(fr)}">${fr}</div><div class="l">Διαθέσιμα σήμερα</div></div>
    <div class="card stat"><div class="n">${money(productPrice(p))}</div><div class="l">${p.priceType==='flat'?'Σταθερή τιμή':(productExtra(p)===''?'Τιμή / ημέρα':`1η ημέρα · επόμενες ${money(productExtra(p))}`)}</div></div>
    <div class="card stat"><div class="n">${orders.filter(o=>HOLD.includes(o.status)&&orderRange(o)[1]>=t).length}</div><div class="l">Επόμενες κρατήσεις</div></div>
  </div>
  <div class="split">
    <div class="grid" style="align-content:start">
      <div class="card"><h2>Διαθεσιμότητα 30 ημερών</h2><div class="strip">${strip}</div></div>
      ${unitsCard}
      ${p.kind==='bundle'?`<div class="card p0"><div class="card-h"><h2>Περιεχόμενα bundle</h2></div><table><tbody>${(p.components||[]).map(c=>`<tr><td><a class="lk" href="#product-${c.pid}">${esc(prodName(c.pid))}</a></td><td class="num">×${num(c.qty)}</td><td class="num"><span class="avb ${avCls(freeUnits(c.pid,t,t).free,num(c.qty))}">${freeUnits(c.pid,t,t).free}</span></td></tr>`).join('')}</tbody></table></div>`:''}
      <div class="card p0"><div class="card-h"><h2>Παραγγελίες</h2></div>${ordRows?`<div class="tw"><table><thead><tr><th>Παραγγελία</th><th>Πελάτης</th><th>Περίοδος</th><th class="num">Ποσ.</th><th>Κατάσταση</th></tr></thead><tbody>${ordRows}</tbody></table></div>`:'<div class="empty" style="padding:24px">Καμία πρόσφατη ή επόμενη παραγγελία.</div>'}</div>
      ${p.kind!=='bundle'?`<div class="card p0"><div class="card-h"><h2>Ιστορικό συντήρησης</h2></div>${mnts.length?`<table><tbody>${mnts.map(m=>`<tr class="click" data-act="edit-mnt" data-id="${m.id}"><td><b>${esc(m.title||'Βλάβη')}</b><div class="xs muted">${m.unitId?esc(D.units[m.unitId]?.code||''):(num(m.qty)||1)+' τεμ.'} · ${fmtD(m.start)}${m.end?' → '+fmtD(m.end):''}</div></td><td class="num">${m.cost?money(m.cost):''}</td><td>${pill(m.status,MSTATUS)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty" style="padding:24px">Καμία εγγραφή.</div>'}</div>`:''}
    </div>
    <div class="grid" style="align-content:start">
      ${imgSrc(p)?`<div class="card" style="padding:10px"><img src="${esc(imgSrc(p))}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block" alt=""></div>`:(can('staff')?`<div class="card" style="text-align:center"><div class="muted small" style="margin-bottom:8px">Δεν υπάρχει εικόνα</div><button class="btn sm" data-act="edit-product" data-id="${id}">📷 Προσθήκη εικόνας</button></div>`:'')}
      <div class="card qrbox">${qrSVG(p.sku,180)}<div class="mono">${esc(p.sku)}</div></div>
      <div class="card"><h2>Στοιχεία</h2><dl class="kv">
        <dt>Τύπος</dt><dd>${p.kind==='bundle'?'Bundle':(p.tracking==='serial'?'Σειριακοί αριθμοί':'Ποσότητα')}</dd>
        ${p.kind!=='bundle'&&p.tracking!=='serial'?`<dt>Ποσότητα</dt><dd>${num(p.qty)}</dd>`:''}
        <dt>Θέση</dt><dd>${esc(p.location||'—')}</dd><dt>Προμηθευτής</dt><dd>${esc(p.supplier||'—')}</dd>
        <dt>Αξία αντικατ.</dt><dd>${p.replacement?money(p.replacement):'—'}</dd>
        ${usedIn.length?`<dt>Σε bundles</dt><dd>${usedIn.map(b=>`<a href="#product-${b.id}">${esc(b.name)}</a>`).join(', ')}</dd>`:''}
      </dl>${p.notes?`<hr><div class="small" style="white-space:pre-wrap">${esc(p.notes)}</div>`:''}</div>
    </div>
  </div>`;
};

/* ---------- QR modal ---------- */
ACT['qr']=el=>{ const code=el.dataset.code, name=el.dataset.name||'', sub=el.dataset.sub||'';
  M={type:'qr'};
  openModal(`<div class="dlg-h"><h2>${esc(name)}</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b"><div class="qrbox">${qrSVG(code,240)}<div class="mono" style="font-size:17px">${esc(code)}</div>${sub?`<div class="muted small">${esc(sub)}</div>`:''}</div></div>
  <div class="dlg-f"><button class="btn" data-act="qr-png" data-code="${esc(code)}">Λήψη PNG</button><button class="btn" data-act="qr-print" data-code="${esc(code)}" data-name="${esc(name)}" data-sub="${esc(sub)}">Εκτύπωση ετικέτας</button><button class="btn pri" data-act="modal-close">OK</button></div>`,'sm'); };
ACT['qr-png']=el=>{ const u=qrPNG(el.dataset.code); if(!u) return; download('QR-'+el.dataset.code+'.png', dataURLtoBlob(u)); };
ACT['qr-print']=el=>printLabels([{code:el.dataset.code,name:el.dataset.name,sub:el.dataset.sub}]);
ACT['u-labels']=el=>{ const p=D.products[el.dataset.id]; printLabels(unitsOf(p.id).map(u=>({code:u.code,name:p.name,sub:u.serial?'S/N '+u.serial:''}))); };

/* ---------- product modal ---------- */
function catOptions(sel, none='— Χωρίς —', exclude){ return `<option value="">${none}</option>`+catsSorted().filter(c=>!exclude||!exclude.has(c.id)).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.path)}</option>`).join(''); }
/* ---------- αυτόματες προτάσεις φωτογραφιών ---------- */
function suggHTML(){
  const p=M&&M.p; if(!p) return '';
  if(p._suggBusy) return `<div class="isugg"><div class="isugg-h">Ψάχνω φωτογραφίες για «${esc(p._suggQ)}»…</div><div class="isugg-row">${'<span class="isugg-ph"></span>'.repeat(5)}</div></div>`;
  if(!p._sugg) return '';
  if(!p._sugg.length) return `<div class="isugg"><div class="isugg-h">Δεν βρέθηκαν αυτόματα φωτογραφίες για «${esc(p._suggQ)}».</div><div class="isugg-alt"><a class="btn sm" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p._suggQ)}" target="_blank" rel="noopener">🔎 Άνοιγμα στο Google Εικόνες</a><button class="btn sm ghost" data-act="pm-sugg-find">↻ Ξανά</button><span class="xs muted">Δεξί κλικ σε μια εικόνα → «Αντιγραφή εικόνας» (ή «Αντιγραφή διεύθυνσης εικόνας») και πάτα <b>⌘V / Ctrl+V</b> εδώ.</span></div></div>`;
  const page=p._suggPage||0, list=p._sugg.slice(page*5,page*5+5);
  return `<div class="isugg"><div class="isugg-h"><span>Προτάσεις για «${esc(p._suggQ)}» — κλικ για επιλογή</span>${p._sugg.length>5?`<button class="btn sm ghost" data-act="pm-sugg-more">Άλλες ↻</button>`:''}</div>
    <div class="isugg-row">${list.map((h,i)=>`<button class="isugg-it${p._suggPick===page*5+i?' busy':''}" data-act="pm-sugg-pick" data-i="${page*5+i}" title="${esc(h.title||'')}"><img src="${esc(h.thumb||h.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('button').style.display='none'"></button>`).join('')}</div></div>`;
}
function drawSugg(){ const el=$('#imgSugg'); if(el) el.innerHTML=suggHTML(); }
async function findPhotos(force){
  if(!SERVER||!M||M.type!=='product') return; const p=M.p, q=(p.name||'').trim();
  if(q.length<3) return force?toast('Γράψε πρώτα το όνομα του προϊόντος.', true):null;
  if(!force&&q===p._suggQ) return;
  p._suggQ=q; p._suggBusy=true; p._sugg=null; p._suggPage=0; drawSugg();
  try{ const r=await api('/api/imgsearch?q='+encodeURIComponent(q)); if(M&&M.p===p&&p._suggQ===q){ p._sugg=r.results||[]; if(!p._imgTitle&&p._sugg.length){ p._imgTitle=p._sugg.slice(0,3).map(x=>x.title||'').join(' '); autoCategorize(false); } } }
  catch(e){ if(M&&M.p===p) p._sugg=[]; }
  if(M&&M.p===p&&p._suggQ===q){ p._suggBusy=false; drawSugg(); }
}
let suggTimer=null;
ON_INPUT.push(el=>{ if(el.dataset.pm==='name'&&M&&M.type==='product'&&!imgSrc(M.p)){ clearTimeout(suggTimer); suggTimer=setTimeout(()=>findPhotos(false), 900); } return false; });
ACT['pm-sugg-find']=()=>findPhotos(true);
ACT['pm-sugg-more']=()=>{ const p=M.p; p._suggPage=((p._suggPage||0)+1)%Math.ceil(p._sugg.length/5); drawSugg(); };
ACT['pm-sugg-pick']=async el=>{
  const p=M.p, h=p._sugg&&p._sugg[+el.dataset.i]; if(!h||p._imgBusy) return;
  p._suggPick=+el.dataset.i; drawSugg();
  let blob=null;
  for(const u of [h.image,h.thumb].filter(Boolean)){
    try{ const r=await fetch('/api/imgfetch?url='+encodeURIComponent(u),{credentials:'same-origin'}); if(r.ok){ const b=await r.blob(); if(/^image\//.test(b.type)){ blob=b; break; } } }catch(e){}
  }
  p._suggPick=null;
  if(!blob){ drawSugg(); return toast('Αυτή η φωτογραφία δεν κατέβηκε — διάλεξε άλλη.', true); }
  p._imgTitle=h.title||''; await setProductImage(blob, 'contain'); autoCategorize(false);
};

function productModal(id, kind){
  const p = id ? deepCopy(D.products[id]) : {id:null, kind:kind||'item', tracking:'bulk', name:'', sku:'', cat:(UI.prodCat&&D.categories[UI.prodCat])?UI.prodCat:'', qty:1, price:'', priceType:'day', extraMode:'pct', extraValue:10, replacement:'', location:'', supplier:'', notes:'', components:[], _units:1};
  p.components=p.components||[];
  M={type:'product', p, redraw:drawProductModal}; drawProductModal();
  if(SERVER&&!imgSrc(p)&&(p.name||'').trim().length>=3) findPhotos(false);
}
function drawProductModal(){
  const p=M.p, isB=p.kind==='bundle';
  const opts=sel=>prodsSorted(Object.values(D.products).filter(x=>x.kind!=='bundle'&&x.id!==p.id&&!x.archived)).map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)} · ${esc(x.sku)}</option>`).join('');
  openModal(`<div class="dlg-h"><h2>${p.id?'Επεξεργασία':'Νέο'} ${isB?'bundle':'προϊόν'}</h2><button class="icon" data-act="modal-close">✕</button></div>
  <div class="dlg-b">
    ${!p.id?`<div class="seg"><button class="${!isB?'on':''}" data-act="pm-set" data-k="kind" data-v="item">Προϊόν</button><button class="${isB?'on':''}" data-act="pm-set" data-k="kind" data-v="bundle">Bundle (σετ προϊόντων)</button></div>`:''}
    <div class="row" style="align-items:flex-start;gap:16px;flex-wrap:nowrap">
      <div class="imgdrop" id="imgDrop" data-act="pm-img-pick" title="Κλικ για αρχείο ή σύρε εικόνα εδώ">${p._imgBusy?'Επεξεργασία…':(imgSrc(p)?`<img src="${esc(imgSrc(p))}" alt="">`:'📷<br>Εικόνα<br>προϊόντος')}</div>
      <div class="grid" style="gap:8px;flex:1">
        ${SERVER?`<button class="btn" data-act="pm-sugg-find">🔍 Βρες φωτογραφίες αυτόματα</button>`:''}
        <a class="btn sm ghost" id="gimgLink" target="_blank" rel="noopener" href="${esc(googleImgUrl(p.name))}" title="Δεξί κλικ σε εικόνα → «Αντιγραφή εικόνας» και εδώ Ctrl+V / Cmd+V">Άνοιγμα Google Images ↗</a>
        <div class="row"><button class="btn sm" data-act="pm-img-pick">⬆ Αρχείο / κάμερα</button>${imgSrc(p)?'<button class="btn sm dangerous" data-act="pm-img-del">Αφαίρεση</button>':''}</div>
      </div>
    </div>
    ${SERVER?`<div id="imgSugg">${suggHTML()}</div>`:''}
    <div class="f2"><label class="f">Όνομα *<input type="text" data-pm="name" value="${esc(p.name)}" autofocus placeholder="${isB?'π.χ. Σετ ήχου για 100 άτομα':'π.χ. Shure SM58'}"></label><label class="f">Κωδικός (QR) *<input type="text" data-pm="sku" value="${esc(p.sku)}" class="mono" placeholder="Βγαίνει από το όνομα"></label></div>
    <label class="f">Κατηγορία<select data-pm="cat">${catOptions(p.cat)}</select><div id="catHint" class="cat-hint">${catHintHTML()}</div></label>
    ${!isB?`<div><div class="small muted b" style="margin-bottom:6px">Παρακολούθηση αποθέματος</div><div class="seg"><button class="${p.tracking!=='serial'?'on':''}" data-act="pm-set" data-k="tracking" data-v="bulk">Ποσότητα (π.χ. καλώδια)</button><button class="${p.tracking==='serial'?'on':''}" data-act="pm-set" data-k="tracking" data-v="serial">Σειριακοί αριθμοί (κάθε τεμάχιο με QR)</button></div></div>`:''}
    <div class="f3">
      ${!isB&&p.tracking!=='serial'?`<label class="f">Ποσότητα *<input type="number" min="0" step="1" data-pm="qty" value="${esc(p.qty)}"></label>`:''}
      ${!isB&&p.tracking==='serial'&&!p.id?`<label class="f">Αρχικά τεμάχια<input type="number" min="0" step="1" data-pm="_units" value="${esc(p._units)}"></label>`:''}
      <label class="f pr">Τιμή (€, χωρίς ΦΠΑ)<input type="number" min="0" step="0.01" data-pm="price" value="${esc(p.price)}" placeholder="${isB?'Κενό = άθροισμα':''}"></label>
      <label class="f pr">Χρέωση<select data-pm="priceType" data-redraw="1"><option value="day" ${p.priceType!=='flat'?'selected':''}>Ανά ημέρα</option><option value="flat" ${p.priceType==='flat'?'selected':''}>Σταθερή (ανά ενοικίαση)</option></select></label>
      ${!isB?`<label class="f pr">Αξία αντικατάστασης €<input type="number" min="0" step="0.01" data-pm="replacement" value="${esc(p.replacement)}"></label>`:''}
    </div>
    ${p.priceType!=='flat'?`<div class="card pr" style="padding:12px 14px;background:#fafbfc"><div class="small b" style="margin-bottom:8px">Χρέωση επόμενων ημερών</div>
      <div class="f3"><label class="f">Από τη 2η ημέρα και μετά<select data-pm="extraMode" data-redraw="1"><option value="same" ${!p.extraMode||p.extraMode==='same'?'selected':''}>Ίδια τιμή με την 1η</option><option value="amount" ${p.extraMode==='amount'?'selected':''}>Άλλη τιμή (€ / ημέρα)</option><option value="pct" ${p.extraMode==='pct'?'selected':''}>Ποσοστό της 1ης (%)</option></select></label>
      ${p.extraMode==='amount'||p.extraMode==='pct'?`<label class="f">${p.extraMode==='pct'?'% της τιμής 1ης ημέρας':'€ ανά επόμενη ημέρα'}<input type="number" min="0" step="0.01" data-pm="extraValue" data-redraw-change="1" value="${esc(p.extraValue??'')}" placeholder="${p.extraMode==='pct'?'π.χ. 50':'π.χ. 10'}"></label>`:'<div></div>'}
      <div class="small muted" style="align-self:end;padding-bottom:6px">${extraPreview(p)}</div></div></div>`:''}
    <div class="f2"><label class="f">Θέση στην αποθήκη<input type="text" data-pm="location" value="${esc(p.location)}" placeholder="π.χ. Ράφι Β3"></label>${!isB?`<label class="f">Προμηθευτής<input type="text" data-pm="supplier" value="${esc(p.supplier)}"></label>`:''}</div>
    ${isB?`<div><div class="row between" style="margin-bottom:8px"><b>Περιεχόμενα</b><button class="btn sm" data-act="pm-comp-add">+ Προϊόν</button></div><div class="grid" style="gap:8px">${p.components.length?p.components.map((c,i)=>`<div class="comp-row"><select data-pmc="${i}" data-f="pid"><option value="">— Επίλεξε —</option>${opts(c.pid)}</select><input type="number" min="1" step="1" data-pmc="${i}" data-f="qty" value="${esc(c.qty)}"><button class="icon" data-act="pm-comp-del" data-i="${i}">✕</button></div>`).join(''):'<div class="small muted">Η διαθεσιμότητα του bundle υπολογίζεται αυτόματα από τα περιεχόμενά του.</div>'}</div></div>`:''}
    <label class="f">Σημειώσεις<textarea data-pm="notes">${esc(p.notes)}</textarea></label>
  </div>
  <div class="dlg-f">${p.id?`<button class="btn dangerous" data-act="pm-del" style="margin-right:auto">Διαγραφή</button><button class="btn" data-act="pm-archive">${p.archived?'Επαναφορά':'Αρχειοθέτηση'}</button>`:''}<button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="pm-save" data-primary>Αποθήκευση</button></div>`);
}
ON_INPUT.push(el=>{ if(!M) return false;
  if(el.dataset.pm!==undefined && M.type==='product'){ const p=M.p; p[el.dataset.pm]=el.value;
    if(el.dataset.pm==='sku') p._skuManual=el.value.trim()!=='';
    if(el.dataset.pm==='name' && !p.id && !p._skuManual){ p.sku=skuFromName(el.value); const si=$('input[data-pm=sku]'); if(si) si.value=p.sku; }
    return true; }
  if(el.dataset.pmc!==undefined){ M.p.components[+el.dataset.pmc][el.dataset.f]=el.value; return true; }
  return false; });
ON_CHANGE.push(el=>{ if(!M) return false;
  if(el.dataset.pm!==undefined && M.type==='product'){ M.p[el.dataset.pm]=el.value; if(el.dataset.redraw||el.dataset.redrawChange) drawProductModal(); return true; }
  if(el.dataset.pmc!==undefined){ M.p.components[+el.dataset.pmc][el.dataset.f]=el.value; return true; }
  return false; });
ACT['new-product']=()=>productModal(null,'item');
ACT['new-bundle']=()=>productModal(null,'bundle');
ACT['edit-product']=el=>productModal(el.dataset.id);
ACT['pm-set']=el=>{ M.p[el.dataset.k]=el.dataset.v; drawProductModal(); };
ACT['pm-comp-add']=()=>{ M.p.components.push({pid:'',qty:1}); drawProductModal(); };
ACT['pm-comp-del']=el=>{ M.p.components.splice(+el.dataset.i,1); drawProductModal(); };
ACT['pm-save']=async()=>{
  const p=M.p; p.name=(p.name||'').trim(); p.sku=(p.sku||'').trim(); if(!p.sku) p.sku=skuFromName(p.name,p.id)||nextSku();
  if(!p.name) return toast('Συμπλήρωσε όνομα.', true); if(!p.sku) return toast('Συμπλήρωσε κωδικό.', true);
  const dupP=Object.values(D.products).find(x=>x.id!==p.id&&(x.sku||'').toLowerCase()===p.sku.toLowerCase());
  const dupU=Object.values(D.units).find(u=>(u.code||'').toLowerCase()===p.sku.toLowerCase());
  if(dupP||dupU) return toast(`Ο κωδικός ${p.sku} χρησιμοποιείται ήδη.`, true);
  const doc={kind:p.kind, name:p.name, sku:p.sku, image:p.image||'', imageUrl:p.imageUrl||'', cat:p.cat||'', price:p.price===''||p.price==null?(p.kind==='bundle'?'':0):num(p.price), priceType:p.priceType||'day', extraMode:p.priceType==='flat'?'same':(p.extraMode||'same'), extraValue:(p.extraMode==='amount'||p.extraMode==='pct')&&p.extraValue!==''&&p.extraValue!=null?num(p.extraValue):'', location:p.location||'', notes:p.notes||'', archived:!!p.archived};
  if(p.kind==='bundle'){ doc.components=p.components.filter(c=>c.pid&&num(c.qty)>0).map(c=>({pid:c.pid,qty:Math.round(num(c.qty))})); if(!doc.components.length) return toast('Το bundle χρειάζεται τουλάχιστον ένα προϊόν.', true); }
  else { doc.tracking=p.tracking||'bulk'; doc.qty=Math.max(0,Math.round(num(p.qty))); doc.replacement=num(p.replacement)||''; doc.supplier=p.supplier||''; }
  const id=p.id||uid('pr'); const ops=[{op:'put',coll:'products',id,doc}];
  if(!p.id && doc.tracking==='serial'){ const n=Math.min(500,Math.max(0,Math.round(num(p._units)))); for(let i=0;i<n;i++) ops.push({op:'put',coll:'units',id:uid('un'),doc:{productId:id, code:doc.sku+'-'+String(i+1).padStart(3,'0'), serial:'', status:'active', location:'', notes:''}}); }
  if(await commit(ops, p.id?'Αποθηκεύτηκε το '+doc.name:'Προστέθηκε το '+doc.name)){ closeModal(); if(!p.id && route()!=='products') location.hash='product-'+id; }
};
ACT['pm-archive']=async()=>{ const p=M.p; const d=strip(D.products[p.id]); d.archived=!d.archived; if(await put('products',p.id,d,d.archived?'Αρχειοθετήθηκε':'Επαναφέρθηκε')) closeModal(); };
ACT['pm-del']=()=>{ const p=M.p;
  const inOrd=Object.values(D.orders).filter(o=>(o.lines||[]).some(l=>l.pid===p.id)).length;
  const inB=Object.values(D.products).filter(b=>b.kind==='bundle'&&(b.components||[]).some(c=>c.pid===p.id)).length;
  const us=Object.values(D.units).filter(u=>u.productId===p.id);
  confirmBox(`Διαγραφή «${p.name}»;`, inOrd||inB?`Χρησιμοποιείται σε ${inOrd} παραγγελίες και ${inB} bundles — προτείνεται «Αρχειοθέτηση» αντί για διαγραφή.`:`Θα διαγραφούν και ${us.length} τεμάχια. Η ενέργεια δεν αναιρείται.`, 'Διαγραφή',
    async()=>{ const ops=[{op:'del',coll:'products',id:p.id}, ...us.map(u=>({op:'del',coll:'units',id:u.id}))]; if(await commit(ops,'Διαγράφηκε το '+p.name)){ UI.prodSel.delete(p.id); if(route().startsWith('product-')) location.hash='products'; } else return false; }); };

/* ---------- units ---------- */
ACT['u-add']=el=>{ const p=D.products[el.dataset.id]; M={type:'uadd', pid:p.id};
  openModal(`<div class="dlg-h"><h2>Νέα τεμάχια · ${esc(p.name)}</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <div class="small muted">Γράψε έναν σειριακό αριθμό ανά γραμμή (ή σκάναρε τους με barcode scanner), ή απλά όρισε πλήθος. Ο κωδικός QR δημιουργείται αυτόματα (${esc(nextUnitCode(p))}…).</div>
  <label class="f">Σειριακοί αριθμοί<textarea id="uSerials" rows="6" placeholder="SN123456&#10;SN123457" autofocus></textarea></label>
  <div class="f3"><label class="f">ή πλήθος χωρίς σειριακό<input type="number" id="uCount" min="0" value="0"></label><label class="f">Ημ. αγοράς<input type="date" id="uDate"></label><label class="f">Τιμή αγοράς €<input type="number" id="uPrice" min="0" step="0.01"></label></div></div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="u-add-go">Προσθήκη</button></div>`); };
ACT['u-add-go']=async()=>{ const p=D.products[M.pid]; const serials=$('#uSerials').value.split('\n').map(s=>s.trim()).filter(Boolean); const n=Math.round(num($('#uCount').value));
  const dup=serials.find(s=>Object.values(D.units).some(u=>(u.serial||'').toLowerCase()===s.toLowerCase())); if(dup) return toast('Ο σειριακός '+dup+' υπάρχει ήδη.', true);
  const list=[...serials.map(s=>({serial:s})), ...[...Array(Math.max(0,n))].map(()=>({serial:''}))]; if(!list.length) return toast('Δεν δόθηκαν τεμάχια.', true);
  const ops=list.map((x,i)=>({op:'put',coll:'units',id:uid('un'),doc:{productId:p.id, code:nextUnitCode(p,i), serial:x.serial, status:'active', location:'', purchaseDate:$('#uDate').value||'', purchasePrice:num($('#uPrice').value)||'', notes:''}}));
  if(await commit(ops, `Προστέθηκαν ${ops.length} τεμάχια`)) closeModal(); };
ACT['u-edit']=el=>{ const u=deepCopy(D.units[el.dataset.id]); M={type:'unit', u};
  openModal(`<div class="dlg-h"><h2>Τεμάχιο ${esc(u.code)}</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <div class="f2"><label class="f">Κωδικός QR<input type="text" data-um="code" value="${esc(u.code)}" class="mono"></label><label class="f">Σειριακός αριθμός<input type="text" data-um="serial" value="${esc(u.serial)}" class="mono"></label></div>
  <div class="f3"><label class="f">Θέση<input type="text" data-um="location" value="${esc(u.location)}"></label><label class="f">Ημ. αγοράς<input type="date" data-um="purchaseDate" value="${esc(u.purchaseDate)}"></label><label class="f">Τιμή αγοράς €<input type="number" data-um="purchasePrice" value="${esc(u.purchasePrice)}"></label></div>
  <label class="f">Κατάσταση<select data-um="status"><option value="active" ${u.status!=='retired'?'selected':''}>Ενεργό</option><option value="retired" ${u.status==='retired'?'selected':''}>Αποσύρθηκε (πουλήθηκε / χάθηκε / κατεστράφη)</option></select></label>
  <label class="f">Σημειώσεις<textarea data-um="notes">${esc(u.notes)}</textarea></label></div>
  <div class="dlg-f"><button class="btn dangerous" data-act="u-del" style="margin-right:auto">Διαγραφή</button><button class="btn" data-act="u-mnt">🔧 Συντήρηση</button><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="u-save" data-primary>Αποθήκευση</button></div>`); };
ON_INPUT.push(el=>{ if(el.dataset.um!==undefined&&M&&M.type==='unit'){ M.u[el.dataset.um]=el.value; return true; } return false; });
ON_CHANGE.push(el=>{ if(el.dataset.um!==undefined&&M&&M.type==='unit'){ M.u[el.dataset.um]=el.value; return true; } return false; });
ACT['u-save']=async()=>{ const u=M.u; u.code=(u.code||'').trim(); if(!u.code) return toast('Ο κωδικός είναι υποχρεωτικός.', true);
  if(Object.values(D.units).some(x=>x.id!==u.id&&(x.code||'').toLowerCase()===u.code.toLowerCase()) || Object.values(D.products).some(p=>(p.sku||'').toLowerCase()===u.code.toLowerCase())) return toast('Ο κωδικός υπάρχει ήδη.', true);
  if(await put('units',u.id,strip(u),'Αποθηκεύτηκε το '+u.code)) closeModal(); };
ACT['u-del']=()=>{ const u=M.u; const used=Object.values(D.orders).some(o=>(o.picked?.units||[]).includes(u.id)); confirmBox(`Διαγραφή ${u.code};`, used?'Το τεμάχιο υπάρχει στο ιστορικό παραγγελιών — προτείνεται «Αποσύρθηκε» αντί για διαγραφή.':'Η ενέργεια δεν αναιρείται.', 'Διαγραφή', async()=>{ await del('units',u.id,'Διαγράφηκε το '+u.code); }); };
ACT['u-mnt']=()=>{ const u=M.u; closeModal(); maintenanceModal(null,{productId:u.productId, unitId:u.id, start:today()}); };
ACT['new-mnt-for']=el=>maintenanceModal(null,{productId:el.dataset.id, start:today()});

/* ---------- categories ---------- */
/* κατηγορίες στο κινητό: οριζόντια κουμπάκια (κύριες) + υποκατηγορίες */
function catShort(n){ return String(n||'').replace(/^\s*\d+\.\s*/,''); }
function catCount(id){ const set=catDesc(id); let n=0; for(const p of Object.values(D.products)) if(!p.archived&&set.has(p.cat)) n++; return n; }
function mcatChips(all, noCat){
  const cats=Object.values(D.categories); const mains=sortBy(cats.filter(c=>!c.parent||!D.categories[c.parent]),c=>c.name);
  const sel=UI.prodCat; let main=null; if(sel&&D.categories[sel]){ main=D.categories[sel]; while(main.parent&&D.categories[main.parent]) main=D.categories[main.parent]; }
  const chip=(v,l,n,on)=>`<button type="button" class="mchip${on?' on':''}" data-act="tab" data-k="prodCat" data-v="${v}">${esc(l)}<span>${n}</span></button>`;
  const row1=chip('all','Όλα',all,sel==='all'||!sel)+mains.map(c=>chip(c.id,catShort(c.name),catCount(c.id),main&&main.id===c.id)).join('')+(noCat?chip('none','Χωρίς κατηγορία',noCat,sel==='none'):'');
  let row2=''; if(main){ const subs=sortBy(cats.filter(c=>c.parent===main.id),c=>c.name); if(subs.length) row2=`<div class="mchips sub">${chip(main.id,'Όλα · '+catShort(main.name),catCount(main.id),sel===main.id)}${subs.map(c=>chip(c.id,catShort(c.name),catCount(c.id),sel===c.id)).join('')}</div>`; }
  return `<div class="mcatw"><div class="mchips">${row1}</div>${row2}</div>`;
}
VIEWS.categories = () => {
  const cats=Object.values(D.categories); const st=can('staff');
  const mains=sortBy(cats.filter(c=>!c.parent||!D.categories[c.parent]),c=>c.name);
  const acts=c=>st?`<span class="catacts"><button class="icon sm" data-act="cat-edit" data-id="${c.id}" title="Μετονομασία">✎</button><button class="icon sm" data-act="cat-del" data-id="${c.id}" title="Διαγραφή">✕</button></span>`:'';
  const subTree=(parent,depth)=>depth>8?'':sortBy(cats.filter(c=>c.parent===parent),c=>c.name).map(c=>`<div class="catrow" style="padding-left:${14+depth*16}px"><a class="catname" href="#products" data-act="cat-open" data-id="${c.id}">${esc(catShort(c.name))}</a><span class="catn">${catCount(c.id)}</span>${acts(c)}</div>`+subTree(c.id,depth+1)).join('');
  const groups=mains.map(c=>`<div class="card catgrp"><div class="catgh"><a class="catname main" href="#products" data-act="cat-open" data-id="${c.id}">${esc(c.name)}</a><span class="catn">${catCount(c.id)} προϊόντα</span>${acts(c)}</div>
      ${subTree(c.id,0)}${st?`<button class="catadd" data-act="cat-add" data-parent="${c.id}">+ Υποκατηγορία</button>`:''}</div>`).join('');
  return `<div class="ph"><div><h1>Κατηγορίες</h1><p class="sub">Κύριες κατηγορίες και υποκατηγορίες εξοπλισμού</p></div>${st?`<button class="btn pri" data-act="cat-add" data-parent="">+ Νέα κατηγορία</button>`:''}</div>
  ${mains.length?`<div class="catgrid">${groups}</div>`:'<div class="card empty"><b>Δεν υπάρχουν κατηγορίες</b>Ξεκίνα με κύριες κατηγορίες: Ήχος, Φωτισμός, Video, Καλώδια, Ρεύμα, Truss.</div>'}`;
};
ACT['cat-open']=(el,e)=>{ if(e) e.preventDefault(); UI.prodCat=el.dataset.id; UI.mProdN=60; location.hash='products'; };
function catModal(id, parent){ const c=id?{...D.categories[id]}:{id:null,name:'',parent:parent||''}; M={type:'cat',c};
  openModal(`<div class="dlg-h"><h2>${id?'Επεξεργασία':'Νέα'} κατηγορία</h2><button class="icon" data-act="modal-close">✕</button></div><div class="dlg-b">
  <label class="f">Όνομα<input type="text" id="catName" value="${esc(c.name)}" autofocus></label><label class="f">Γονική κατηγορία<select id="catParent">${catOptions(c.parent,'— Κύρια κατηγορία —',id?catDesc(id):null)}</select></label></div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="cat-save" data-primary>Αποθήκευση</button></div>`,'sm'); }
ACT['cat-add']=el=>catModal(null, el.dataset.parent);
ACT['cat-edit']=el=>catModal(el.dataset.id);
ACT['cat-save']=async()=>{ const name=$('#catName').value.trim(); if(!name) return toast('Δώσε όνομα.', true); const id=M.c.id||uid('ct'); if(await put('categories',id,{name,parent:$('#catParent').value},'Αποθηκεύτηκε η κατηγορία')) closeModal(); };
ACT['cat-del']=el=>{ const id=el.dataset.id, c=D.categories[id]; if(Object.values(D.categories).some(x=>x.parent===id)) return toast('Έχει υποκατηγορίες — διάγραψέ τες πρώτα.', true);
  const n=Object.values(D.products).filter(p=>p.cat===id).length; confirmBox(`Διαγραφή «${c.name}»;`, n?`${n} προϊόντα θα μείνουν χωρίς κατηγορία.`:'Η κατηγορία είναι κενή.', 'Διαγραφή', async()=>{ await del('categories',id,'Διαγράφηκε η κατηγορία'); }); };

/* ---------- product image: paste / drop / file ---------- */
function googleImgUrl(name){ return 'https://www.google.com/search?tbm=isch&q='+encodeURIComponent((name||'').trim()||'rental equipment'); }
async function setProductImage(blob, fit){
  if(!M||M.type!=='product') return;
  if(!blob||!/^image\//.test(blob.type)) return toast('Δεν βρέθηκε εικόνα.', true);
  M.p._imgBusy=true; drawProductModal();
  try{ const sq=await squareImage(blob, 600, fit||'cover'); const url=await storeImage(sq); if(M&&M.type==='product'){ M.p.image=url; } toast('Η εικόνα προστέθηκε'); }
  catch(e){ toast(e.error||e.message||'Η εικόνα δεν αποθηκεύτηκε', true); }
  if(M&&M.type==='product'){ M.p._imgBusy=false; drawProductModal(); }
}
ACT['pm-img-pick']=()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=()=>{ if(inp.files[0]) setProductImage(inp.files[0]); }; inp.click(); };
ACT['pm-img-del']=()=>{ M.p.image=''; M.p.imageUrl=''; drawProductModal(); };
document.addEventListener('paste', async e=>{ if(!M||M.type!=='product') return; const items=[...(e.clipboardData?.items||[])]; const it=items.find(i=>i.kind==='file'&&/^image\//.test(i.type));
  if(it){ e.preventDefault(); setProductImage(it.getAsFile()); return; }
  // επικόλληση διεύθυνσης εικόνας (όχι μέσα σε πεδίο κειμένου)
  const txt=(e.clipboardData?.getData('text')||'').trim(); const tag=(e.target&&e.target.tagName)||'';
  if(!/^https?:\/\/\S+$/.test(txt) || ((tag==='INPUT'||tag==='TEXTAREA') && !/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(txt))) return;
  e.preventDefault();
  try{ const r=await fetch('/api/imgfetch?url='+encodeURIComponent(txt),{credentials:'same-origin'}); const b=r.ok?await r.blob():null; if(b&&/^image\//.test(b.type)){ await setProductImage(b,'contain'); toast('Η φωτογραφία μπήκε'); } else toast('Η διεύθυνση δεν είναι εικόνα — δοκίμασε «Αντιγραφή εικόνας».', true); }catch(err){ toast('Η φωτογραφία δεν κατέβηκε', true); } });
document.addEventListener('dragover', e=>{ const z=e.target.closest&&e.target.closest('#imgDrop'); if(z){ e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e=>{ const z=e.target.closest&&e.target.closest('#imgDrop'); if(z) z.classList.remove('over'); });
document.addEventListener('drop', e=>{ const z=e.target.closest&&e.target.closest('#imgDrop'); if(!z) return; e.preventDefault(); z.classList.remove('over'); const f=[...(e.dataTransfer?.files||[])].find(f=>/^image\//.test(f.type)); if(f) setProductImage(f); else toast('Σύρε ένα αρχείο εικόνας (ή αντέγραψε την εικόνα και πάτα Ctrl+V).', true); });
ON_INPUT.push(el=>{ if(el.dataset.pm==='name'){ const a=$('#gimgLink'); if(a) a.href=googleImgUrl(el.value); } return false; });

function extraPreview(p){ const tmp={...p, price:p.price===''?'':num(p.price), extraValue:p.extraValue===''?'':num(p.extraValue)}; const pr=productPrice(tmp); if(!pr) return ''; const ex=productExtra(tmp); const e=ex===''?pr:ex; return `Παράδειγμα: 1 ημ. ${money(pr)} · 3 ημ. ${money(pr+2*e)} · 7 ημ. ${money(pr+6*e)}`; }
ON_CHANGE.push(el=>{ if(M&&M.type==='product'&&(el.dataset.redraw||el.dataset.redrawChange)){ M.p[el.dataset.pm]=el.value; drawProductModal(); return true; } return false; });
ON_CHANGE.push(el=>{ if(el.dataset.mcat){ UI.prodCat=el.value; UI.mProdN=60; render(); return true; } return false; });

/* γρήγορη αλλαγή τιμής / αποθέματος από τη λίστα */
async function quickSave(el){
  const p=D.products[el.dataset.id]; if(!p) return; const f=el.dataset.qe; const raw=el.value.trim();
  let v; if(f==='price'){ if(raw===''&&p.kind==='bundle') v=''; else v=Math.max(0, r2(num(raw))); } else v=Math.max(0, Math.round(num(raw)));
  if(String(v)===String(p[f]??(f==='price'?'':0))) return;
  const {id,...doc}=p; doc[f]=v; el.classList.add('saving');
  const ok=await put('products', p.id, doc, `${f==='price'?'Τιμή':'Απόθεμα'}: ${p.name} → ${f==='price'?(v===''?'αυτόματα':money(v)):v}`);
  el.classList.remove('saving'); if(ok){ el.classList.add('saved'); setTimeout(()=>el.classList.remove('saved'),900); }
}
ON_CHANGE.unshift(el=>{ if(el.dataset.qe){ quickSave(el); return true; } return false; });
document.addEventListener('keydown', e=>{ const el=e.target; if(!el.dataset||!el.dataset.qe) return;
  if(e.key==='Enter'){ e.preventDefault(); el.blur(); }
  else if(e.key==='Escape'){ const p=D.products[el.dataset.id]; el.value=p?(p[el.dataset.qe]??''):''; el.blur(); }
});
document.addEventListener('focusin', e=>{ const el=e.target; if(el.dataset&&el.dataset.qe){ el._jf=true; try{ el.select(); }catch(_){} } });
document.addEventListener('mouseup', e=>{ const el=e.target; if(el.dataset&&el.dataset.qe&&el._jf){ e.preventDefault(); el._jf=false; try{ el.select(); }catch(_){} } });
document.addEventListener('touchend', e=>{ const el=e.target; if(el.dataset&&el.dataset.qe&&el._jf){ el._jf=false; setTimeout(()=>{ try{ el.select(); }catch(_){} },30); } }, {passive:true});

/* δέντρο κατηγοριών: κλικ σε κατηγορία = φιλτράρισμα + άνοιγμα/κλείσιμο υποκατηγοριών */
ACT['cat-tog']=el=>{ const id=el.dataset.v; const kids=Object.values(D.categories).some(x=>x.parent===id);
  if(kids){ if(UI.catOpen.has(id)) UI.catOpen.delete(id); else UI.catOpen.add(id); }
  UI.prodCat=id; UI.mProdN=60; render(); };
