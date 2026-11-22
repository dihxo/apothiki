/* ================= Βοηθός AI (Claude) =================
   Ο server κρατά το κλειδί και προωθεί τα αιτήματα (/api/ai/messages).
   Τα εργαλεία εκτελούνται εδώ, πάνω στα δεδομένα που βλέπει ήδη ο χρήστης
   (οι τεχνικοί δεν βλέπουν τιμές, άρα ούτε ο βοηθός τις βλέπει για αυτούς). */

const AI={ status:null, busy:false };
async function aiLoadStatus(force){ if(AI.status&&!force) return AI.status; try{ AI.status=await api('/api/ai/status'); }catch(e){ AI.status={enabled:false, error:e.error}; } return AI.status; }

const AI_DOW=['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
function aiCatalog(){
  const np=NOPRICE();
  const list=prodsSorted(Object.values(D.products).filter(p=>!p.archived));
  return list.map(p=>{ const acc=(p.accessories||[]).map(a=>D.products[a.pid]?`${D.products[a.pid].name}×${a.qty}`:'').filter(Boolean).join(', ');
    return [p.id, p.name, catPath(p.cat)||'Χωρίς κατηγορία', 'απόθεμα '+stockOf(p.id), np?'':(p.priceType==='flat'?productPrice(p)+'€ σταθερή':productPrice(p)+'€/ημέρα'), p.kind==='bundle'?'bundle: '+(p.components||[]).map(c=>prodName(c.pid)+'×'+c.qty).join(', '):'', acc?'συνοδευτικά (μπαίνουν αυτόματα): '+acc:''].filter(Boolean).join(' | '); }).join('\n');
}
function aiSystem(kind, ctx){
  const t=today(); const np=NOPRICE();
  const base=`Είσαι ο βοηθός της αποθήκης της ΔΙΗΧΟ (ενοικίαση εξοπλισμού ήχου, φωτισμού, εικόνας και σκηνικών, Πάτρα).
Σήμερα είναι ${AI_DOW[dow(t)]} ${fmtD(t)} (${t}). Ο χρήστης είναι «${(UI.me&&UI.me.name)||''}» (${np?'τεχνικός — δεν βλέπει τιμές, μην αναφέρεις ποσά':'βλέπει τιμές'}).
Απαντάς πάντα στα ελληνικά, σύντομα και πρακτικά. Χρησιμοποιείς ΜΟΝΟ προϊόντα από τον κατάλογο (με το id τους) — ποτέ δεν επινοείς προϊόντα.
Για διαθεσιμότητα, παραγγελίες, πελάτες και πρόγραμμα συνεργείου ΧΡΗΣΙΜΟΠΟΙΕΙΣ τα εργαλεία· μη μαντεύεις. Ημερομηνίες σε μορφή YYYY-MM-DD.
Όταν γράφεις αριθμό παραγγελίας γράψ' τον όπως είναι (π.χ. ORD-0242).`;
  const orderTxt=`
ΕΡΓΑΣΙΑ: ο χρήστης περιγράφει μια εκδήλωση και θέλει πρόχειρη λίστα εξοπλισμού για την παραγγελία.
- Διάλεξε ρεαλιστικό, πλήρες σύστημα από τον κατάλογο για το είδος/μέγεθος της εκδήλωσης (π.χ. κονσόλα + stagebox + ηχεία + monitors + μικρόφωνα + βάσεις, ή φωτιστικά + κονσόλα φωτισμού + truss κλπ), μόνο ό,τι ζήτησε ή ό,τι προφανώς χρειάζεται.
- Τα «συνοδευτικά» ενός προϊόντος μπαίνουν αυτόματα — ΜΗΝ τα προσθέτεις ξεχωριστά.
- Έλεγξε ΠΑΝΤΑ τη διαθεσιμότητα με check_availability για τις ημερομηνίες της εκδήλωσης. Αν κάτι δεν φτάνει, πρότεινε εναλλακτικό από τον κατάλογο και γράψε προειδοποίηση.
- Στο τέλος κάλεσε ΥΠΟΧΡΕΩΤΙΚΑ το εργαλείο propose_order με τη λίστα (και τίτλο/χώρο/ημερομηνίες αν τα είπε ο χρήστης).
${ctx?'\nΤΡΕΧΟΥΣΑ ΠΑΡΑΓΓΕΛΙΑ:\n'+ctx:''}`;
  return [{type:'text', text:base+(kind==='order'?orderTxt:'')}, {type:'text', text:'ΚΑΤΑΛΟΓΟΣ ΠΡΟΪΟΝΤΩΝ (id | όνομα | κατηγορία | απόθεμα'+(np?'':' | τιμή')+' | …):\n'+aiCatalog(), cache_control:{type:'ephemeral'}}];
}
function aiTools(kind){
  const T=[
    {name:'check_availability', description:'Πόσα τεμάχια κάθε προϊόντος είναι ελεύθερα σε ένα διάστημα (αφαιρούνται κρατήσεις, παραγγελίες σε εξέλιξη, συντήρηση).',
      input_schema:{type:'object', properties:{product_ids:{type:'array', items:{type:'string'}}, start:{type:'string', description:'YYYY-MM-DD'}, end:{type:'string', description:'YYYY-MM-DD'}}, required:['product_ids','start','end']}},
    {name:'list_orders', description:'Παραγγελίες που πέφτουν μέσα σε ένα διάστημα ημερομηνιών (όχι ακυρωμένες).',
      input_schema:{type:'object', properties:{from:{type:'string'}, to:{type:'string'}, status:{type:'string', description:'προαιρετικά: concept, option, reserved, started, stopped'}}, required:['from','to']}},
    {name:'get_order', description:'Λεπτομέρειες μιας παραγγελίας με τον αριθμό της (π.χ. ORD-0242) ή κομμάτι του τίτλου.',
      input_schema:{type:'object', properties:{query:{type:'string'}}, required:['query']}},
    {name:'search_customers', description:'Αναζήτηση πελατών με όνομα, εταιρεία, τηλέφωνο ή ΑΦΜ.' ,
      input_schema:{type:'object', properties:{query:{type:'string'}}, required:['query']}},
    {name:'crew_schedule', description:'Ποιοι από το συνεργείο είναι ανατεθειμένοι σε παραγγελίες σε ένα διάστημα.',
      input_schema:{type:'object', properties:{from:{type:'string'}, to:{type:'string'}}, required:['from','to']}},
    {name:'product_orders', description:'Σε ποιες παραγγελίες είναι κλεισμένο ένα προϊόν σε ένα διάστημα.',
      input_schema:{type:'object', properties:{product_id:{type:'string'}, from:{type:'string'}, to:{type:'string'}}, required:['product_id','from','to']}},
  ];
  if(!NOPRICE()) T.push({name:'customers_with_balance', description:'Πελάτες με ανεξόφλητο υπόλοιπο (οφειλή).', input_schema:{type:'object', properties:{}}});
  if(kind==='order') T.push({name:'propose_order', description:'Η τελική πρόταση εξοπλισμού για την παραγγελία. Καλείται μία φορά στο τέλος.',
    input_schema:{type:'object', properties:{
      title:{type:'string'}, venue:{type:'string'}, start:{type:'string', description:'YYYY-MM-DD αν ειπώθηκε'}, end:{type:'string', description:'YYYY-MM-DD αν ειπώθηκε'},
      lines:{type:'array', items:{type:'object', properties:{product_id:{type:'string'}, qty:{type:'integer'}, reason:{type:'string', description:'σύντομα γιατί'}}, required:['product_id','qty']}},
      warnings:{type:'array', items:{type:'string'}}, summary:{type:'string', description:'1-2 προτάσεις για τον χρήστη'}}, required:['lines']}});
  T[T.length-1].cache_control={type:'ephemeral'};
  return T;
}
function aiOrderBrief(o){ const tt=orderTotals(o); const st=STATUS[o.status]||{};
  return {number:o.number, title:o.name||'', customer:custName(o.customerId)||'', venue:o.venue||'', start:o.start, end:o.end||o.start, status:st.l||o.status, ...(NOPRICE()?{}:{total:tt.total, due:tt.due})}; }
function aiRunTool(name, x){
  const t=today(); x=x||{};
  if(name==='check_availability'){ const s=x.start||t, e=x.end||s; return (x.product_ids||[]).slice(0,80).map(id=>{ const p=D.products[id]; if(!p) return {id, error:'άγνωστο id'}; const f=freeUnits(id,s,e,UI.aiExclude||null).free; return {id, name:p.name, free:f, stock:stockOf(id)}; }); }
  if(name==='list_orders'){ const a=x.from||t, b=x.to||a; return sortBy(Object.values(D.orders).filter(o=>o.start&&o.status!=='cancelled'&&o.start<=b&&(o.end||o.start)>=a&&(!x.status||o.status===x.status)),o=>o.start).slice(0,60).map(aiOrderBrief); }
  if(name==='get_order'){ const q=normQ(x.query||''); const o=Object.values(D.orders).find(o=>normQ(o.number)===q)||Object.values(D.orders).find(o=>normQ((o.number||'')+' '+(o.name||'')+' '+(custName(o.customerId)||'')).includes(q)); if(!o) return {error:'Δεν βρέθηκε παραγγελία'};
    return {...aiOrderBrief(o), lines:(o.lines||[]).map(l=>({product:l.pid?prodName(l.pid):l.name, qty:num(l.qty), note:l.note||undefined})), crew:(o.crew||[]).map(a=>({name:D.crew[a.cid]?.name||'', role:a.role||'', start:a.start, end:a.end, hours:(a.from||'')+'-'+(a.to||'')})), notes:o.notes||''}; }
  if(name==='search_customers'){ const q=normQ(x.query||''); return Object.values(D.customers).filter(c=>normQ([c.name,c.company,c.phone,c.email,c.vat].join(' ')).includes(q)).slice(0,15).map(c=>({name:c.name, company:c.company||'', phone:c.phone||'', email:c.email||'', vat:c.vat||'', orders:Object.values(D.orders).filter(o=>o.customerId===c.id).length})); }
  if(name==='crew_schedule'){ const a=x.from||t, b=x.to||a; const out=[]; for(const o of Object.values(D.orders)){ if(o.status==='cancelled') continue; for(const s of o.crew||[]){ const s1=s.start||o.start, s2=s.end||s1; if(s1<=b&&s2>=a) out.push({name:D.crew[s.cid]?.name||'', role:s.role||'', start:s1, end:s2, hours:(s.from||'')+'-'+(s.to||''), order:o.number, title:o.name||custName(o.customerId)||''}); } } return sortBy(out,x=>x.start); }
  if(name==='product_orders'){ const a=x.from||t, b=x.to||a; return Object.values(D.orders).filter(o=>o.status!=='cancelled'&&o.start&&o.start<=b&&(o.end||o.start)>=a).map(o=>({o, q:(o.lines||[]).filter(l=>l.pid===x.product_id).reduce((s,l)=>s+num(l.qty),0)})).filter(z=>z.q>0).map(z=>({...aiOrderBrief(z.o), qty:z.q})); }
  if(name==='customers_with_balance'&&!NOPRICE()){ const m={}; for(const o of Object.values(D.orders)){ if(['cancelled','concept'].includes(o.status)||!o.customerId) continue; const tt=orderTotals(o); if(tt.due>0.009){ (m[o.customerId]=m[o.customerId]||{customer:custName(o.customerId), due:0, orders:[]}); m[o.customerId].due=r2(m[o.customerId].due+tt.due); m[o.customerId].orders.push(o.number); } } return sortBy(Object.values(m),x=>-x.due); }
  return {error:'άγνωστο εργαλείο'};
}
async function aiCall(body){
  const r=await fetch('/api/ai/messages',{method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  let data=null; try{ data=await r.json(); }catch(e){}
  if(!r.ok) throw {error:(data&&data.error)||('Σφάλμα '+r.status)};
  return {data, cost:num(r.headers.get('X-AI-Cost'))};
}
/* βρόχος εργαλείων: επιστρέφει {text, proposal, messages, cost} */
async function aiRun({kind, messages, ctx, onStep}){
  const system=aiSystem(kind, ctx), tools=aiTools(kind); let cost=0, proposal=null, text='';
  for(let step=0; step<12; step++){
    const {data, cost:c}=await aiCall({system, messages, tools}); cost+=c;
    messages.push({role:'assistant', content:data.content});
    const uses=(data.content||[]).filter(b=>b.type==='tool_use');
    text=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim()||text;
    if(data.stop_reason!=='tool_use'||!uses.length) break;
    const results=[];
    for(const u of uses){
      if(u.name==='propose_order'){ proposal=u.input; results.push({type:'tool_result', tool_use_id:u.id, content:'ok'}); continue; }
      onStep&&onStep(u.name, u.input);
      let out; try{ out=aiRunTool(u.name, u.input); }catch(e){ out={error:String(e&&e.message||e)}; }
      results.push({type:'tool_result', tool_use_id:u.id, content:JSON.stringify(out).slice(0,60000)});
    }
    messages.push({role:'user', content:results});
    if(proposal) break;
  }
  AI.status&&(AI.status.spentUSD=num(AI.status.spentUSD)+cost);
  return {text, proposal, messages, cost};
}
const AI_STEP={check_availability:'Ελέγχω διαθεσιμότητα…', list_orders:'Κοιτάζω τις παραγγελίες…', get_order:'Ανοίγω την παραγγελία…', search_customers:'Ψάχνω πελάτες…', crew_schedule:'Κοιτάζω το πρόγραμμα συνεργείου…', product_orders:'Ψάχνω πού είναι κλεισμένο…', customers_with_balance:'Υπολογίζω οφειλές…'};
function aiMd(s){ let h=esc(s||'');
  h=h.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|\n)#{1,4}\s*(.+)/g,'$1<b>$2</b>').replace(/(^|\n)\s*[-•]\s+/g,'$1• ');
  h=h.replace(/\b(ORD-\d{3,})\b/g,(m)=>{ const o=Object.values(D.orders).find(o=>o.number===m); return o?`<a class="lk" href="#order-${o.id}">${m}</a>`:m; });
  return h.replace(/\n/g,'<br>'); }
function aiNotReady(st){ return st&&st.enabled?'':`<div class="card" style="padding:14px;background:#fffaf0;border-color:#f0dca8"><b>Ο βοηθός δεν έχει ρυθμιστεί ακόμα.</b><div class="small muted" style="margin-top:4px">${can('admin')?'Βάλε το κλειδί της Anthropic στις <a class="lk" href="#setup-ai">Ρυθμίσεις → Βοηθός AI</a>.':'Ζήτα από τον διαχειριστή να βάλει το κλειδί της Anthropic στις Ρυθμίσεις.'}</div></div>`; }

/* ---------- συνημμένα (φωτογραφίες, PDF, κείμενο) ---------- */
const AI_MAX_FILE=10*1024*1024;
function aiB64(buf){ let s=''; const b=new Uint8Array(buf); for(let i=0;i<b.length;i+=0x8000) s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(s); }
async function aiImageB64(file){ // μικραίνει μεγάλες φωτογραφίες (λιγότερο κόστος, ίδια ανάγνωση)
  try{ const bmp=await createImageBitmap(file); const k=Math.min(1,1600/Math.max(bmp.width,bmp.height)); if(k>=1&&file.size<3e6&&/jpe?g|png|webp|gif/.test(file.type)) return {media:file.type, data:aiB64(await file.arrayBuffer())};
    const c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k); const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.85)); return {media:'image/jpeg', data:aiB64(await blob.arrayBuffer())}; }
  catch(e){ return {media:file.type, data:aiB64(await file.arrayBuffer())}; } }
async function aiReadFiles(files, list){
  for(const f of files){ const name=f.name||'αρχείο', t=(f.type||'').toLowerCase(), ext=(name.split('.').pop()||'').toLowerCase();
    if(f.size>AI_MAX_FILE){ toast(`«${name}»: πολύ μεγάλο (μέχρι 10 MB).`, true); continue; }
    try{
      if(/^image\//.test(t)){ const im=await aiImageB64(f); list.push({name, kind:'image', media:im.media, data:im.data, size:f.size}); }
      else if(t==='application/pdf'||ext==='pdf') list.push({name, kind:'pdf', data:aiB64(await f.arrayBuffer()), size:f.size});
      else if(/^text\//.test(t)||['txt','csv','md','eml','json','tsv','html','htm','xml'].includes(ext)) list.push({name, kind:'text', text:(await f.text()).slice(0,200000), size:f.size});
      else toast(`«${name}»: αυτός ο τύπος δεν διαβάζεται — στείλε PDF, φωτογραφία ή κείμενο (για Word/Excel: «Αποθήκευση ως PDF»).`, true);
    }catch(e){ toast(`«${name}»: δεν διαβάστηκε.`, true); } }
  return list; }
function aiFileBlocks(list){ return (list||[]).map(f=> f.kind==='image'?{type:'image', source:{type:'base64', media_type:f.media, data:f.data}}
  : f.kind==='pdf'?{type:'document', source:{type:'base64', media_type:'application/pdf', data:f.data}, title:f.name}
  : {type:'text', text:`Συνημμένο αρχείο «${f.name}»:\n${f.text}`}); }
function aiUserContent(text, files){ return files&&files.length?[...aiFileBlocks(files), {type:'text', text:text||'Δες το συνημμένο.'}]:text; }
function aiChips(list, act){ return (list||[]).length?`<div class="aichips">${list.map((f,i)=>`<span class="aichip">${f.kind==='image'?'🖼':f.kind==='pdf'?'📄':'📝'} ${esc(f.name)}${act?` <a href="#" data-act="${act}" data-i="${i}" title="Αφαίρεση">✕</a>`:''}</span>`).join('')}</div>`:''; }
function aiPickFiles(cb){ const inp=document.createElement('input'); inp.type='file'; inp.multiple=true; inp.accept='image/*,application/pdf,.pdf,.txt,.csv,.md,.eml,text/*'; inp.onchange=()=>cb([...inp.files]); inp.click(); }
function aiGrow(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight+2, Math.round(innerHeight*0.45))+'px'; }

/* ---------- βοηθός μέσα στην παραγγελία ---------- */
ACT['ai-order']=async()=>{ const d=UI.draft; if(!d) return; await aiLoadStatus();
  M={type:'aiorder', q:UI.aiLastQ||'', files:[], busy:false, step:'', res:null, err:'', pick:{}, apply:{title:!d.name, venue:!d.venue, dates:false}, redraw:drawAIOrder}; drawAIOrder(); };
function aiOrderCtx(d){ const lines=d.lines.filter(l=>l.pid).map(l=>`${prodName(l.pid)} ×${num(l.qty)}`).join(', ');
  return [d.name?'Τίτλος: '+d.name:'', d.venue?'Χώρος: '+d.venue:'', d.start?`Ημερομηνίες: ${d.start} έως ${d.end||d.start}`:'Ημερομηνίες: δεν έχουν οριστεί', lines?'Ήδη στην παραγγελία: '+lines:'Η παραγγελία είναι άδεια.'].filter(Boolean).join('\n'); }
function drawAIOrder(){ const st=AI.status, d=UI.draft, m=M; const r=m.res; const p=r&&r.proposal;
  let body='';
  if(m.busy) body=`<div class="aiwait"><span class="spin"></span><div><b>Ο βοηθός ετοιμάζει τη λίστα…</b><div class="small muted">${esc(m.step||'Διαβάζω τον κατάλογο…')}</div></div></div>`;
  else if(m.err) body=`<div class="card" style="padding:12px;background:#fff1f0;border-color:#f3c2bd;color:#9b1c1c">${esc(m.err)}</div>`;
  if(!m.busy&&p){ const s=p.start||d.start, e=p.end||p.start||d.end;
    const rows=(p.lines||[]).map((l,i)=>{ const pr=D.products[l.product_id]; if(!pr) return ''; const q=m.pick[i]?.qty??l.qty; const on=m.pick[i]?.on??true; const fr=freeUnits(pr.id,s,e,d.id).free; const already=d.lines.filter(x=>x.pid===pr.id).reduce((a,x)=>a+num(x.qty),0); const rem=fr-q-already;
      return `<tr class="${on?'':'off'}"><td><input type="checkbox" data-aip="${i}" ${on?'checked':''}></td><td><div class="row" style="gap:8px">${prodImg(pr,32)}<div><b>${esc(pr.name)}</b>${l.reason?`<div class="xs muted">${esc(l.reason)}</div>`:''}${already?`<div class="xs" style="color:#8a6a00">ήδη στην παραγγελία: ${already}</div>`:''}</div></div></td><td><span class="avb ${avCls(rem)}" title="Μένουν ${rem} από ${fr}">${rem}/${fr}</span></td><td><input type="number" min="0" class="aiq" data-aiq="${i}" value="${q}"></td></tr>`; }).join('');
    const unknown=(p.lines||[]).filter(l=>!D.products[l.product_id]).length;
    body+=`${p.summary||r.text?`<div class="aisum">${aiMd(p.summary||r.text)}</div>`:''}
      ${(p.warnings||[]).length?`<div class="aiwarn">${p.warnings.map(w=>`<div>⚠ ${esc(w)}</div>`).join('')}</div>`:''}
      ${(p.title||p.venue||p.start)?`<div class="aiapply">${p.title?`<label><input type="checkbox" data-aia="title" ${m.apply.title?'checked':''}> Τίτλος: <b>${esc(p.title)}</b></label>`:''}${p.venue?`<label><input type="checkbox" data-aia="venue" ${m.apply.venue?'checked':''}> Χώρος: <b>${esc(p.venue)}</b></label>`:''}${p.start?`<label><input type="checkbox" data-aia="dates" ${m.apply.dates?'checked':''}> Ημερομηνίες: <b>${fmtD(p.start)}${p.end&&p.end!==p.start?' – '+fmtD(p.end):''}</b></label>`:''}</div>`:''}
      <div class="tw"><table class="aitab"><thead><tr><th></th><th>Προϊόν</th><th>Διαθ.</th><th>Ποσ.</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="muted">Καμία πρόταση.</td></tr>'}</tbody></table></div>
      ${unknown?`<div class="xs muted">${unknown} προτάσεις αγνοήθηκαν (δεν υπάρχουν στον κατάλογο).</div>`:''}
      <div class="xs faint">Κόστος αυτής της πρότασης: ~${r.cost.toFixed(3).replace('.',',')} $</div>`; }
  else if(!m.busy&&r&&!p) body+=`<div class="aisum">${aiMd(r.text||'Ο βοηθός δεν έδωσε λίστα. Δοκίμασε να περιγράψεις πιο συγκεκριμένα.')}</div>`;
  openModal(`<div class="dlg-h"><h2>✨ Βοηθός παραγγελίας</h2><button class="icon" data-act="modal-close">✕</button></div>
  <div class="dlg-b">${aiNotReady(st)}
    <label class="f">Περίγραψε την εκδήλωση (ή επισύναψε το email / PDF του πελάτη)<textarea data-aiq-text rows="4" placeholder="π.χ. Συναυλία Σάββατο στο Δημοτικό Θέατρο Πάτρας, 400 άτομα, live μπάντα 5 ατόμων, φωτισμός σκηνής και LED wall 3×2 μ." ${m.busy?'disabled':''}>${esc(m.q)}</textarea></label>
    ${aiChips(m.files,'ai-of-del')}
    <div class="row" style="gap:8px"><button class="btn" data-act="ai-of-add" ${m.busy?'disabled':''}>📎 Επισύναψη</button><button class="btn pri" data-act="ai-order-run" ${m.busy||!(st&&st.enabled)?'disabled':''}>${p?'↻ Νέα πρόταση':'✨ Ετοίμασε λίστα'}</button><span class="xs muted">Ο βοηθός ελέγχει διαθεσιμότητα${d.start?` για ${fmtD(d.start)}${d.end&&d.end!==d.start?'–'+fmtD(d.end):''}`:''}. Τα συνοδευτικά μπαίνουν αυτόματα.</span></div>
    ${body}
  </div>
  <div class="dlg-f"><button class="btn" data-act="modal-close">Κλείσιμο</button>${p&&!m.busy?'<button class="btn pri" data-act="ai-order-apply" data-primary>Προσθήκη στην παραγγελία</button>':''}</div>`, 'lg'); }
ON_INPUT.push(el=>{ if(!M||M.type!=='aiorder') return false;
  if(el.hasAttribute('data-aiq-text')){ M.q=el.value; return true; }
  if(el.dataset.aiq!==undefined){ const i=+el.dataset.aiq; M.pick[i]={...(M.pick[i]||{on:true}), qty:Math.max(0,Math.round(num(el.value)))}; return true; } return false; });
ON_CHANGE.push(el=>{ if(!M||M.type!=='aiorder') return false;
  if(el.dataset.aip!==undefined){ const i=+el.dataset.aip; M.pick[i]={...(M.pick[i]||{}), on:el.checked}; el.closest('tr').classList.toggle('off',!el.checked); return true; }
  if(el.dataset.aia){ M.apply[el.dataset.aia]=el.checked; return true; }
  return false; });
ACT['ai-of-add']=()=>aiPickFiles(async fs=>{ const m=M; if(!m||m.type!=='aiorder') return; await aiReadFiles(fs, m.files); drawAIOrder(); });
ACT['ai-of-del']=(el,e)=>{ e&&e.preventDefault(); M.files.splice(+el.dataset.i,1); drawAIOrder(); };
ACT['ai-order-run']=async()=>{ const m=M, d=UI.draft; const q=(m.q||'').trim(); if(!q&&!m.files.length) return toast('Γράψε τι θέλεις για την εκδήλωση ή επισύναψε αρχείο.', true);
  UI.aiLastQ=q; m.busy=true; m.err=''; m.res=null; m.pick={}; m.step=''; drawAIOrder();
  UI.aiExclude=d.id;
  try{ m.res=await aiRun({kind:'order', ctx:aiOrderCtx(d), messages:[{role:'user', content:aiUserContent(q, m.files)}], onStep:(n)=>{ if(M===m){ m.step=AI_STEP[n]||'Δουλεύω…'; const w=document.querySelector('.aiwait .small'); if(w) w.textContent=m.step; } }});
    const p=m.res.proposal; if(p&&p.start&&!d.start) m.apply.dates=true; }
  catch(e){ m.err=e.error||String(e); }
  UI.aiExclude=null; m.busy=false; if(M===m) drawAIOrder(); aiLoadStatus(true); };
ACT['ai-order-apply']=()=>{ const m=M, d=UI.draft, p=m.res&&m.res.proposal; if(!p||!d) return;
  if(m.apply.title&&p.title) d.name=p.title; if(m.apply.venue&&p.venue) d.venue=p.venue;
  if(m.apply.dates&&p.start){ d.start=p.start; d.end=p.end||p.start; }
  let n=0; (p.lines||[]).forEach((l,i)=>{ const pk=m.pick[i]||{}; if(pk.on===false||!D.products[l.product_id]) return; const q=pk.qty??l.qty; if(q>0){ addProductLine(l.product_id, q); n++; } });
  closeModal(); dirty(); toast(`Προστέθηκαν ${n} προϊόντα από τον βοηθό`); };

/* ---------- σελίδα ερωτήσεων ---------- */
VIEWS.ai = () => {
  if(!AI.status){ aiLoadStatus().then(()=>{ if(route()==='ai') render(); }); }
  const st=AI.status; const chat=UI.aiChat||[];
  const ex=['Τι μικρόφωνα έχουμε ελεύθερα την Παρασκευή;','Ποιες παραγγελίες έχουμε αυτή την εβδομάδα;','Ποιος από το συνεργείο δουλεύει το Σάββατο;'].concat(NOPRICE()?[]:['Ποιοι πελάτες μάς χρωστάνε;']);
  return `<div class="ph"><div><h1>✨ Βοηθός</h1><p class="sub">Ρώτα ό,τι θέλεις για την αποθήκη, τις παραγγελίες και το συνεργείο</p></div>${chat.length?'<button class="btn" data-act="ai-clear">Νέα συζήτηση</button>':''}</div>
  ${aiNotReady(st)}
  <div class="card aichat" id="aiChat">${chat.length?chat.map(m=>`<div class="aimsg ${m.role}">${m.files&&m.files.length?aiChips(m.files.map(n=>({name:n.name,kind:n.kind}))):''}${m.role==='user'?esc(m.text):aiMd(m.text)}${m.cost?`<div class="xs faint" style="margin-top:4px">~${m.cost.toFixed(3).replace('.',',')} $</div>`:''}</div>`).join(''):`<div class="aiex"><div class="small muted" style="margin-bottom:8px">Για παράδειγμα:</div>${ex.map(q=>`<button class="chip" data-act="ai-ex" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
    ${AI.busy?`<div class="aimsg assistant"><span class="spin"></span> <span class="small muted" id="aiStep">${esc(AI.step||'Σκέφτομαι…')}</span></div>`:''}</div>
  <div class="aiinput" id="aiDrop">${aiChips(UI.aiFiles,'ai-f-del')}<textarea id="aiQ" rows="4" placeholder="Γράψε την ερώτησή σου… (Enter για αποστολή, Shift+Enter για νέα γραμμή — μπορείς να επικολλήσεις ή να σύρεις εδώ φωτογραφίες και PDF)" ${AI.busy?'disabled':''}>${esc(UI.aiDraft||'')}</textarea>
    <div class="row between"><button class="btn" data-act="ai-f-add" ${AI.busy?'disabled':''}>📎 Επισύναψη αρχείου</button><button class="btn pri" data-act="ai-send" ${AI.busy||!(st&&st.enabled)?'disabled':''}>Αποστολή ➤</button></div></div>`;
};
ACT['ai-ex']=el=>{ UI.aiDraft=el.dataset.q; ACT['ai-send'](); };
ACT['ai-clear']=()=>{ UI.aiChat=[]; UI.aiMsgs=[]; render(); };
ON_INPUT.push(el=>{ if(el.id==='aiQ'){ UI.aiDraft=el.value; aiGrow(el); return true; } if(el.hasAttribute&&el.hasAttribute('data-aiq-text')) aiGrow(el); return false; });
ACT['ai-f-add']=()=>aiPickFiles(async fs=>{ UI.aiFiles=await aiReadFiles(fs, UI.aiFiles||[]); render(); aiScroll(); });
ACT['ai-f-del']=(el,e)=>{ e&&e.preventDefault(); (UI.aiFiles||[]).splice(+el.dataset.i,1); render(); };
document.addEventListener('paste', async e=>{ const onChat=e.target&&e.target.id==='aiQ', onOrd=M&&M.type==='aiorder'; if(!onChat&&!onOrd) return;
  const fs=[...(e.clipboardData?.items||[])].filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean); if(!fs.length) return; e.preventDefault();
  if(onOrd){ await aiReadFiles(fs, M.files); drawAIOrder(); } else { UI.aiFiles=await aiReadFiles(fs, UI.aiFiles||[]); render(); aiScroll(); } });
document.addEventListener('dragover', e=>{ if(e.target.closest&&(e.target.closest('#aiDrop')||e.target.closest('#aiChat')||(M&&M.type==='aiorder'&&e.target.closest('.dlg')))) e.preventDefault(); });
document.addEventListener('drop', async e=>{ const ord=M&&M.type==='aiorder'&&e.target.closest&&e.target.closest('.dlg'); const chat=e.target.closest&&(e.target.closest('#aiDrop')||e.target.closest('#aiChat')); if(!ord&&!chat) return; const fs=[...(e.dataTransfer?.files||[])]; if(!fs.length) return; e.preventDefault();
  if(ord){ await aiReadFiles(fs, M.files); drawAIOrder(); } else { UI.aiFiles=await aiReadFiles(fs, UI.aiFiles||[]); render(); aiScroll(); } });
document.addEventListener('keydown', e=>{ if(e.target&&e.target.id==='aiQ'&&e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); ACT['ai-send'](); } });
ACT['ai-send']=async()=>{ const q=(UI.aiDraft||'').trim(); const files=UI.aiFiles||[]; if((!q&&!files.length)||AI.busy) return;
  UI.aiChat=UI.aiChat||[]; UI.aiMsgs=UI.aiMsgs||[]; UI.aiChat.push({role:'user', text:q, files:files.map(f=>({name:f.name, kind:f.kind}))}); UI.aiDraft=''; UI.aiFiles=[]; AI.busy=true; AI.step=''; render(); aiScroll();
  let st0=Math.max(0,UI.aiMsgs.length-30); const isQ=m=>m.role==='user'&&(typeof m.content==='string'||(Array.isArray(m.content)&&!m.content.some(b=>b.type==='tool_result')));
  while(st0<UI.aiMsgs.length&&!isQ(UI.aiMsgs[st0])) st0++;
  const msgs=UI.aiMsgs.slice(st0); msgs.push({role:'user', content:aiUserContent(q, files)});
  try{ const r=await aiRun({kind:'ask', messages:msgs, onStep:n=>{ AI.step=AI_STEP[n]||'Δουλεύω…'; const s=$('#aiStep'); if(s) s.textContent=AI.step; }});
    UI.aiMsgs=r.messages; UI.aiChat.push({role:'assistant', text:r.text||'—', cost:r.cost}); }
  catch(e){ UI.aiChat.push({role:'assistant', text:'⚠ '+(e.error||String(e))}); }
  AI.busy=false; render(); aiScroll(); aiLoadStatus(true); };
function aiScroll(){ setTimeout(()=>{ const c=$('#aiChat'); if(c) c.scrollTop=c.scrollHeight; const q=$('#aiQ'); if(q){ aiGrow(q); if(!isM()) q.focus(); } },30); }

/* ---------- ρυθμίσεις (διαχειριστής) ---------- */
function aiSetupBody(){ const st=AI.status;
  if(!st){ aiLoadStatus(true).then(()=>render()); return '<div class="muted">Φόρτωση…</div>'; }
  const pct=st.budgetUSD?Math.min(100,Math.round(st.spentUSD/st.budgetUSD*100)):0;
  return `<div class="small muted">Ο βοηθός χρησιμοποιεί το Claude της Anthropic (μοντέλο ${esc(st.model||'')}). Χρεώνεται ανά χρήση στον λογαριασμό σας στην Anthropic.</div>
  <div class="aistat"><div><div class="xs muted">Κατάσταση</div><b>${st.enabled?'✅ Ενεργός':'⏸ Χωρίς κλειδί'}</b>${st.keyHint?`<div class="xs faint mono">${esc(st.keyHint)}</div>`:''}</div>
    <div><div class="xs muted">Κόστος ${esc(st.month||'')}</div><b>${num(st.spentUSD).toFixed(2).replace('.',',')} $</b> <span class="xs muted">από ${num(st.budgetUSD).toFixed(0)} $ · ${st.calls||0} κλήσεις</span><div class="aibar"><i style="width:${pct}%"></i></div></div></div>
  <label class="f">Κλειδί Anthropic API<input type="password" id="aiKey" autocomplete="off" placeholder="${st.enabled?'•••••• (κράτα κενό για να μην αλλάξει)':'sk-ant-…'}"></label>
  <div class="xs muted">Το βγάζεις από το <b>console.anthropic.com → API Keys</b>. Αποθηκεύεται μόνο στον server — δεν το βλέπει κανένας χρήστης και δεν μπαίνει στα αντίγραφα ασφαλείας.</div>
  <label class="f" style="max-width:220px">Μηνιαίο όριο κόστους ($)<input type="number" min="1" max="1000" step="1" id="aiBudget" value="${num(st.budgetUSD)||20}"></label>
  <div class="row" style="gap:8px"><button class="btn pri" data-act="ai-save">Αποθήκευση</button>${st.enabled?'<button class="btn" data-act="ai-test">Δοκιμή</button><button class="btn dangerous" data-act="ai-remove">Αφαίρεση κλειδιού</button>':''}</div>
  ${(st.history||[]).length?`<div class="xs muted">Προηγούμενοι μήνες: ${st.history.slice(-6).map(h=>`${h.month}: ${num(h.spentUSD).toFixed(2).replace('.',',')} $`).join(' · ')}</div>`:''}`; }
ACT['ai-save']=async()=>{ const k=($('#aiKey')?.value||'').trim(), b=num($('#aiBudget')?.value);
  const body={budgetUSD:b}; if(k) body.key=k;
  try{ AI.status=await api('/api/ai/config', body); toast('Αποθηκεύτηκε'); render(); }catch(e){ toast(e.error, true); } };
ACT['ai-remove']=()=>confirmBox('Αφαίρεση κλειδιού;','Ο βοηθός θα σταματήσει να λειτουργεί μέχρι να βάλεις νέο κλειδί.','Αφαίρεση', async()=>{ try{ AI.status=await api('/api/ai/config',{key:''}); render(); }catch(e){ toast(e.error,true); } });
ACT['ai-test']=async()=>{ toast('Δοκιμή…'); try{ const {data,cost}=await aiCall({messages:[{role:'user',content:'Απάντησε μόνο με τη λέξη: Εντάξει'}]}); const t=(data.content||[]).map(b=>b.text||'').join(''); toast('Ο βοηθός απάντησε: '+t.slice(0,40)+` (~${cost.toFixed(4)} $)`); aiLoadStatus(true).then(render); }catch(e){ toast(e.error, true); } };
