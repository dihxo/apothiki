/* ===================== Μικρή μηχανή PDF (χωρίς εξωτερικές βιβλιοθήκες) =====================
   - Ενσωματωμένη γραμματοσειρά Carlito (ελληνικά/λατινικά), Type0 / Identity-H, με ToUnicode
   - Μονάδες: χιλιοστά (mm), αρχή πάνω-αριστερά
   - Κείμενο με αναδίπλωση, ορθογώνια (και στρογγυλεμένα), γραμμές, εικόνες JPEG */
const PDFK = 72/25.4; // mm → pt
let PDF_FONTS=null;
async function pdfFonts(){
  if(PDF_FONTS) return PDF_FONTS;
  const ld=async n=>{ const [ttf,js]=await Promise.all([fetch('fonts/carlito-'+n+'.ttf').then(r=>{ if(!r.ok) throw new Error('font'); return r.arrayBuffer(); }), fetch('fonts/carlito-'+n+'.json').then(r=>r.json())]); return {ttf:new Uint8Array(ttf), ...js}; };
  const [r,b]=await Promise.all([ld('r'),ld('b')]); PDF_FONTS={r,b}; return PDF_FONTS;
}
function pdfHex(n,len){ return n.toString(16).padStart(len,'0'); }
async function pdfDeflate(u8){
  if(typeof CompressionStream==='undefined') return null;
  try{ const cs=new CompressionStream('deflate'); const out=new Response(new Blob([u8]).stream().pipeThrough(cs)); return new Uint8Array(await out.arrayBuffer()); }catch(e){ return null; }
}
class PDFDoc{
  constructor(fonts){ this.F=fonts; this.pages=[]; this.images=[]; this.cur=null; }
  addPage(w=210,h=297){ const p={w,h,ops:[]}; this.pages.push(p); this.cur=p; return p; }
  get W(){ return this.cur.w; } get H(){ return this.cur.h; }
  _op(s){ this.cur.ops.push(s); }
  _c(col){ const h=(col||'#000').replace('#',''); const v=h.length===3?h.split('').map(x=>parseInt(x+x,16)):[0,2,4].map(i=>parseInt(h.substr(i,2),16)); return v.map(x=>(x/255).toFixed(3)).join(' '); }
  _n(v){ return (+v).toFixed(2); }
  // ---------- κείμενο ----------
  glyphs(str, bold){ const f=bold?this.F.b:this.F.r; const out=[]; for(const ch of String(str)){ const g=f.cmap[ch.codePointAt(0)]; out.push(g||f.cmap['63']||[0,500]); } return out; }
  width(str, size, bold){ let w=0; for(const g of this.glyphs(str,bold)) w+=g[1]; return w*size/1000/PDFK; }
  text(x, y, str, o={}){ // y = baseline (mm από πάνω)
    str=String(str??''); if(!str) return 0; const size=o.size||10, bold=!!o.bold; let w=this.width(str,size,bold);
    let s=str; if(o.maxW&&w>o.maxW){ while(s.length>1&&this.width(s+'…',size,bold)>o.maxW) s=s.slice(0,-1); s+='…'; w=this.width(s,size,bold); }
    let xx=x; if(o.align==='right') xx=x-w; else if(o.align==='center') xx=x-w/2;
    const hex=this.glyphs(s,bold).map(g=>pdfHex(g[0],4)).join('');
    const sp=o.spacing?` ${this._n(o.spacing)} Tc`:'';
    this._op(`BT ${this._c(o.color||'#1d1d1f')} rg /${bold?'F2':'F1'} ${this._n(size)} Tf${sp} ${this._n(xx*PDFK)} ${this._n((this.H-y)*PDFK)} Td <${hex}> Tj${o.spacing?' 0 Tc':''} ET`);
    return w;
  }
  wrap(str, maxW, size, bold){ const lines=[]; for(const para of String(str??'').split('\n')){ const words=para.split(/(\s+)/); let line='';
      for(const w of words){ const t=line+w; if(this.width(t.trimEnd(),size,bold)<=maxW||!line.trim()){ line=t; } else { lines.push(line.trimEnd()); line=w.trimStart(); }
        while(this.width(line,size,bold)>maxW&&line.length>1){ let k=line.length; while(k>1&&this.width(line.slice(0,k),size,bold)>maxW) k--; lines.push(line.slice(0,k)); line=line.slice(k); } }
      lines.push(line.trimEnd()); } return lines; }
  para(x, y, str, maxW, o={}){ const size=o.size||10, lh=o.lh||size*0.42; const ls=this.wrap(str,maxW,size,o.bold); ls.forEach((l,i)=>this.text(x,y+i*lh,l,o)); return ls.length*lh; }
  // ---------- σχήματα ----------
  rect(x,y,w,h,o={}){ const X=x*PDFK, Y=(this.H-y-h)*PDFK, Wd=w*PDFK, Hd=h*PDFK; let s='q ';
    if(o.fill) s+=`${this._c(o.fill)} rg `; if(o.stroke) s+=`${this._c(o.stroke)} RG ${this._n((o.lw||0.25)*PDFK)} w `; if(o.dash) s+=`[${o.dash.map(d=>this._n(d*PDFK)).join(' ')}] 0 d `;
    const r=Math.min((o.r||0), w/2, h/2)*PDFK;
    if(r>0){ const k=0.5523*r; s+=`${this._n(X+r)} ${this._n(Y)} m ${this._n(X+Wd-r)} ${this._n(Y)} l ${this._n(X+Wd-r+k)} ${this._n(Y)} ${this._n(X+Wd)} ${this._n(Y+r-k)} ${this._n(X+Wd)} ${this._n(Y+r)} c ${this._n(X+Wd)} ${this._n(Y+Hd-r)} l ${this._n(X+Wd)} ${this._n(Y+Hd-r+k)} ${this._n(X+Wd-r+k)} ${this._n(Y+Hd)} ${this._n(X+Wd-r)} ${this._n(Y+Hd)} c ${this._n(X+r)} ${this._n(Y+Hd)} l ${this._n(X+r-k)} ${this._n(Y+Hd)} ${this._n(X)} ${this._n(Y+Hd-r+k)} ${this._n(X)} ${this._n(Y+Hd-r)} c ${this._n(X)} ${this._n(Y+r)} l ${this._n(X)} ${this._n(Y+r-k)} ${this._n(X+r-k)} ${this._n(Y)} ${this._n(X+r)} ${this._n(Y)} c h `; }
    else s+=`${this._n(X)} ${this._n(Y)} ${this._n(Wd)} ${this._n(Hd)} re `;
    s+=(o.fill&&o.stroke)?'B':(o.fill?'f':'S'); this._op(s+' Q'); }
  line(x1,y1,x2,y2,o={}){ this._op(`q ${this._c(o.color||'#000')} RG ${this._n((o.lw||0.25)*PDFK)} w ${o.dash?`[${o.dash.map(d=>this._n(d*PDFK)).join(' ')}] 0 d `:''}${this._n(x1*PDFK)} ${this._n((this.H-y1)*PDFK)} m ${this._n(x2*PDFK)} ${this._n((this.H-y2)*PDFK)} l S Q`); }
  // ---------- εικόνες (JPEG) ----------
  image(img, x, y, w, h){ if(!img) return; let i=this.images.indexOf(img); if(i<0){ this.images.push(img); i=this.images.length-1; }
    this._op(`q ${this._n(w*PDFK)} 0 0 ${this._n(h*PDFK)} ${this._n(x*PDFK)} ${this._n((this.H-y-h)*PDFK)} cm /Im${i} Do Q`); }
  imageFit(img, x, y, w, h, align='center'){ if(!img) return; const k=Math.min(w/img.w, h/img.h); const iw=img.w*k, ih=img.h*k; const ix=align==='left'?x:x+(w-iw)/2; this.image(img, ix, y+(h-ih)/2, iw, ih); return {w:iw,h:ih}; }
  qr(text, x, y, size){ const m=qrMatrix(text); if(!m) return; const n=m.length, c=size/n; let s=`q ${this._c('#000')} rg `;
    for(let r=0;r<n;r++) for(let k=0;k<n;k++) if(m[r][k]) s+=`${this._n((x+k*c)*PDFK)} ${this._n((this.H-y-(r+1)*c)*PDFK)} ${this._n(c*PDFK+0.15)} ${this._n(c*PDFK+0.15)} re `;
    this._op(s+'f Q'); }
  // ---------- έξοδος ----------
  async build(title){
    const enc=new TextEncoder(); const parts=[]; let pos=0; const offs=[];
    const push=d=>{ const u=typeof d==='string'?enc.encode(d):d; parts.push(u); pos+=u.length; };
    const objs=[]; const obj=()=>{ objs.push(null); return objs.length; };
    const set=(n, body)=>{ objs[n-1]=body; };
    const stream=async (dict, data, raw)=>{ let u=typeof data==='string'?enc.encode(data):data; let filt=''; if(!raw){ const z=await pdfDeflate(u); if(z&&z.length<u.length){ u=z; filt=' /Filter /FlateDecode'; } } return {dict:`<< ${dict} /Length ${u.length}${filt} >>`, data:u}; };
    const catalog=obj(), pagesN=obj(), info=obj();
    // γραμματοσειρές
    const fontRefs={};
    for(const [key,name] of [['r','F1'],['b','F2']]){ const f=this.F[key];
      const ff=obj(), fd=obj(), cid=obj(), tu=obj(), t0=obj();
      set(ff, await stream(`/Length1 ${f.ttf.length}`, f.ttf));
      const bn=key==='b'?'Carlito-Bold':'Carlito';
      set(fd, `<< /Type /FontDescriptor /FontName /${bn} /Flags 32 /FontBBox [${f.meta.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${f.meta.asc} /Descent ${f.meta.desc} /CapHeight ${f.meta.asc} /StemV 80 /FontFile2 ${ff} 0 R >>`);
      set(cid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${bn} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fd} 0 R /CIDToGIDMap /Identity /DW 500 /W [0 [${f.w.join(' ')}]] >>`);
      const bf=Object.entries(f.cmap).map(([u,g])=>`<${pdfHex(g[0],4)}> <${pdfHex(+u,4)}>`); let cm='/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';
      for(let i=0;i<bf.length;i+=100){ const ch=bf.slice(i,i+100); cm+=`${ch.length} beginbfchar\n${ch.join('\n')}\nendbfchar\n`; } cm+='endcmap CMapName currentdict /CMap defineresource pop end end';
      set(tu, await stream('', cm));
      set(t0, `<< /Type /Font /Subtype /Type0 /BaseFont /${bn} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`);
      fontRefs[name]=t0; }
    const imgRefs=[]; for(const im of this.images){ const n=obj(); set(n, await stream(`/Type /XObject /Subtype /Image /Width ${im.pw} /Height ${im.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, im.data, true)); imgRefs.push(n); }
    const res=`<< /Font << /F1 ${fontRefs.F1} 0 R /F2 ${fontRefs.F2} 0 R >> /XObject << ${imgRefs.map((n,i)=>`/Im${i} ${n} 0 R`).join(' ')} >> >>`;
    const kids=[];
    for(const p of this.pages){ const c=obj(), pg=obj(); set(c, await stream('', p.ops.join('\n'))); set(pg, `<< /Type /Page /Parent ${pagesN} 0 R /MediaBox [0 0 ${this._n(p.w*PDFK)} ${this._n(p.h*PDFK)}] /Resources ${res} /Contents ${c} 0 R >>`); kids.push(pg); }
    set(pagesN, `<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`);
    set(catalog, `<< /Type /Catalog /Pages ${pagesN} 0 R >>`);
    const utf16=s=>'<FEFF'+[...String(s)].map(c=>{ const cp=c.codePointAt(0); return cp>0xffff?pdfHex(0xd800+((cp-0x10000)>>10),4)+pdfHex(0xdc00+((cp-0x10000)&0x3ff),4):pdfHex(cp,4); }).join('')+'>';
    set(info, `<< /Title ${utf16(title||'')} /Producer ${utf16('ΔΙΗΧΟ Αποθήκη')} >>`);
    push('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
    for(let i=0;i<objs.length;i++){ offs.push(pos); const o=objs[i]; push(`${i+1} 0 obj\n`); if(typeof o==='string') push(o+'\n'); else { push(o.dict+'\nstream\n'); push(o.data); push('\nendstream\n'); } push('endobj\n'); }
    const xref=pos; push(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join(''));
    push(`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, {type:'application/pdf'});
  }
}
/* εικόνα → JPEG για το PDF (λευκό φόντο). src: data URL / blob / URL (μέσω του server για ξένες διευθύνσεις) */
const PDF_IMG_CACHE={};
async function pdfImage(src, maxPx=600){
  if(!src) return null; if(PDF_IMG_CACHE[src+maxPx]) return PDF_IMG_CACHE[src+maxPx];
  try{
    let blob;
    if(src.startsWith('data:')) blob=dataURLtoBlob(src);
    else if(/^https?:/.test(src)&&!src.startsWith(location.origin)){ const r=await fetch('/api/imgfetch?url='+encodeURIComponent(src),{credentials:'same-origin'}); if(!r.ok) return null; blob=await r.blob(); }
    else { const r=await fetch(src); if(!r.ok) return null; blob=await r.blob(); }
    const bmp=await createImageBitmap(blob); const k=Math.min(1, maxPx/Math.max(bmp.width,bmp.height));
    const cw=Math.max(1,Math.round(bmp.width*k)), ch=Math.max(1,Math.round(bmp.height*k));
    const c=document.createElement('canvas'); c.width=cw; c.height=ch; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,cw,ch); x.drawImage(bmp,0,0,cw,ch);
    const jb=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9)); const data=new Uint8Array(await jb.arrayBuffer());
    const im={data, pw:cw, ph:ch, w:cw, h:ch}; PDF_IMG_CACHE[src+maxPx]=im; return im;
  }catch(e){ return null; }
}
/* παράδοση του PDF: κοινοποίηση (κινητό) ή άνοιγμα/λήψη (υπολογιστής) */
function pdfDeliver(blob, filename){
  filename=filename.replace(/[\\/:*?"<>|]+/g,'-');
  const file=new File([blob], filename, {type:'application/pdf'}); const url=URL.createObjectURL(blob);
  const canShare=navigator.canShare&&navigator.canShare({files:[file]});
  const kb=Math.max(1,Math.round(blob.size/1024));
  openModal(`<div class="dlg-h"><h2>Το PDF είναι έτοιμο</h2><button class="icon" data-act="modal-close">✕</button></div>
    <div class="dlg-b"><div class="pdfready"><span class="pdfic">PDF</span><div class="grow" style="min-width:0"><b style="word-break:break-word">${esc(filename)}</b><div class="xs muted">${kb} KB</div></div></div></div>
    <div class="dlg-f" style="flex-wrap:wrap">${canShare?'<button class="btn pri" data-pdf="share">Κοινοποίηση / Αποθήκευση</button>':''}<a class="btn ${canShare?'':'pri'}" href="${url}" target="_blank" rel="noopener">Άνοιγμα</a><a class="btn" href="${url}" download="${esc(filename)}">Λήψη</a></div>`, 'sm');
  const b=$('#modal [data-pdf=share]'); if(b) b.onclick=async()=>{ try{ await navigator.share({files:[file], title:filename}); }catch(e){} };
}
async function makePDF(title, filename, draw){
  toast('Δημιουργία PDF…');
  try{ const fonts=await pdfFonts(); const doc=new PDFDoc(fonts); await draw(doc); const blob=await doc.build(title); pdfDeliver(blob, filename); }
  catch(e){ console.error(e); toast('Δεν δημιουργήθηκε το PDF: '+(e.message||e), true); }
}
