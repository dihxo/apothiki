/* ===================== ARTIFACT BACKEND (κοινόχρηστη βάση μέσα στο Claude) ===================== */
'use strict';
const COLLS = ['categories','products','units','customers','orders','maintenance','settings'];
const AS = { db:null, user:null, dl:null, assets:null };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function bootArtifact(){
  $('#root').innerHTML='<div class="empty"><b>Φόρτωση…</b></div>';
  let slow=setTimeout(()=>{ if(!UI.ready) $('#root').innerHTML='<div class="empty"><b>Η σύνδεση με τη βάση αργεί…</b>Τα δεδομένα δεν είναι ακόμη διαθέσιμα. Έλεγξε τη σύνδεσή σου.</div>'; },10000);
  let db=null; try{ db=await claude.use('db'); }catch(e){}
  if(!db){ clearTimeout(slow); $('#root').innerHTML='<div class="empty"><b>Η βάση δεδομένων δεν είναι διαθέσιμη εδώ</b>Άνοιξε τη σελίδα στο claude.ai συνδεδεμένος με τον λογαριασμό σου.</div>'; return; }
  AS.db=db;
  try{ AS.user=await claude.use('user'); }catch(e){}
  try{ AS.dl=await claude.use('downloads'); }catch(e){}
  try{ AS.assets=await claude.use('assets'); }catch(e){}
  // ρόλος από το sharing του Claude
  let role='staff', id='', name='';
  if(AS.user){
    try{ if(await AS.user.canEdit()) role='admin'; else if((await AS.user.can('data.write'))===false) role='viewer'; }catch(e){}
    try{ id=await AS.user.id()||''; }catch(e){}
    try{ const me=await AS.user.me(); name=(me&&me.name)||''; }catch(e){}
  }
  if(id && name) NAMES[id]=name;
  UI.me={id, name:name||'Χρήστης', username:name, role};
  const loaded={};
  for(const c of COLLS){
    db.collection(c).onSnapshot(snap=>{
      const m={}; for(const d of snap.docs) m[d.id]={...d.data(), id:d.id};
      D[c]=m; if(!snap.metadata.fromCache) loaded[c]=true;
      if(!UI.ready && COLLS.every(k=>loaded[k])){ UI.ready=true; clearTimeout(slow); layout(); render(); }
      else if(UI.ready) bump();
      UI.online=true; updateConn();
    }, err=>{ if(err.code==='revoked'){ UI.online=false; updateConn(); } else toast('Σφάλμα σύνδεσης: '+err.message, true); loaded[c]=true; if(!UI.ready && COLLS.every(k=>loaded[k])){ UI.ready=true; clearTimeout(slow); layout(); render(); } });
  }
}

if(!SERVER){
  api = async () => { throw {error:'Μη διαθέσιμο σε αυτή την έκδοση'}; };
  loadState = async () => {};
  connectEvents = () => {};

  const errMsg = e => { const c=e&&e.code;
    if(c==='invalid_argument') return 'Η αλλαγή απορρίφθηκε — ίσως δεν έχεις δικαίωμα επεξεργασίας.';
    if(c==='quota_exceeded') return 'Γέμισε ο χώρος της βάσης: '+(e.message||'');
    if(c==='resource_exhausted') return 'Πολλές αλλαγές ταυτόχρονα — δοκίμασε ξανά σε λίγο.';
    return 'Σφάλμα αποθήκευσης: '+((e&&e.message)||c||e); };
  async function writeOp(o, retry=true){
    const ref=AS.db.doc(o.coll+'/'+o.id);
    try{ if(o.op==='del') await ref.delete(); else await ref.set(o.full); }
    catch(e){ if(e&&e.code==='unavailable'&&retry){ await sleep(300+Math.random()*600); return writeOp(o,false); } throw e; }
  }
  async function runOps(ops){ // έως 4 ταυτόχρονες εγγραφές, ποτέ δύο στο ίδιο έγγραφο
    let i=0; const busy=new Set();
    const worker=async()=>{ while(i<ops.length){ const o=ops[i++]; const k=o.coll+'/'+o.id; while(busy.has(k)) await sleep(20); busy.add(k); try{ await writeOp(o); } finally{ busy.delete(k); } } };
    await Promise.all([...Array(Math.min(4,ops.length))].map(worker));
  }
  commit = async (ops, summary, quiet) => {
    if(!can('staff')){ toast('Έχεις δικαίωμα μόνο ανάγνωσης.', true); return false; }
    const now=Date.now();
    for(const o of ops){ if(o.op==='put'){ const prev=D[o.coll][o.id]; o.full={...deepCopy(o.doc), updatedAt:now, updatedBy:UI.me.id||'', createdAt:prev?.createdAt||now}; delete o.full.id; } }
    try{
      await runOps(ops);
      for(const o of ops){ if(o.op==='del') delete D[o.coll][o.id]; else D[o.coll][o.id]={...o.full, id:o.id}; }
      bump();
      if(summary){ appendLog(summary); if(!quiet) toast(summary); }
      return true;
    }catch(e){ toast(errMsg(e), true); return false; }
  };

  /* αρίθμηση με σύντομο κλείδωμα για να μη δοθεί ίδιος αριθμός σε δύο χρήστες */
  const maxExisting = name => { const grab=(arr)=>Math.max(0,...arr.map(v=>parseInt(String(v||'').replace(/\D+/g,''))||0));
    if(name==='order') return grab(Object.values(D.orders).map(o=>o.number));
    if(name==='quote') return grab(Object.values(D.orders).map(o=>o.quoteNo));
    if(name==='invoice') return grab(Object.values(D.orders).map(o=>o.invoiceNo));
    if(name==='maintenance') return grab(Object.values(D.maintenance).map(m=>m.number));
    return 0; };
  nextNumber = async name => {
    const ref=AS.db.doc('counters/'+name), holder=(UI.me.id||'')+uid('h');
    for(let t=0;t<25;t++){
      let r=null; try{ r=await ref.acquire({holder, ttlMs:5000}); }catch(e){ break; }
      if(r && r.acquired){ const s=await ref.get(); const n=Math.max((s.exists&&+s.data().n)||0, maxExisting(name))+1; await ref.set({n}); return n; }
      await sleep(250+Math.random()*400);
    }
    return maxExisting(name)+1;
  };

  /* ιστορικό: ένα έγγραφο ανά ημέρα */
  let logQ=Promise.resolve();
  function appendLog(summary){
    logQ=logQ.then(async()=>{ try{ const day=today(); const ref=AS.db.doc('log/'+day); const s=await ref.get(); const entries=(s.exists&&s.data().entries)||[];
      entries.push({ts:Date.now(), user:UI.me.id||'', summary:String(summary).slice(0,300)}); await ref.set({day, entries:entries.slice(-800)}); }catch(e){} });
  }
  loadLog = async () => {
    const snap=await AS.db.collection('log').orderBy('day','desc').limit(30).get();
    const out=[]; for(const d of snap.docs) for(const e of (d.data().entries||[])) out.push(e);
    out.sort((a,b)=>b.ts-a.ts);
    const ids=[...new Set(out.map(e=>e.user).filter(x=>x&&!NAMES[x]))]; await resolveNames(ids);
    return out.slice(0,600);
  };
  async function resolveNames(ids){ if(!ids.length||!AS.user||!AS.user.profiles) return; try{ const ps=await AS.user.profiles(ids); for(const id of ids) if(ps[id]&&ps[id].name) NAMES[id]=ps[id].name; }catch(e){} }
  let pendingNames=new Set(), nameTimer=null;
  whoName = v => { if(!v) return ''; if(NAMES[v]) return NAMES[v]; if(/\s/.test(v)) return v; pendingNames.add(v); clearTimeout(nameTimer); nameTimer=setTimeout(async()=>{ const ids=[...pendingNames]; pendingNames=new Set(); await resolveNames(ids); if(ids.some(i=>NAMES[i])) scheduleRender(); },50); return 'συνεργάτη'; };

  /* εικόνες: αποθήκευση ως αρχεία της σελίδας */
  storeImage = async blob => { if(!AS.assets) throw {error:'Δεν έχεις δικαίωμα να ανεβάζεις εικόνες.'}; try{ const r=await AS.assets.upload(blob); return r.url || ('/_blob/'+r.id); }catch(e){ throw {error:'Η εικόνα δεν ανέβηκε: '+((e&&e.message)||e)}; } };
  /* αρχεία: μέσω του Claude */
  download = async (filename, content, type) => {
    if(!AS.dl){ toast('Η λήψη αρχείων δεν είναι διαθέσιμη σε αυτή την προβολή.', true); return; }
    try{ await AS.dl.save({filename, data: content instanceof Blob ? content : String(content)}); toast('Το αρχείο αποθηκεύτηκε'); }
    catch(e){ if(e&&e.code==='declined') return; toast('Δεν έγινε λήψη: '+((e&&e.message)||e), true); }
  };
  /* εκτύπωση: προεπισκόπηση + λήψη αρχείου για εκτύπωση */
  printHTML = (title, body, extraCss='') => {
    const html=`<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  *{box-sizing:border-box} body{font-family:Inter,Arial,sans-serif;color:#111;margin:0;padding:14mm;font-size:10.5pt}
  h1{font-size:20pt;margin:0} table{width:100%;border-collapse:collapse;margin-top:6mm} th{text-align:left;border-bottom:1.5px solid #111;padding:2mm 1.5mm;font-size:9pt}
  td{border-bottom:1px solid #ddd;padding:2mm 1.5mm;vertical-align:top} .r{text-align:right} .muted{color:#666} .row{display:flex;justify-content:space-between;gap:10mm}
  .box{border:1px solid #ddd;border-radius:3mm;padding:4mm;flex:1} .tot{margin-left:auto;width:75mm;margin-top:4mm} .tot div{display:flex;justify-content:space-between;padding:1mm 0}
  .tot .g{font-weight:700;font-size:13pt;border-top:1.5px solid #111;padding-top:2mm} .sig{display:flex;gap:20mm;margin-top:22mm} .sig div{flex:1;border-top:1px solid #111;padding-top:2mm;text-align:center;font-size:9pt}
  @media print{body{padding:0}} @page{margin:12mm} ${extraCss}</style></head><body>${body}<script>if(location.protocol==='file:')setTimeout(()=>print(),400)<\/script></body></html>`;
    const fname=(title||'eggrafo').replace(/[^\p{L}\p{N}\- ]+/gu,'').trim().replace(/\s+/g,'-')+'.html';
    M={type:'print', html, fname};
    openModal(`<div class="dlg-h"><h2>${esc(title)}</h2><button class="icon" data-act="modal-close">✕</button></div>
      <div style="padding:0 20px"><iframe id="printFrame" style="width:100%;height:62vh;border:1px solid var(--line);border-radius:8px;margin-top:14px;background:#fff"></iframe></div>
      <div class="dlg-f"><span class="small muted" style="margin-right:auto;align-self:center">Κατέβασε το αρχείο και άνοιξέ το — η εκτύπωση (ή «Αποθήκευση ως PDF») ανοίγει αυτόματα.</span><button class="btn" data-act="modal-close">Κλείσιμο</button><button class="btn pri" data-act="print-dl" data-primary>⬇ Λήψη για εκτύπωση / PDF</button></div>`,'lg');
    const fr=$('#printFrame'); if(fr) fr.srcdoc=html;
  };
  ACT['print-dl']=()=>{ if(M&&M.type==='print') download(M.fname, M.html, 'text/html'); };

  /* κάμερα: μέσα στο Claude δεν επιτρέπεται ζωντανή κάμερα — φωτογραφία του κωδικού */
  openCamera = (onCode) => {
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.capture='environment';
    inp.onchange=async()=>{ const f=inp.files[0]; if(!f) return; const c=await decodeFile(f); if(c) onCode(c); else toast('Δεν εντοπίστηκε QR στη φωτογραφία. Δοκίμασε πιο κοντά και με καλό φως.', true); };
    inp.click();
  };

  /* αντίγραφα ασφαλείας — ίδια μορφή με τον server, για μεταφορά αργότερα */
  buildBackup = async () => {
    const colls={}; for(const c of COLLS){ colls[c]={}; for(const [id,d] of Object.entries(D[c])) colls[c][id]={...d}; }
    // οι εικόνες μπαίνουν μέσα στο αντίγραφο, ώστε να μεταφέρονται και σε server
    for(const p of Object.values(colls.products)){ if(p.image && !p.image.startsWith('data:')){ try{ const b=await (await fetch(p.image)).blob(); p.image=await blobToDataURL(b); }catch(e){} } }
    const counters={}; try{ const s=await AS.db.collection('counters').get(); for(const d of s.docs) counters[d.id]=+d.data().n||0; }catch(e){}
    return {version:1, source:'claude-artifact', exportedAt:new Date().toISOString(), colls, counters, log:[]};
  };
  restoreBackup = async (data) => {
    if(!data||!data.colls) throw {error:'Το αρχείο δεν είναι έγκυρο αντίγραφο ασφαλείας'};
    const ops=[];
    // εικόνες μέσα στο αντίγραφο → ανέβασμα ως αρχεία
    const prods=data.colls.products||{}; const withImg=Object.values(prods).filter(p=>p.image&&p.image.startsWith('data:'));
    if(withImg.length && AS.assets){ let k=0; for(const p of withImg){ try{ p.image=await storeImage(dataURLtoBlob(p.image)); }catch(e){ p.image=''; } if(++k%20===0) toast(`Εικόνες ${k}/${withImg.length}…`); } }
    for(const c of COLLS){ const src=data.colls[c]||{};
      for(const id of Object.keys(D[c])) if(!src[id]) ops.push({op:'del',coll:c,id});
      for(const [id,d] of Object.entries(src)){ if(!/^[A-Za-z0-9_\-]+$/.test(id)) continue; const doc={...d}; delete doc.id; ops.push({op:'put',coll:c,id,doc}); } }
    toast(`Επαναφορά ${ops.length} εγγραφών…`);
    if(!(await commit(ops,'Επαναφορά αντιγράφου ασφαλείας',true))) throw {error:'Η επαναφορά δεν ολοκληρώθηκε'};
    for(const [k,n] of Object.entries(data.counters||{})) if(/^[A-Za-z0-9_\-]+$/.test(k)) try{ await AS.db.doc('counters/'+k).set({n:+n||0}); }catch(e){}
  };
}
