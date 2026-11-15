/* ===================== Έγγραφα σε PDF ===================== */
const PC={ink:'#1d1d1f', mute:'#6b6b70', faint:'#a1a1a6', line:'#e6e6e6', gold:'#a07c00', brand:'#f2c428', card:'#fafaf7', zebra:'#fbfbf8', dark:'#191919', sec:'#fdf3cf'};
const GR_DOW3=['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
const wdD=d0=>{ const x=new Date(d0+'T00:00:00'); return GR_DOW3[x.getDay()]+' '+fmtD(d0); };
function UP(s){ return String(s??'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC'); }
function pdfSafe(s){ return String(s??'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\s+/g,' ').trim(); }
async function pdfLogo(){ return LOGO ? await pdfImage(LOGO, 900) : null; }

/* κεφαλίδα κοινή για τα έγγραφα παραγγελίας — επιστρέφει το y κάτω από αυτήν */
function pdfDocHead(P, logo, title, meta){
  const s=settings(), L=14, R=P.W-14; let yl=14;
  if(logo){ const r=P.imageFit(logo, L, 12, 62, 18, 'left'); yl=12+r.h+4; } else { P.text(L,22,s.name||'',{size:18,bold:true}); yl=27; }
  P.text(L, yl+1, pdfSafe(s.name), {size:9,bold:true}); yl+=4.6;
  for(const ln of [[s.address,s.city].filter(Boolean).join(', '), [s.phone?'Τηλ. '+s.phone:'', s.email].filter(Boolean).join(' · '), [s.vat?'ΑΦΜ '+s.vat:'', s.doy?'ΔΟΥ '+s.doy:''].filter(Boolean).join(' · ')]) if(ln){ P.text(L, yl, pdfSafe(ln), {size:8,color:PC.mute}); yl+=3.8; }
  P.text(R, 21, title, {size:15,bold:true,align:'right',spacing:1.2});
  let yr=28; for(const [k,v] of meta){ P.text(R-28, yr, k, {size:8,color:PC.faint,align:'right'}); P.text(R, yr, v, {size:8.5,bold:true,align:'right'}); yr+=4.3; }
  const y=Math.max(yl, yr)+3; P.rect(L, y, R-L, 1.2, {fill:PC.brand, r:0.6}); return y+6;
}
function pdfCards(P, y, cards){ // [{lab, big, lines[]}]
  const L=14, R=P.W-14, gap=5, w=(R-L-gap*(cards.length-1))/cards.length; const inner=w-8;
  const lay=cards.map(c=>{ const bl=P.wrap(pdfSafe(c.big)||'—', inner, 11.5, true); const ls=[]; for(const l of c.lines.filter(Boolean)) ls.push(...P.wrap(pdfSafe(l.t||l), inner, 8.6, !!l.b).map(t=>({t,b:!!l.b}))); return {bl, ls}; });
  const h=Math.max(...lay.map(x=>7+x.bl.length*5+x.ls.length*4))+4;
  cards.forEach((c,i)=>{ const x=L+i*(w+gap); P.rect(x,y,w,h,{fill:PC.card, stroke:'#eeeeea', lw:0.25, r:2.5});
    P.text(x+4, y+5.5, UP(c.lab), {size:7,bold:true,color:PC.gold,spacing:1.1});
    let yy=y+11; for(const t of lay[i].bl){ P.text(x+4,yy,t,{size:11.5,bold:true}); yy+=5; }
    for(const l of lay[i].ls){ P.text(x+4,yy,l.t,{size:8.6,color:l.b?PC.ink:'#555',bold:l.b}); yy+=4; } });
  return y+h;
}
function pdfFooters(P){ const s=settings(); const n=P.pages.length; P.pages.forEach((pg,i)=>{ P.cur=pg; const y=P.H-8;
  P.line(14, y-4.5, P.W-14, y-4.5, {color:'#eeeeee'}); P.text(P.W/2, y, pdfSafe([s.name,s.phone,s.email,s.website].filter(Boolean).join('  ·  ')), {size:7.5,color:PC.faint,align:'center'});
  if(n>1) P.text(P.W-14, y, `Σελίδα ${i+1} / ${n}`, {size:7.5,color:PC.faint,align:'right'}); }); }

/* πίνακας με αλλαγή σελίδας και επανάληψη κεφαλίδας */
function pdfTable(P, y, cols, rows, o={}){ // cols:[{t,w,align}] (w σε mm, ένα με w:0 = υπόλοιπο) · rows: [{cells:[...], h, draw?, sec?}]
  const L=14, R=P.W-14; const fixed=cols.reduce((a,c)=>a+(c.w||0),0); cols.forEach(c=>{ if(!c.w) c._w=R-L-fixed; else c._w=c.w; });
  const xs=[]; let x=L; for(const c of cols){ xs.push(x); x+=c._w; }
  const head=()=>{ cols.forEach((c,i)=>{ if(!c.t) return; const tx=c.align==='right'?xs[i]+c._w-2:(c.align==='center'?xs[i]+c._w/2:xs[i]+2); P.text(tx, y+4, UP(c.t), {size:6.8,bold:true,color:PC.mute,align:c.align,spacing:0.5}); });
    y+=6.5; P.line(L,y,R,y,{color:PC.ink,lw:0.45}); y+=0.5; };
  head(); let zi=0;
  for(const r of rows){
    if(y+r.h>P.H-(o.bottom||22)){ P.addPage(P.W,P.H); y=16; head(); }
    if(r.sec){ P.rect(L,y,R-L,6,{fill:PC.sec}); P.text(L+2,y+4.2,UP(r.sec),{size:6.8,bold:true,color:'#7a5b00',spacing:0.8}); y+=6; zi=0; continue; }
    if(o.zebra&&(zi++%2)) P.rect(L,y,R-L,r.h,{fill:PC.zebra});
    r.draw(xs.map((x,i)=>({x, w:cols[i]._w, right:x+cols[i]._w-2, left:x+2, center:x+cols[i]._w/2})), y);
    y+=r.h; P.line(L,y,R,y,{color:PC.line,lw:0.2});
  }
  return y;
}

async function pdfOrderDoc(o, kind){
  const titles={quote:'ΠΡΟΣΦΟΡΑ', delivery:'ΔΕΛΤΙΟ ΑΠΟΣΤΟΛΗΣ', invoice:'ΠΡΟΤΙΜΟΛΟΓΙΟ', contract:'ΣΥΜΦΩΝΗΤΙΚΟ ΕΝΟΙΚΙΑΣΗΣ'};
  const fnames={quote:'Προσφορά', delivery:'Δελτίο αποστολής', invoice:'Προτιμολόγιο', contract:'Συμφωνητικό'};
  const s=settings(), c=D.customers[o.customerId]||{}, tt=orderTotals(o);
  const no = kind==='invoice'?o.invoiceNo:'';
  const valid=kind==='quote'?addDays(today(), +(s.quoteValidity||15)):'';
  const cn=c.company||c.name||'';
  await makePDF(titles[kind]+' '+o.number, `${fnames[kind]} ${o.number}${cn?' '+cn:''}.pdf`, async P=>{
    const logo=await pdfLogo();
    const imgs={}; if(kind!=='delivery') await Promise.all(o.lines.map(async l=>{ const p=D.products[l.pid]; const src=imgSrc(p); if(src) imgs[l.id||l.pid]=await pdfImage(src, 220); }));
    P.addPage(210,297);
    const meta=[]; if(no) meta.push(['Αριθμός',no]); meta.push(['Ημερομηνία',fmtD(today())],['Παραγγελία',o.number]); if(valid) meta.push(['Ισχύει έως',fmtD(valid)]);
    let y=pdfDocHead(P, logo, titles[kind], meta);
    y=pdfCards(P, y, [
      {lab:'Προς', big:cn||'—', lines:[c.company&&c.name?c.name:'', [c.address,c.city].filter(Boolean).join(', '), [c.vat?'ΑΦΜ '+c.vat:'', c.doy?'ΔΟΥ '+c.doy:''].filter(Boolean).join(' · '), [c.phone,c.email].filter(Boolean).join(' · ')]},
      {lab:'Εκδήλωση', big:o.name||'—', lines:[o.venue?'Χώρος: '+o.venue:'', {t:`${wdD(o.start)} ${o.startTime||''} → ${wdD(o.end)} ${o.endTime||''}`, b:true}, `${tt.days} ${tt.days===1?'ημέρα':'ημέρες'} ενοικίασης`]}
    ])+7;
    if(kind==='delivery'){
      const need=expandLines(o.lines);
      const rows=Object.entries(need).map(([pid,q])=>{ const p=D.products[pid]||{}; const us=(o.picked?.units||[]).filter(id=>D.units[id]?.productId===pid).map(id=>D.units[id].code+(D.units[id].serial?' ('+D.units[id].serial+')':'')).join(', ');
        const nl=P.wrap(pdfSafe(p.name), 70, 9.4, true), ul=us?P.wrap(us, 46, 7.6):[]; const h=Math.max(nl.length*4.2+(p.location?3.8:0), ul.length*3.4)+5;
        return {h, draw:(C,y)=>{ P.text(C[0].left,y+5,p.sku||'',{size:7.8,color:PC.mute,maxW:C[0].w-3}); nl.forEach((t,i)=>P.text(C[1].left,y+5+i*4.2,t,{size:9.4,bold:true})); if(p.location) P.text(C[1].left,y+5+nl.length*4.2,'Θέση: '+pdfSafe(p.location),{size:7.6,color:PC.mute});
          ul.forEach((t,i)=>P.text(C[2].left,y+5+i*3.4,t,{size:7.6,color:'#444'})); P.text(C[3].right,y+5,String(q),{size:9.4,bold:true,align:'right'});
          for(const k of [4,5]) P.rect(C[k].center-2,y+2.2,4,4,{stroke:'#777',lw:0.3,r:0.6}); }}; });
      y=pdfTable(P,y,[{t:'Κωδικός',w:34},{t:'Περιγραφή',w:0},{t:'Σειριακοί',w:50},{t:'Ποσ.',w:14,align:'right'},{t:'Αποστ.',w:16,align:'center'},{t:'Επιστρ.',w:16,align:'center'}],rows,{zebra:true});
      if((o.crew||[]).length){ y+=8; if(y>P.H-50){ P.addPage(); y=18; } P.text(14,y,'ΣΥΝΕΡΓΕΙΟ',{size:7.5,bold:true,color:PC.gold,spacing:1}); y+=3;
        y=pdfTable(P,y,[{t:'Όνομα',w:0},{t:'Ρόλος',w:42},{t:'Ημέρες',w:44},{t:'Ώρες',w:24},{t:'Τηλέφωνο',w:30}],(o.crew||[]).map(a=>{ const cr=D.crew[a.cid]||{}; return {h:7, draw:(C,y)=>{ P.text(C[0].left,y+4.8,pdfSafe(cr.name),{size:9,bold:true,maxW:C[0].w-3}); P.text(C[1].left,y+4.8,pdfSafe(a.role),{size:8.5,maxW:C[1].w-3}); P.text(C[2].left,y+4.8,fmtD(a.start)+(a.end&&a.end!==a.start?' → '+fmtD(a.end):''),{size:8.5}); P.text(C[3].left,y+4.8,(a.from||'')+'–'+(a.to||''),{size:8.5}); P.text(C[4].left,y+4.8,cr.phone||'',{size:8.5}); }}; })); }
      if(o.notes){ y+=7; P.text(14,y,'ΣΗΜΕΙΩΣΕΙΣ',{size:7,bold:true,color:PC.gold,spacing:1}); y+=4.5; y+=P.para(14,y,pdfSafe(o.notes),182,{size:8.8,color:'#444'}); }
      y+=18; if(y>P.H-30){ P.addPage(); y=40; }
      const sw=(182-16)/3; ['Παρέδωσε','Παρέλαβε'+(cn?' ('+cn+')':''),'Επιστροφή — έλεγχος'].forEach((t,i)=>{ const x=14+i*(sw+8); P.line(x,y,x+sw,y,{color:'#999'}); P.text(x,y+4,pdfSafe(t),{size:8,color:PC.mute,maxW:sw}); });
      pdfFooters(P); return;
    }
    // ---------- προσφορά / προτιμολόγιο / συμφωνητικό ----------
    const hasDisc=o.lines.some(l=>num(l.discount)); const hasImg=Object.values(imgs).some(Boolean);
    const cols=[{t:'#',w:7,align:'center'}]; if(hasImg) cols.push({t:'',w:14}); cols.push({t:'Περιγραφή',w:0},{t:'Ποσ.',w:12,align:'right'},{t:'Ημέρες',w:15,align:'right'},{t:'Τιμή μον.',w:23,align:'right'}); if(hasDisc) cols.push({t:'Έκπτ.',w:13,align:'right'}); cols.push({t:'Αξία',w:24,align:'right'});
    const descW=182-cols.reduce((a,c)=>a+(c.w||0),0)-4;
    const ci=k=>cols.findIndex(c=>c.t===k); let n=0; const rows=[];
    for(const l of o.lines){ const p=D.products[l.pid]; n++; const nn=n;
      const sub=[]; if(l.priceType!=='flat') sub.push(hasExtra(l)&&tt.days>1?`1η ημέρα ${money(l.price)} · κάθε επόμενη ${money(l.extraPrice)}`:`${money(l.price)} / ημέρα`); else sub.push('Κατ\' αποκοπή');
      if(p&&p.kind==='bundle') sub.push((p.components||[]).map(cc=>prodName(cc.pid)+' ×'+num(cc.qty)).join(', '));
      if(l.note) sub.push(l.note);
      const nl=P.wrap(pdfSafe(p?p.name:l.name), descW, 9.6, true), sl=P.wrap(pdfSafe(sub.join(' · ')), descW, 7.8);
      const im=imgs[l.id||l.pid]; const h=Math.max(hasImg?14:0, nl.length*4.3+sl.length*3.5+4.5);
      rows.push({h, draw:(C,y)=>{ const mid=y+h/2; P.text(C[0].center,mid+1.2,String(nn),{size:7.8,color:PC.faint,align:'center'});
        if(hasImg&&im) P.imageFit(im, C[1].x+1, y+1.5, 11.5, h-3);
        const di=hasImg?2:1; let ty=y+(h-(nl.length*4.3+sl.length*3.5))/2+3.3; nl.forEach(t=>{ P.text(C[di].left,ty,t,{size:9.6,bold:true}); ty+=4.3; }); sl.forEach(t=>{ P.text(C[di].left,ty-0.4,t,{size:7.8,color:'#8a8a8e'}); ty+=3.5; });
        P.text(C[ci('Ποσ.')].right,mid+1.2,String(num(l.qty)),{size:9,align:'right'}); P.text(C[ci('Ημέρες')].right,mid+1.2,l.priceType==='flat'?'—':String(tt.days),{size:9,align:'right'});
        P.text(C[ci('Τιμή μον.')].right,mid+1.2,money(lineUnitPeriod(l,tt.days)),{size:9,align:'right'}); if(hasDisc) P.text(C[ci('Έκπτ.')].right,mid+1.2,num(l.discount)?num(l.discount)+'%':'',{size:9,align:'right'});
        P.text(C[ci('Αξία')].right,mid+1.2,money(lineTotal(l,tt.days)),{size:9.2,bold:true,align:'right'}); }}); }
    const crewList=(o.crew||[]).filter(a=>a.bill!==false&&crewCharge(a)>0);
    if(crewList.length){ rows.push({sec:'Τεχνικό προσωπικό', h:6});
      for(const a of crewList){ const cr=D.crew[a.cid]||{}; const b=cr.payType||'day'; const qn=crewQty(b,a); n++; const nn=n;
        rows.push({h:11, draw:(C,y)=>{ const di=hasImg?2:1; P.text(C[0].center,y+6.7,String(nn),{size:7.8,color:PC.faint,align:'center'}); P.text(C[di].left,y+5,pdfSafe(a.role||cr.role||'Τεχνικός'),{size:9.6,bold:true}); P.text(C[di].left,y+8.8,`${wdD(a.start)}${a.end&&a.end!==a.start?' → '+wdD(a.end):''} · ${a.from||''}–${a.to||''}`,{size:7.8,color:'#8a8a8e'});
          P.text(C[ci('Ποσ.')].right,y+6.7,'1',{size:9,align:'right'}); P.text(C[ci('Ημέρες')].right,y+6.7,b==='flat'?'—':(b==='hour'?qn+' ώρ.':String(qn)),{size:9,align:'right'}); P.text(C[ci('Τιμή μον.')].right,y+6.7,money(crewCharge(a)),{size:9,align:'right'}); P.text(C[ci('Αξία')].right,y+6.7,money(crewCharge(a)),{size:9.2,bold:true,align:'right'}); }}); } }
    y=pdfTable(P, y, cols, rows, {zebra:true});
    // σύνολα
    const tl=[['Υποσύνολο',money(tt.sub)]]; if(tt.disc) tl.push([`Έκπτωση ${num(o.discount)}%`,'−'+money(tt.disc)]); tl.push(['Καθαρή αξία',money(tt.net)],[`ΦΠΑ ${tt.vr}%`,money(tt.vat)]);
    const th=tl.length*5.4+14+(tt.deposit?6:0); if(y+th+6>P.H-22){ P.addPage(); y=18; }
    y+=6; const tx=P.W-14-78, tw=78;
    for(const [k,v] of tl){ P.text(tx+3,y+3.6,k,{size:9,color:PC.mute}); P.text(tx+tw-3,y+3.6,v,{size:9,align:'right'}); y+=5.4; }
    y+=1.5; P.rect(tx,y,tw,11,{fill:PC.dark,r:2.5}); P.text(tx+4,y+7.2,'ΣΥΝΟΛΟ',{size:9.5,bold:true,color:'#ffffff',spacing:0.8}); P.text(tx+tw-4,y+7.6,money(tt.total),{size:13,bold:true,color:PC.brand,align:'right'}); y+=11;
    if(tt.deposit){ y+=5; P.text(tx+3,y,'Εγγύηση',{size:8.5,color:PC.mute}); P.text(tx+tw-3,y,money(tt.deposit),{size:8.5,align:'right'}); }
    // σημειώσεις / όροι / τράπεζα
    const blocks=[]; if(o.notes) blocks.push(['Σημειώσεις',o.notes]);
    if(kind==='quote') blocks.push(['Όροι προσφοράς',`Η προσφορά ισχύει έως ${fmtD(valid)}. Η διαθεσιμότητα του εξοπλισμού επιβεβαιώνεται με την κράτηση. Οι τιμές δεν περιλαμβάνουν ΦΠΑ, εκτός από το τελικό σύνολο.`]);
    if(s.bank) blocks.push(['Τραπεζικοί λογαριασμοί',s.bank]);
    if(kind==='invoice') blocks.push(['Σημείωση','Το παρόν είναι προτιμολόγιο και δεν αποτελεί φορολογικό παραστατικό.']);
    if(kind==='contract') blocks.push(['Όροι ενοικίασης', s.terms||'1. Ο μισθωτής ευθύνεται για τον εξοπλισμό από την παραλαβή έως την επιστροφή του.\n2. Βλάβες, απώλειες ή κλοπές χρεώνονται με βάση την αξία αντικατάστασης.\n3. Καθυστέρηση επιστροφής χρεώνεται με την ημερήσια τιμή ανά ημέρα καθυστέρησης.\n4. Η εγγύηση επιστρέφεται μετά τον έλεγχο του εξοπλισμού.']);
    y+=9;
    for(const [lab,txt] of blocks){ const ls=P.wrap(String(txt).split('\n').map(pdfSafe).join('\n'),182,8.8); const h=5+ls.length*3.9; if(y+h>P.H-22){ P.addPage(); y=18; }
      P.text(14,y,UP(lab),{size:7,bold:true,color:PC.gold,spacing:1}); y+=4.6; ls.forEach(t=>{ P.text(14,y,t,{size:8.8,color:'#444'}); y+=3.9; }); y+=3.5; }
    if(kind==='quote'||kind==='contract'){ const bh=28; if(y+bh>P.H-22){ P.addPage(); y=18; } y+=3;
      P.rect(14,y,182,bh,{stroke:'#d8d0b0',lw:0.3,dash:[1.2,1],r:2.5}); P.text(18,y+6,UP((kind==='quote'?'Αποδοχή προσφοράς':'Υπογραφές')),{size:7,bold:true,color:PC.gold,spacing:1});
      const labs=kind==='quote'?['Ονοματεπώνυμο','Υπογραφή / σφραγίδα','Ημερομηνία']:['Ο εκμισθωτής','Ο μισθωτής']; const sw=(174-8*(labs.length-1))/labs.length;
      labs.forEach((t,i)=>{ const x=18+i*(sw+8); P.line(x,y+21,x+sw,y+21,{color:'#999'}); P.text(x,y+25,t,{size:7.8,color:PC.mute}); }); }
    pdfFooters(P);
  });
}

/* ---------- εβδομαδιαίο πρόγραμμα προσωπικού (A4 οριζόντιο) ---------- */
async function pdfCrewWeek(ws){
  const {days,people,asg,orders}=crewWeekData(ws);
  await makePDF('Πρόγραμμα προσωπικού '+weekLabel(ws), `Πρόγραμμα προσωπικού ${weekLabel(ws)}.pdf`, async P=>{
    const logo=await pdfLogo(); P.addPage(297,210); const L=12, R=P.W-12;
    if(logo) P.imageFit(logo,L,9,45,13,'left'); P.text(L+52,15.5,'Εβδομαδιαίο πρόγραμμα προσωπικού',{size:14,bold:true}); P.text(L+52,21,weekLabel(ws),{size:10,bold:true,color:PC.mute});
    P.rect(L,25,R-L,1,{fill:PC.brand,r:0.5});
    const nmW=34, dw=(R-L-nmW)/7; let y=30;
    const head=()=>{ days.forEach((d,i)=>{ const dt=new Date(d+'T00:00:00'); const x=L+nmW+i*dw; P.text(x+dw/2,y+3.5,DOW_L[dt.getDay()],{size:7.8,bold:true,align:'center',color:[0,6].includes(dt.getDay())?PC.faint:PC.ink}); P.text(x+dw/2,y+7,`${dt.getDate()}/${dt.getMonth()+1}`,{size:7,align:'center',color:PC.mute}); });
      P.text(L,y+5,'ΑΤΟΜΟ',{size:6.8,bold:true,color:PC.mute,spacing:0.5}); y+=9; P.line(L,y,R,y,{color:PC.ink,lw:0.4}); };
    head();
    for(const c of people){ const mine=asg[c.id]||[];
      const cells=days.map(d=>{ const here=sortBy(mine.filter(x=>x.a.start<=d&&(x.a.end||x.a.start)>=d),x=>x.a.from||''); const off=(c.off||[]).find(x=>x.start<=d&&(x.end||x.start)>=d);
        const items=[]; if(off) items.push({off:true, t:pdfSafe(off.note||'Άδεια')});
        for(const x of here){ const t1=`${x.a.from||''}${x.a.to?'–'+x.a.to:''}`; const t2=P.wrap(pdfSafe(x.o.name||custName(x.o.customerId)||x.o.number), dw-4, 7.2); const t3=x.o.venue?P.wrap(pdfSafe(x.o.venue), dw-4, 6.3):[]; items.push({t1,t2,t3}); }
        return items; });
      const ih=it=>it.off?6:(4+it.t2.length*3+it.t3.length*2.6+1.5);
      const h=Math.max(10, ...cells.map(cs=>cs.reduce((a,it)=>a+ih(it)+1,0)+2));
      if(y+h>P.H-16){ pdfFootersWeek(P); P.addPage(297,210); y=14; head(); }
      P.text(L+1,y+4.5,pdfSafe(c.name),{size:8.6,bold:true,maxW:nmW-2}); P.text(L+1,y+8,pdfSafe(c.role||''),{size:6.8,color:PC.mute,maxW:nmW-2});
      cells.forEach((cs,i)=>{ const x=L+nmW+i*dw; let yy=y+1.2; for(const it of cs){ const hh=ih(it);
          if(it.off){ P.rect(x+1,yy,dw-2,hh,{fill:'#fee2e2',r:1}); P.text(x+2.2,yy+4.1,it.t,{size:7,bold:true,color:'#991b1b',maxW:dw-4}); }
          else { P.rect(x+1,yy,dw-2,hh,{fill:PC.sec,r:1}); P.text(x+2.2,yy+3.6,it.t1,{size:7.4,bold:true}); let ty=yy+6.8; it.t2.forEach(t=>{ P.text(x+2.2,ty,t,{size:7.2}); ty+=3; }); it.t3.forEach(t=>{ P.text(x+2.2,ty-0.3,t,{size:6.3,color:PC.mute}); ty+=2.6; }); }
          yy+=hh+1; } P.line(x,y,x,y+h,{color:PC.line,lw:0.2}); });
      y+=h; P.line(L,y,R,y,{color:PC.line,lw:0.2}); }
    // εκδηλώσεις
    if(orders.length){ y+=7; if(y>P.H-40){ pdfFootersWeek(P); P.addPage(297,210); y=16; } P.text(L,y,'ΕΚΔΗΛΩΣΕΙΣ ΤΗΣ ΕΒΔΟΜΑΔΑΣ',{size:8,bold:true,color:PC.gold,spacing:1}); y+=4;
      for(const {o,list} of orders){ const crewTxt=sortBy(list,a=>a.start+(a.from||'')).map(a=>`${crewName(a.cid)} (${a.role||''}, ${fmtD(a.start).slice(0,5)}${a.end&&a.end!==a.start?'–'+fmtD(a.end).slice(0,5):''} ${a.from||''}–${a.to||''})`).join('  ·  ');
        const cl=P.wrap(pdfSafe(crewTxt), R-L-8, 7.8); const nt=list.filter(a=>a.note).map(a=>crewName(a.cid)+': '+a.note).join(' · '); const nl=nt?P.wrap(pdfSafe(nt),R-L-8,7.4):[];
        const h=12+cl.length*3.4+nl.length*3.2; if(y+h>P.H-14){ pdfFootersWeek(P); P.addPage(297,210); y=16; }
        P.rect(L,y,R-L,h,{stroke:PC.line,lw:0.25,r:2}); P.text(L+4,y+5.2,pdfSafe(o.name||custName(o.customerId)||o.number),{size:9.5,bold:true}); P.text(L+4+P.width(pdfSafe(o.name||custName(o.customerId)||o.number),9.5,true)+3,y+5.2,pdfSafe(o.number+(o.name&&custName(o.customerId)?' · '+custName(o.customerId):'')),{size:8,color:PC.mute});
        P.text(L+4,y+9.2,pdfSafe(`${fmtD(o.start)}${o.end&&o.end!==o.start?' – '+fmtD(o.end):''}${o.venue?' · '+o.venue:''}${['option','concept'].includes(o.status)?' · προς επιβεβαίωση':''}`),{size:7.8,color:'#444'});
        let yy=y+12.8; cl.forEach(t=>{ P.text(L+4,yy,t,{size:7.8}); yy+=3.4; }); nl.forEach(t=>{ P.text(L+4,yy,t,{size:7.4,color:'#7a5b00'}); yy+=3.2; }); y+=h+2.5; } }
    pdfFootersWeek(P);
  });
}
function pdfFootersWeek(P){ const pg=P.cur; P.text(P.W/2,P.H-6,`Εκτυπώθηκε ${fmtD(today())}`,{size:6.8,color:PC.faint,align:'center'}); }

/* ---------- ετικέτες QR (A4, 3 στήλες) ---------- */
async function pdfLabels(items){
  if(!items.length) return toast('Δεν επιλέχθηκαν είδη.', true);
  await makePDF('Ετικέτες QR', `Ετικέτες QR (${items.length}).pdf`, async P=>{
    const logo=await pdfLogo(); const cols=3, gw=62, gh=32, gap=3, L=(210-cols*gw-(cols-1)*gap)/2, T=12; const perPage=Math.floor((297-2*T+gap)/(gh+gap))*cols;
    items.forEach((it,i)=>{ if(i%perPage===0) P.addPage(210,297); const k=i%perPage, cx=L+(k%cols)*(gw+gap), cy=T+Math.floor(k/cols)*(gh+gap);
      P.rect(cx,cy,gw,gh,{stroke:'#bbbbbb',lw:0.2,dash:[1,1]}); P.qr(it.code, cx+2.5, cy+3, 26);
      const tx=cx+31, tw=gw-33; let ty=cy+6; if(logo){ P.imageFit(logo,tx,cy+2.5,22,5,'left'); ty=cy+12; }
      const nl=P.wrap(pdfSafe(it.name),tw,8.6,true).slice(0,3); nl.forEach(t=>{ P.text(tx,ty,t,{size:8.6,bold:true}); ty+=3.6; });
      P.text(tx,ty+1.2,it.code,{size:8,maxW:tw}); if(it.sub) P.text(tx,ty+5,pdfSafe(it.sub),{size:6.6,color:PC.mute,maxW:tw}); });
  });
}
/* ---------- αφίσα QR για το πρόγραμμα του προσωπικού ---------- */
async function pdfCrewPoster(url){
  await makePDF('Πρόγραμμα συνεργείου', 'Πρόγραμμα συνεργείου - QR.pdf', async P=>{
    const logo=await pdfLogo(); P.addPage(210,297); if(logo) P.imageFit(logo,55,28,100,30);
    P.text(105,82,'Το πρόγραμμά σου',{size:30,bold:true,align:'center'}); P.text(105,92,'Σκάναρε με την κάμερα του κινητού και πάτα το όνομά σου',{size:13,color:PC.mute,align:'center'});
    P.qr(url, 50, 105, 110); P.text(105,228,url,{size:8,color:PC.faint,align:'center',maxW:180});
  });
}

/* όλα τα έγγραφα βγαίνουν πλέον ως αρχεία PDF */
if(typeof SERVER!=='undefined'&&SERVER){
  printOrderDoc=(o,k)=>pdfOrderDoc(o,k);
  printLabels=items=>pdfLabels(items);
  printCrewWeek=ws=>pdfCrewWeek(ws);
  ACT['crew-link-print']=()=>{ const u=crewLinkURL(); if(u) pdfCrewPoster(u); };
}
