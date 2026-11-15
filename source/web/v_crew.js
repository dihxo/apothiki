/* ===================== ΣΥΝΕΡΓΕΙΟ: άτομα, πρόγραμμα, αναθέσεις σε παραγγελίες ===================== */
UI.crewTab = UI.crewTab || 'people';
UI.crewType = UI.crewType || 'all';
UI.crewQ = UI.crewQ || '';

function crewAge(b){ const d=new Date(b+'T00:00:00'), n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--; return a; }
function crewName(id){ const c=D.crew[id]; return c ? c.name : '—'; }
function crewSorted(list){ return sortBy(list||Object.values(D.crew), c=>(c.type==='freelance'?'1':'0')+(c.name||'')); }
function crewAv(c, size=34){ const n=c&&c.name||'?'; return `<span class="cav" style="background:${c&&c.color||avColor(n)};width:${size}px;height:${size}px;margin:0;flex:none">${esc(initials(n))}</span>`; }
function crewTypeTag(c){ return c.type==='freelance' ? '<span class="tag">Εξωτερικός</span>' : '<span class="tag crew-staff">Μόνιμος</span>'; }
function rateLabel(v, basis){ return num(v) ? `${money(num(v))} ${basis==='hour'?'/ώρα':(basis==='flat'?'κατ\' αποκοπή':'/ημέρα')}` : '—'; }

/* ---------- σελίδα ---------- */
VIEWS.crew = () => {
  const tabs=`<div class="tabs">${[['people','Άτομα'],['schedule','Πρόγραμμα']].map(([k,l])=>`<button class="${UI.crewTab===k?'on':''}" data-act="tab" data-k="crewTab" data-v="${k}">${l}</button>`).join('')}</div>`;
  const head=`<div class="ph"><div><h1>Συνεργείο</h1><p class="sub">Μόνιμο προσωπικό, εξωτερικοί συνεργάτες και πρόγραμμα εργασιών</p></div><div class="row">${can('staff')?`<button class="btn keep-m" data-act="crew-link">🔗 Σύνδεσμος για το προσωπικό</button><button class="btn pri" data-act="crew-new">+ Νέο άτομο</button>`:''}</div></div>`;
  return head+tabs+(UI.crewTab==='schedule'?crewSchedule():crewPeople());
};
function crewPeople(){
  const t=today(); const all=Object.values(D.crew);
  let list=all.filter(c=>UI.crewType==='all'?!c.inactive:(UI.crewType==='inactive'?c.inactive:(!c.inactive&&(c.type||'staff')===UI.crewType)));
  const q=UI.crewQ.trim().toLowerCase(); if(q) list=list.filter(c=>[c.name,c.role,c.phone,c.email,c.notes,c.idNumber].some(v=>(v||'').toLowerCase().includes(q)));
  list=crewSorted(list);
  const next={}; for(const o of Object.values(D.orders)){ if(!CREW_ST.includes(o.status)) continue; for(const a of o.crew||[]){ if((a.end||a.start)<t) continue; const n=next[a.cid]; if(!n||a.start<n.a.start) next[a.cid]={a,o}; } }
  const busyToday=c=>crewBusy(c.id,t,t).length>0;
  const cnt={all:all.filter(c=>!c.inactive).length, staff:all.filter(c=>!c.inactive&&(c.type||'staff')==='staff').length, freelance:all.filter(c=>!c.inactive&&c.type==='freelance').length, inactive:all.filter(c=>c.inactive).length};
  const seg=`<div class="seg" style="margin:0 0 12px">${[['all','Όλοι'],['staff','Μόνιμοι'],['freelance','Εξωτερικοί'],['inactive','Ανενεργοί']].map(([k,l])=>`<button class="${UI.crewType===k?'on':''}" data-act="tab" data-k="crewType" data-v="${k}">${l} <span class="faint">${cnt[k]}</span></button>`).join('')}</div>`;
  const nx=c=>{ const n=next[c.id]; return n?`<a class="lk small" href="#order-${n.o.id}">${n.a.start===t?'Σήμερα':fmtD(n.a.start)} · ${esc(n.o.number)}</a>`:'<span class="faint small">—</span>'; };
  const rows=list.map(c=>`<tr class="click" data-act="crew-edit" data-id="${c.id}"><td><div class="pcell">${crewAv(c)}<div><b>${esc(c.name)}</b> ${crewTypeTag(c)}<div class="xs muted">${esc(c.role||'')}</div></div></div></td>
    <td class="small">${c.phone?`<a href="tel:${esc(c.phone)}" class="lk" data-stop>${esc(c.phone)}</a>`:''}${c.email?`<div class="xs muted">${esc(c.email)}</div>`:''}</td>
    <td class="small pr">${rateLabel(c.cost,c.payType)}</td><td class="small pr">${rateLabel(c.rate,c.payType)}</td>
    <td>${busyToday(c)?'<span class="pill orange">Απασχολημένος σήμερα</span>':'<span class="pill green">Διαθέσιμος</span>'}</td><td>${nx(c)}</td></tr>`).join('');
  const mrows=list.map(c=>`<a class="mrow" href="#" data-act="crew-edit" data-id="${c.id}">${crewAv(c,40)}<div class="mrow-m"><div class="mrow-n">${esc(c.name)}</div><div class="mrow-s">${esc(c.role||'')} · ${c.type==='freelance'?'Εξωτερικός':'Μόνιμος'}</div><div class="mrow-s">${next[c.id]?'Επόμενη: '+(next[c.id].a.start===t?'Σήμερα':fmtD(next[c.id].a.start))+' · '+esc(next[c.id].o.number):''}</div></div><div class="mrow-r">${busyToday(c)?'<span class="pill orange">Σήμερα</span>':'<span class="pill green">Ελεύθερος</span>'}</div></a>`).join('');
  return seg+`<div class="card p0"><div class="card-h"><input type="search" class="grow" style="max-width:420px" placeholder="Αναζήτηση ονόματος, ειδικότητας, τηλεφώνου…" data-bind="crewQ" value="${esc(UI.crewQ)}"></div>
    ${list.length?(isM()?`<div class="mlist">${mrows}</div>`:`<div class="tw"><table><thead><tr><th>Όνομα</th><th>Επικοινωνία</th><th class="pr">Κόστος</th><th class="pr">Χρέωση πελάτη</th><th>Σήμερα</th><th>Επόμενη δουλειά</th></tr></thead><tbody>${rows}</tbody></table></div>`)
      :`<div class="empty"><b>${all.length?'Κανένα αποτέλεσμα':'Δεν έχεις προσθέσει άτομα ακόμη'}</b>${all.length?'':'Πρόσθεσε το μόνιμο προσωπικό και τους εξωτερικούς συνεργάτες σου.'}</div>`}</div>`;
}
function defWeek(){ const t=today(); return new Date(t+'T00:00:00Z').getUTCDay()===0 ? addDays(t,1) : weekStart(t); }
function weekStart(d){ const dt=new Date(d+'T00:00:00Z'); const wd=(dt.getUTCDay()+6)%7; return addDays(d,-wd); }
function weekLabel(ws){ const we=addDays(ws,6); const a=new Date(ws+'T00:00:00'), b=new Date(we+'T00:00:00'); const M=GR_MON_S;
  return a.getMonth()===b.getMonth() ? `${a.getDate()}–${b.getDate()} ${M[b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${M[a.getMonth()]} – ${b.getDate()} ${M[b.getMonth()]} ${b.getFullYear()}`; }
function crewWeekData(ws){
  const days=[...Array(7)].map((_,i)=>addDays(ws,i)), we=days[6];
  const people=crewSorted(Object.values(D.crew).filter(c=>!c.inactive));
  const asg={}, orders={};
  for(const o of Object.values(D.orders)){ if(!CREW_ST.includes(o.status)) continue;
    for(const a of o.crew||[]){ const e=a.end||a.start; if(a.start>we||e<ws) continue; (asg[a.cid]=asg[a.cid]||[]).push({a,o}); (orders[o.id]=orders[o.id]||{o,list:[]}).list.push(a); } }
  return {days, people, asg, orders:sortBy(Object.values(orders),x=>x.o.start+(x.o.startTime||''))};
}
const DOW_S=['Κυ','Δε','Τρ','Τε','Πε','Πα','Σα'], DOW_L=['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
function crewSchedule(){
  const t=today(); const ws=UI.crewWeek||defWeek(); const {days,people,asg}=crewWeekData(ws);
  const head=days.map(d=>{ const dt=new Date(d+'T00:00:00'); return `<th class="${d===t?'td':''} ${[0,6].includes(dt.getDay())?'we':''}">${DOW_S[dt.getDay()]}<br><b>${dt.getDate()}/${dt.getMonth()+1}</b></th>`; }).join('');
  let busyN=0;
  const rows=people.map(c=>{ const mine=asg[c.id]||[];
    const cells=days.map(d=>{ const here=sortBy(mine.filter(x=>x.a.start<=d&&(x.a.end||x.a.start)>=d),x=>x.a.from||''); const off=(c.off||[]).find(x=>x.start<=d&&(x.end||x.start)>=d);
      if(here.length) busyN++;
      return `<td class="${d===t?'td':''} ${here.length>1?'clash':''}">${off?`<span class="cchip off" title="${esc(off.note||'Μη διαθέσιμος')}">${esc(off.note||'Άδεια')}</span>`:''}${here.map(x=>`<a class="cchip wk st-${x.o.status}" href="#order-${x.o.id}" title="${esc(x.o.number+' · '+(custName(x.o.customerId)||'')+' · '+(x.a.role||''))}"><b>${esc(x.a.from||'')}${x.a.to?'–'+esc(x.a.to):''}</b><span>${esc(x.o.name||custName(x.o.customerId)||x.o.number)}</span></a>`).join('')}</td>`; }).join('');
    return `<tr><th class="nm"><div class="pcell">${crewAv(c,26)}<div><a class="lk" href="#" data-act="crew-edit" data-id="${c.id}">${esc(c.name)}</a><div class="xs muted">${esc(c.role||'')}</div></div></div></th>${cells}</tr>`; }).join('');
  return `<div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap"><button class="btn" data-act="crew-wk" data-v="-7">‹</button><button class="btn" data-act="crew-wk" data-v="0">Αυτή η εβδομάδα</button><button class="btn" data-act="crew-wk" data-v="7">›</button>
      <b style="margin:0 8px">${weekLabel(ws)}</b><div class="grow"></div><button class="btn keep-m" data-act="crew-wk-print">📄 PDF εβδομάδας</button></div>
    ${people.length?`<div class="card p0"><div class="cal crewcal"><table><thead><tr><th class="nm">Άτομο</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="small muted" style="margin-top:8px">Κλικ σε δουλειά για άνοιγμα της παραγγελίας. Κόκκινο κελί = το ίδιο άτομο σε δύο δουλειές την ίδια ημέρα.</div>`
    :'<div class="card empty"><b>Δεν υπάρχουν άτομα</b>Πρόσθεσε πρώτα το προσωπικό σου.</div>'}`;
}
ACT['crew-wk']=el=>{ const v=+el.dataset.v; UI.crewWeek = v===0 ? weekStart(today()) : addDays(UI.crewWeek||defWeek(), v); render(); };
ACT['crew-wk-print']=()=>printCrewWeek(UI.crewWeek||defWeek());
function printCrewWeek(ws){
  const {days,people,asg,orders}=crewWeekData(ws); const s=settings();
  const head=days.map(d=>{ const dt=new Date(d+'T00:00:00'); return `<th class="${[0,6].includes(dt.getDay())?'we':''}">${DOW_L[dt.getDay()]}<br><span>${dt.getDate()}/${dt.getMonth()+1}</span></th>`; }).join('');
  const rows=people.map(c=>{ const mine=asg[c.id]||[];
    return `<tr><td class="nm"><b>${esc(c.name)}</b><small>${esc(c.role||'')}${c.phone?' · '+esc(c.phone):''}</small></td>${days.map(d=>{ const here=sortBy(mine.filter(x=>x.a.start<=d&&(x.a.end||x.a.start)>=d),x=>x.a.from||''); const off=(c.off||[]).find(x=>x.start<=d&&(x.end||x.start)>=d);
      return `<td>${off?`<div class="off">${esc(off.note||'Άδεια')}</div>`:''}${here.map(x=>`<div class="j"><b>${esc(x.a.from||'')}${x.a.to?'–'+esc(x.a.to):''}</b><span>${esc(x.o.name||custName(x.o.customerId)||x.o.number)}</span>${x.o.venue?`<small>${esc(x.o.venue)}</small>`:''}</div>`).join('')}</td>`; }).join('')}</tr>`; }).join('');
  const ev=orders.map(({o,list})=>`<div class="ev"><div class="evh"><b>${esc(o.name||custName(o.customerId)||o.number)}</b> <span>${esc(o.number)}${o.name&&custName(o.customerId)?' · '+esc(custName(o.customerId)):''}</span></div>
    <div class="evm">${fmtD(o.start)}${o.end&&o.end!==o.start?' – '+fmtD(o.end):''}${o.venue?' · 📍 '+esc(o.venue):''}${o.status==='option'||o.status==='concept'?' · <i>προς επιβεβαίωση</i>':''}</div>
    <div class="evc">${sortBy(list,a=>a.start+(a.from||'')).map(a=>`<span>${esc(crewName(a.cid))} <small>(${esc(a.role||'')}, ${fmtD(a.start).slice(0,5)}${a.end&&a.end!==a.start?'–'+fmtD(a.end).slice(0,5):''} ${esc(a.from||'')}–${esc(a.to||'')})</small></span>`).join('')}</div>
    ${list.some(a=>a.note)?`<div class="evn">${list.filter(a=>a.note).map(a=>esc(crewName(a.cid))+': '+esc(a.note)).join(' · ')}</div>`:''}</div>`).join('');
  printHTML('Πρόγραμμα προσωπικού '+weekLabel(ws), `
    <div class="hd">${LOGO?`<img src="${LOGO}" alt="">`:`<b style="font-size:16pt">${esc(s.name||'')}</b>`}<div><h1>Εβδομαδιαίο πρόγραμμα προσωπικού</h1><div class="wk">${weekLabel(ws)}</div></div></div>
    <div class="bar"></div>
    <table class="g"><thead><tr><th class="nm">Άτομο</th>${head}</tr></thead><tbody>${rows||'<tr><td colspan="8">Δεν υπάρχουν άτομα.</td></tr>'}</tbody></table>
    ${ev?`<h2>Εκδηλώσεις της εβδομάδας</h2>${ev}`:'<p class="muted">Δεν υπάρχουν αναθέσεις αυτή την εβδομάδα.</p>'}
    <div class="ft">Εκτυπώθηκε ${fmtD(today())} · Αλλαγές στο πρόγραμμα ενημερώνονται στον σύνδεσμο του προσωπικού</div>`,
  `@page{size:A4 landscape;margin:9mm} body{padding:6mm;font-size:8.5pt}
   .hd{display:flex;align-items:center;gap:8mm}.hd img{height:15mm}.hd h1{font-size:15pt;margin:0}.wk{font-size:11pt;color:#555;font-weight:600}
   .bar{height:1mm;background:#f2c428;margin:4mm 0 3mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
   table.g{table-layout:fixed;margin-top:0} table.g th{font-size:8pt;text-align:center;border-bottom:1.5px solid #111;padding:1.5mm 1mm} table.g th span{font-weight:400;color:#555}
   table.g th.nm,table.g td.nm{width:30mm;text-align:left} table.g td{border:1px solid #ddd;padding:1mm;vertical-align:top;height:11mm}
   table.g th.we{color:#777} td.nm b{display:block;font-size:8.5pt} td.nm small{color:#666;font-size:7pt}
   .j{background:#fdf3cf;border-radius:1.2mm;padding:.8mm 1.2mm;margin-bottom:.8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-inside:avoid}
   .j b{display:block;font-size:8pt}.j span{display:block;font-size:7.5pt;line-height:1.2}.j small{display:block;font-size:6.5pt;color:#555;line-height:1.15}
   .off{background:#fee2e2;color:#991b1b;border-radius:1.2mm;padding:.8mm 1.2mm;font-size:7.5pt;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact}
   tr{break-inside:avoid} h2{font-size:11pt;margin:6mm 0 2mm;break-after:avoid}
   .ev{border:1px solid #ddd;border-radius:2mm;padding:2mm 3mm;margin-bottom:2mm;break-inside:avoid}.evh b{font-size:9.5pt}.evh span{color:#666}
   .evm{color:#444;margin:.5mm 0 1mm}.evc span{display:inline-block;margin:0 4mm .5mm 0}.evc small{color:#666}.evn{margin-top:1mm;font-size:7.5pt;color:#7a5b00}
   .ft{margin-top:4mm;text-align:center;color:#999;font-size:7pt}`);
}

/* ---------- καρτέλα ατόμου ---------- */
ACT['crew-new']=()=>crewModal(null);
ACT['crew-edit']=(el,e)=>{ if(e&&e.target.closest('[data-stop]')) return; if(e) e.preventDefault(); crewModal(el.dataset.id); };
function crewModal(id){
  const c=id?deepCopy(D.crew[id]):{id:null,name:'',type:'staff',role:'',phone:'',email:'',payType:'day',cost:'',rate:'',notes:'',off:[]};
  c.off=c.off||[]; M={type:'crew', c, redraw:drawCrewModal}; drawCrewModal();
}
function drawCrewModal(){
  const c=M.c, t=today();
  const hist=[]; for(const o of Object.values(D.orders)) for(const a of o.crew||[]) if(c.id&&a.cid===c.id) hist.push({a,o});
  const up=sortBy(hist.filter(x=>(x.a.end||x.a.start)>=t&&CREW_ST.includes(x.o.status)),x=>x.a.start);
  const past=sortBy(hist.filter(x=>(x.a.end||x.a.start)<t||!CREW_ST.includes(x.o.status)),x=>x.a.start).reverse();
  const m30=past.filter(x=>x.a.start>=addDays(t,-30)&&x.o.status!=='cancelled');
  const ro=!can('staff');
  openModal(`<div class="dlg-h"><h2>${c.id?esc(c.name):'Νέο άτομο'}</h2><button class="icon" data-act="modal-close">✕</button></div>
  <div class="dlg-b">
    <div class="seg"><button class="${c.type!=='freelance'?'on':''}" data-act="cw-set" data-k="type" data-v="staff">Μόνιμος υπάλληλος</button><button class="${c.type==='freelance'?'on':''}" data-act="cw-set" data-k="type" data-v="freelance">Εξωτερικός συνεργάτης</button></div>
    <div class="f2"><label class="f">Ονοματεπώνυμο *<input type="text" data-cw="name" value="${esc(c.name)}" autofocus ${ro?'disabled':''}></label>
      <label class="f">Ειδικότητα<input type="text" data-cw="role" value="${esc(c.role)}" list="crewRoles" placeholder="π.χ. Ηχολήπτης" ${ro?'disabled':''}></label></div>
    <datalist id="crewRoles">${CREW_ROLES.map(r=>`<option value="${esc(r)}">`).join('')}</datalist>
    <div class="f2 pr"><label class="f">Αριθμός ταυτότητας<input type="text" data-cw="idNumber" value="${esc(c.idNumber||'')}" placeholder="π.χ. ΑΒ 123456" autocomplete="off" ${ro?'disabled':''}></label>
      <label class="f">Ημερομηνία γέννησης${c.birthDate?` <span class="faint">(${crewAge(c.birthDate)} ετών)</span>`:''}<input type="date" data-cw="birthDate" value="${esc(c.birthDate||'')}" max="${today()}" ${ro?'disabled':''}></label></div>
    <div class="f2"><label class="f">Τηλέφωνο<input type="tel" data-cw="phone" value="${esc(c.phone)}" ${ro?'disabled':''}></label><label class="f">Email<input type="email" data-cw="email" value="${esc(c.email)}" ${ro?'disabled':''}></label></div>
    <div class="f3 pr"><label class="f">Αμοιβή<select data-cw="payType" ${ro?'disabled':''}>${Object.entries(PAYT).map(([k,l])=>`<option value="${k}" ${c.payType===k?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="f">Κόστος για εμάς €<input type="number" min="0" step="0.01" data-cw="cost" value="${esc(c.cost)}" ${ro?'disabled':''}></label>
      <label class="f">Χρέωση πελάτη €<input type="number" min="0" step="0.01" data-cw="rate" value="${esc(c.rate)}" ${ro?'disabled':''}></label></div>
    <div class="xs muted pr" style="margin-top:-6px">${c.type==='freelance'?'Για εξωτερικούς: η αμοιβή που τους δίνετε.':'Για μόνιμους: προαιρετικά, το εσωτερικό κόστος ημέρας/ώρας για να βλέπετε το περιθώριο κέρδους.'} Η «χρέωση πελάτη» μπαίνει στην προσφορά όταν τους αναθέτετε σε παραγγελία.</div>
    <label class="f pr">Σημειώσεις<textarea data-cw="notes" ${ro?'disabled':''} placeholder="Δίπλωμα, πιστοποιήσεις, ΑΦΜ, IBAN…">${esc(c.notes)}</textarea></label>
    <div><div class="small muted b" style="margin-bottom:6px">Μη διαθεσιμότητα (άδειες, ρεπό, ασθένεια)</div>
      ${c.off.length?c.off.map((x,i)=>`<div class="li" style="padding:6px 0"><div><b class="small">${fmtD(x.start)}${x.end&&x.end!==x.start?' → '+fmtD(x.end):''}</b> <span class="small muted">${esc(x.note||'')}</span></div>${ro?'':`<button class="icon" data-act="cw-off-del" data-i="${i}">✕</button>`}</div>`).join(''):'<div class="xs faint">Καμία.</div>'}
      ${ro?'':`<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><input type="date" id="offS" value="${t}" style="width:150px"><input type="date" id="offE" value="${t}" style="width:150px"><input type="text" id="offN" placeholder="π.χ. Άδεια" style="flex:1;min-width:120px"><button class="btn sm" data-act="cw-off-add">+ Προσθήκη</button></div>`}</div>
    ${c.id?`<div><div class="small muted b" style="margin:4px 0 6px">Επόμενες δουλειές (${up.length})</div>${up.length?up.slice(0,8).map(x=>`<div class="li" style="padding:5px 0"><a class="lk small" href="#order-${x.o.id}">${fmtD(x.a.start)}${x.a.end&&x.a.end!==x.a.start?'→'+fmtD(x.a.end):''} · ${esc(x.o.number)} · ${esc(custName(x.o.customerId)||x.o.name||'')}</a><span class="xs muted">${esc(x.a.role||'')} ${esc(x.a.from||'')}–${esc(x.a.to||'')}</span></div>`).join(''):'<div class="xs faint">Καμία.</div>'}
      <div class="xs muted pr" style="margin-top:8px">Τελευταίες 30 ημέρες: <b>${m30.length}</b> αναθέσεις · <b>${m30.reduce((s,x)=>s+crewDays(x.a),0)}</b> ημέρες · κόστος <b>${money(m30.reduce((s,x)=>s+crewCost(x.a),0))}</b></div></div>`:''}
    ${c.id&&settings().crewToken?`<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><span class="small muted b" style="margin-right:4px">Προσωπικός σύνδεσμος προγράμματος:</span><button class="btn sm" data-act="crew-mylink" data-id="${c.id}">Αντιγραφή</button>${navigator.share?`<button class="btn sm" data-act="crew-mylink" data-id="${c.id}" data-how="share">Κοινοποίηση…</button>`:''}${c.phone?`<a class="btn sm" href="sms:${esc(c.phone.replace(/\s/g,''))}?&body=${encodeURIComponent('Το πρόγραμμά σου στη ΔΙΗΧΟ: '+crewLinkURL(c.id))}">SMS</a><a class="btn sm" href="viber://forward?text=${encodeURIComponent('Το πρόγραμμά σου στη ΔΙΗΧΟ: '+crewLinkURL(c.id))}">Viber</a>`:''}</div>`:''}
    ${c.id&&!ro?`<label class="row" style="gap:8px;font-size:13.5px"><input type="checkbox" data-cw-ck="inactive" ${c.inactive?'checked':''}> Ανενεργός (δεν εμφανίζεται στις αναθέσεις)</label>`:''}
  </div>
  <div class="dlg-f">${c.id&&can('admin')?'<button class="btn dangerous" data-act="cw-del" style="margin-right:auto">Διαγραφή</button>':''}<button class="btn" data-act="modal-close">${ro?'Κλείσιμο':'Άκυρο'}</button>${ro?'':'<button class="btn pri" data-act="cw-save" data-primary>Αποθήκευση</button>'}</div>`);
}
ON_INPUT.push(el=>{ if(el.dataset.cw!==undefined&&M&&M.type==='crew'){ M.c[el.dataset.cw]=el.value; return true; } return false; });
ON_CHANGE.push(el=>{ if(M&&M.type==='crew'){ if(el.dataset.cw!==undefined){ M.c[el.dataset.cw]=el.value; return true; } if(el.dataset.cwCk){ M.c[el.dataset.cwCk]=el.checked; return true; } } return false; });
ACT['cw-set']=el=>{ M.c[el.dataset.k]=el.dataset.v; drawCrewModal(); };
ACT['cw-off-add']=()=>{ const s=$('#offS').value, e=$('#offE').value||s; if(!s) return toast('Διάλεξε ημερομηνία.', true); M.c.off.push({start:s<e?s:e, end:s<e?e:s, note:$('#offN').value.trim()}); M.c.off=sortBy(M.c.off,x=>x.start); drawCrewModal(); };
ACT['cw-off-del']=el=>{ M.c.off.splice(+el.dataset.i,1); drawCrewModal(); };
ACT['cw-save']=async()=>{ const c=M.c; c.name=(c.name||'').trim(); if(!c.name) return toast('Συμπλήρωσε όνομα.', true);
  const doc={name:c.name, type:c.type||'staff', role:(c.role||'').trim(), phone:(c.phone||'').trim(), email:(c.email||'').trim(), idNumber:(c.idNumber||'').trim().toUpperCase(), birthDate:c.birthDate||'', payType:c.payType||'day', cost:c.cost===''?'':num(c.cost), rate:c.rate===''?'':num(c.rate), notes:c.notes||'', off:c.off||[], inactive:!!c.inactive, color:c.color||''};
  if(await put('crew', c.id||uid('cr'), doc, 'Αποθηκεύτηκε: '+c.name)) closeModal(); };
ACT['cw-del']=()=>{ const c=M.c; const used=Object.values(D.orders).some(o=>(o.crew||[]).some(a=>a.cid===c.id));
  confirmBox(`Διαγραφή «${c.name}»;`, used?'Υπάρχει σε παραγγελίες — καλύτερα σήμανέ τον «Ανενεργό» για να μείνει το ιστορικό.':'Θα διαγραφεί οριστικά.', 'Διαγραφή', async()=>{ await del('crew', c.id, 'Διαγράφηκε: '+c.name); }); };

/* ---------- κάρτα συνεργείου στην παραγγελία ---------- */
function crewCard(d, ro){
  const list=d.crew||[]; const tt=orderTotals(d);
  const rows=list.map((a,i)=>{ const c=D.crew[a.cid]; const clash=crewBusy(a.cid,a.start,a.end,d.id,a.id);
    return `<div class="crow">${crewAv(c,36)}<div class="grow" style="min-width:0"><div><b>${esc(c?c.name:'(διαγραμμένο άτομο)')}</b> <span class="small muted">${esc(a.role||'')}</span></div>
      <div class="xs muted">${fmtD(a.start)}${a.end&&a.end!==a.start?' → '+fmtD(a.end):''} · ${esc(a.from||'')}–${esc(a.to||'')} · ${crewDays(a)} ${crewDays(a)===1?'ημέρα':'ημέρες'}${a.note?' · '+esc(a.note):''}</div>
      ${clash.length?`<div class="xs" style="color:var(--red);font-weight:600">⚠ ${clash.map(x=>x.type==='off'?'Μη διαθέσιμος ('+esc(x.off.note||'άδεια')+')':'Και στην '+esc(x.order.number)).join(' · ')}</div>`:''}</div>
      <div class="crow-r pr"><div class="small b">${a.bill===false?'<span class="faint">Χωρίς χρέωση</span>':money(crewCharge(a))}</div><div class="xs muted">κόστος ${money(crewCost(a))}</div></div>
      ${ro?'':`<button class="icon" data-act="o-crew-edit" data-i="${i}" title="Επεξεργασία">✎</button><button class="icon" data-act="o-crew-del" data-i="${i}" title="Αφαίρεση">✕</button>`}</div>`; }).join('');
  const margin=r2(tt.net-tt.crewCost);
  return `<div class="card p0"><div class="card-h"><h2>Συνεργείο ${list.length?`<span class="faint">(${list.length})</span>`:''}</h2>${ro?'':'<button class="btn sm" data-act="o-crew-add">+ Ανάθεση ατόμου</button>'}</div>
    ${rows||`<div class="empty" style="padding:22px">Δεν έχει ανατεθεί προσωπικό.${ro?'':' Πρόσθεσε τεχνικούς, οδηγούς και βοηθούς για αυτή τη δουλειά.'}</div>`}
    ${list.length?`<div class="crew-sum pr"><span>Χρέωση πελάτη <b>${money(tt.crewCharge)}</b></span><span>Κόστος <b>${money(tt.crewCost)}</b></span>${can('staff')?`<span>Περιθώριο παραγγελίας <b class="${margin<0?'late':''}">${money(margin)}</b></span>`:''}</div>`:''}</div>`;
}
ACT['o-crew-add']=()=>{ const d=UI.draft; asgModal(null, {id:uid('ca'), cid:'', role:'', start:d.start, end:d.end||d.start, from:'08:00', to:'18:00', bill:true, charge:'', cost:'', note:''}); };
ACT['o-crew-edit']=el=>{ const d=UI.draft; asgModal(+el.dataset.i, deepCopy(d.crew[+el.dataset.i])); };
ACT['o-crew-del']=el=>{ const d=UI.draft; const a=d.crew[+el.dataset.i]; confirmBox('Αφαίρεση από την παραγγελία;', crewName(a.cid)+(a.role?' · '+a.role:''), 'Αφαίρεση', ()=>{ d.crew.splice(+el.dataset.i,1); dirty(); }); };
function asgModal(idx, a){ M={type:'asg', idx, a, redraw:drawAsgModal}; drawAsgModal(); }
function asgInfoHTML(){
  const a=M.a; if(!a.cid) return '<div class="xs muted">Διάλεξε άτομο για να δεις διαθεσιμότητα και κόστος.</div>';
  const c=D.crew[a.cid]||{}; const clash=crewBusy(a.cid,a.start,a.end,UI.draft&&UI.draft.id,a.id);
  return `${clash.length?`<div class="banner red" style="margin:0">⚠ ${clash.map(x=>x.type==='off'?`Μη διαθέσιμος ${fmtD(x.off.start)}–${fmtD(x.off.end||x.off.start)} (${esc(x.off.note||'άδεια')})`:`Ήδη στην <b>${esc(x.order.number)}</b> (${fmtD(x.a.start)}${x.a.end&&x.a.end!==x.a.start?'–'+fmtD(x.a.end):''}, ${esc(x.a.from||'')}–${esc(x.a.to||'')})`).join('<br>')}</div>`:'<div class="banner green" style="margin:0">✓ Διαθέσιμος αυτές τις ημέρες</div>'}
    <div class="small muted" style="margin-top:8px">${crewDays(a)} ${crewDays(a)===1?'ημέρα':'ημέρες'} × ${crewHours(a)} ώρες<span class="pr"> · αμοιβή ${PAYT[c.payType||'day']} · Κόστος <b>${money(crewCost(a))}</b> · Χρέωση πελάτη <b>${a.bill===false?'—':money(crewCharge(a))}</b></span></div>`;
}
function drawAsgModal(){
  const a=M.a, d=UI.draft; const people=crewSorted(Object.values(D.crew).filter(c=>!c.inactive||c.id===a.cid));
  const opt=c=>{ const busy=crewBusy(c.id,a.start,a.end,d&&d.id,a.id).length; return `<option value="${c.id}" ${a.cid===c.id?'selected':''}>${busy?'⚠ ':''}${esc(c.name)}${c.role?' — '+esc(c.role):''}${busy?' (κλεισμένος)':''}</option>`; };
  const staff=people.filter(c=>c.type!=='freelance'), free=people.filter(c=>c.type==='freelance');
  openModal(`<div class="dlg-h"><h2>${M.idx===null?'Ανάθεση ατόμου':'Επεξεργασία ανάθεσης'}</h2><button class="icon" data-act="modal-close">✕</button></div>
  <div class="dlg-b">
    ${people.length?'':`<div class="banner orange" style="margin:0">Δεν υπάρχουν άτομα. <a href="#crew" data-act="modal-close">Πρόσθεσέ τα στη σελίδα Συνεργείο</a>.</div>`}
    <label class="f">Άτομο *<select data-as="cid"><option value="">— Επίλεξε —</option>${staff.length?`<optgroup label="Μόνιμοι">${staff.map(opt).join('')}</optgroup>`:''}${free.length?`<optgroup label="Εξωτερικοί">${free.map(opt).join('')}</optgroup>`:''}</select></label>
    <label class="f">Ρόλος σε αυτή τη δουλειά<input type="text" data-as="role" value="${esc(a.role)}" list="crewRoles2" placeholder="${esc((D.crew[a.cid]||{}).role||'π.χ. Ηχολήπτης')}"></label>
    <datalist id="crewRoles2">${CREW_ROLES.map(r=>`<option value="${esc(r)}">`).join('')}</datalist>
    <div class="f2"><label class="f">Από<input type="date" data-as="start" value="${esc(a.start)}"></label><label class="f">Έως<input type="date" data-as="end" value="${esc(a.end)}"></label></div>
    <div class="f2"><label class="f">Ώρα έναρξης<input type="time" data-as="from" value="${esc(a.from)}"></label><label class="f">Ώρα λήξης<input type="time" data-as="to" value="${esc(a.to)}"></label></div>
    <div id="asgInfo">${asgInfoHTML()}</div>
    <label class="row pr" style="gap:8px;font-size:13.5px"><input type="checkbox" data-as-ck="bill" ${a.bill!==false?'checked':''}> Χρέωση στον πελάτη (μπαίνει στην προσφορά/προτιμολόγιο)</label>
    <div class="f2 pr"><label class="f">Χρέωση πελάτη € <span class="faint">(κενό = αυτόματα)</span><input type="number" min="0" step="0.01" data-as="charge" value="${esc(a.charge)}"></label><label class="f">Κόστος € <span class="faint">(κενό = αυτόματα)</span><input type="number" min="0" step="0.01" data-as="cost" value="${esc(a.cost)}"></label></div>
    <label class="f">Σημείωση<input type="text" data-as="note" value="${esc(a.note)}" placeholder="π.χ. οδηγεί το βαν, ραντεβού στην αποθήκη 07:30"></label>
  </div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Άκυρο</button><button class="btn pri" data-act="asg-save" data-primary>${M.idx===null?'Ανάθεση':'Αποθήκευση'}</button></div>`);
}
const asgRefresh=()=>{ const el=$('#asgInfo'); if(el) el.innerHTML=asgInfoHTML(); };
ON_INPUT.push(el=>{ if(el.dataset.as!==undefined&&M&&M.type==='asg'){ M.a[el.dataset.as]=el.value; asgRefresh(); return true; } return false; });
ON_CHANGE.push(el=>{ if(M&&M.type==='asg'){ if(el.dataset.as!==undefined){ M.a[el.dataset.as]=el.value;
    if(el.dataset.as==='start'&&M.a.end<M.a.start) M.a.end=M.a.start;
    if(el.dataset.as==='cid'||el.dataset.as==='start'){ drawAsgModal(); return true; } asgRefresh(); return true; }
  if(el.dataset.asCk){ M.a[el.dataset.asCk]=el.checked; asgRefresh(); return true; } } return false; });
ACT['asg-save']=()=>{ const a=M.a, d=UI.draft; if(!d) return closeModal(); if(!a.cid) return toast('Διάλεξε άτομο.', true); if(!a.start) return toast('Βάλε ημερομηνία.', true);
  if(a.end&&a.end<a.start) a.end=a.start; if(!a.role) a.role=(D.crew[a.cid]||{}).role||'';
  a.charge=a.charge===''?'':num(a.charge); a.cost=a.cost===''?'':num(a.cost);
  d.crew=d.crew||[]; if(M.idx===null) d.crew.push(a); else d.crew[M.idx]=a;
  d.crew=sortBy(d.crew,x=>x.start+(x.from||'')); closeModal(); dirty(); };

/* ---------- σύνδεσμος προγράμματος για το προσωπικό (χωρίς τιμές) ---------- */
function crewLinkURL(cid){ const t=settings().crewToken; return t ? location.origin+'/crew.html?k='+t+(cid?'#'+cid:'') : ''; }
async function crewTokenNew(){ const tok=[...crypto.getRandomValues(new Uint8Array(18))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return put('settings','company',{...settings(), crewToken:tok}, 'Δημιουργήθηκε νέος σύνδεσμος προγράμματος'); }
ACT['crew-link']=async()=>{
  if(!settings().crewToken){ if(!can('admin')) return toast('Ο σύνδεσμος δεν έχει δημιουργηθεί ακόμη — ζήτησέ το από διαχειριστή.', true); if(!await crewTokenNew()) return; }
  drawCrewLink();
};
function crewLinkBody(){
  const url=crewLinkURL(); const n=Object.values(D.crew).filter(c=>!c.inactive).length;
  if(!url) return `<div class="small">Οι τεχνικοί σου μπορούν να βλέπουν το πρόγραμμά τους από το κινητό — <b>χωρίς τιμές</b> και χωρίς κωδικό. Πρώτα δημιούργησε τον σύνδεσμο.</div>${can('admin')?'<div><button class="btn pri" data-act="crew-link-make">Δημιουργία συνδέσμου</button></div>':'<div class="banner orange" style="margin:0">Μόνο διαχειριστής μπορεί να δημιουργήσει τον σύνδεσμο.</div>'}`;
  return `${n?'':`<div class="banner orange" style="margin:0"><div>Δεν έχεις καταχωρήσει ακόμη άτομα. Πήγαινε στο <a href="#crew">Συνεργείο</a> → «+ Νέο άτομο», αλλιώς η σελίδα του προσωπικού θα είναι άδεια.</div></div>`}
    <div class="small">Στείλε αυτόν τον σύνδεσμο στους τεχνικούς σου. Τον ανοίγουν στο κινητό, πατάνε <b>το όνομά τους</b> και βλέπουν <b>μόνο το πρόγραμμά τους</b>: ημέρες, ώρες, χώρο, ρόλο, ομάδα και εξοπλισμό. <b>Δεν βλέπουν τιμές</b>, κόστη ή άλλα στοιχεία. Το κινητό θυμάται ποιος είναι, οπότε την επόμενη φορά ανοίγει κατευθείαν το δικό του πρόγραμμα.</div>
    <div class="row" style="flex-wrap:nowrap"><input type="text" readonly value="${esc(url)}" class="mono" style="flex:1;font-size:12.5px;min-width:0" onclick="this.select()"><button class="btn" data-act="crew-link-copy" data-url="${esc(url)}">Αντιγραφή</button></div>
    <div class="row" style="gap:8px;flex-wrap:wrap">${navigator.share?`<button class="btn" data-act="crew-link-share" data-url="${esc(url)}">Κοινοποίηση…</button>`:''}<a class="btn" href="viber://forward?text=${encodeURIComponent('Το πρόγραμμά σου στη ΔΙΗΧΟ: '+url)}">Viber</a><a class="btn" href="https://wa.me/?text=${encodeURIComponent('Το πρόγραμμά σου στη ΔΙΗΧΟ: '+url)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Άνοιγμα ↗</a><button class="btn" data-act="crew-link-print">📄 PDF με QR</button></div>
    <div style="display:flex;gap:16px;align-items:center"><div style="width:130px;flex:none">${qrSVG(url,130)}</div><div class="xs muted">Μπορούν και να σκανάρουν αυτό το QR με την κάμερα του κινητού.<br><br>Κάθε άτομο έχει και <b>προσωπικό σύνδεσμο</b> (με SMS / Viber) που ανοίγει κατευθείαν το δικό του πρόγραμμα — θα τον βρεις στην καρτέλα του στο <a href="#crew">Συνεργείο</a>.</div></div>
    ${can('admin')?`<div class="banner orange" style="margin:0"><div class="grow small">Αν ο σύνδεσμος βρεθεί σε λάθος χέρια, φτιάξε νέο — ο παλιός σταματά αμέσως να λειτουργεί και στέλνεις τον νέο στο προσωπικό.</div><button class="btn sm" data-act="crew-link-new">Νέος σύνδεσμος</button></div>`:''}`;
}
function drawCrewLink(){
  M={type:'crewlink', redraw:drawCrewLink};
  openModal(`<div class="dlg-h"><h2>Σύνδεσμος προγράμματος για το προσωπικό</h2><button class="icon" data-act="modal-close">✕</button></div>
  <div class="dlg-b">${crewLinkBody()}</div><div class="dlg-f"><button class="btn pri" data-act="modal-close">Κλείσιμο</button></div>`);
}
ACT['crew-link-make']=async()=>{ if(await crewTokenNew()) render(); };
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast('Αντιγράφηκε'); }catch(e){ const i=document.createElement('textarea'); i.value=t; document.body.appendChild(i); i.select(); try{ document.execCommand('copy'); toast('Αντιγράφηκε'); }catch(_){ toast('Αντίγραψε το κείμενο χειροκίνητα.', true); } i.remove(); } }
ACT['crew-link-copy']=el=>copyText(el.dataset.url);
ACT['crew-link-share']=async el=>{ try{ await navigator.share({title:'Πρόγραμμα συνεργείου', text:'Το πρόγραμμά σου στη ΔΙΗΧΟ:', url:el.dataset.url}); }catch(e){} };
ACT['crew-link-new']=()=>confirmBox('Νέος σύνδεσμος;', 'Ο τωρινός σύνδεσμος θα σταματήσει να λειτουργεί και θα χρειαστεί να στείλεις τον νέο σε όλο το προσωπικό.', 'Δημιουργία νέου', async()=>{ if(await crewTokenNew()){ if(route()==='setup'){ closeModal(); render(); } else drawCrewLink(); } });
ACT['crew-link-print']=()=>{ const url=crewLinkURL();
  printHTML('Πρόγραμμα συνεργείου', `<div style="text-align:center;padding-top:20mm">${LOGO?`<img src="${LOGO}" style="height:30mm">`:''}<h1 style="font-size:28pt;margin:14mm 0 4mm">Το πρόγραμμά σου</h1><div style="font-size:14pt;color:#555">Σκάναρε με την κάμερα του κινητού και πάτα το όνομά σου</div><div style="width:110mm;margin:12mm auto">${qrSVG(url,400)}</div><div style="font-size:9pt;color:#888;word-break:break-all">${esc(url)}</div></div>`); };
ACT['crew-mylink']=async el=>{ const url=crewLinkURL(el.dataset.id); if(!url) return toast('Δημιούργησε πρώτα τον σύνδεσμο από το «🔗 Σύνδεσμος για το προσωπικό».', true); if(el.dataset.how==='share'&&navigator.share){ try{ await navigator.share({title:'Το πρόγραμμά σου', url}); }catch(e){} } else copyText(url); };
