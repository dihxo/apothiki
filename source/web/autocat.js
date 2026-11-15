/* ===================== Αυτόματη κατηγοριοποίηση προϊόντων =====================
   1) μαθαίνει από τα προϊόντα που έχουν ήδη κατηγορία (μάρκες, μοντέλα, λέξεις)
   2) κανόνες λέξεων-κλειδιών ανά υποκατηγορία (ελληνικά & αγγλικά)
   Πηγές κειμένου: όνομα προϊόντος + τίτλος της φωτογραφίας που επιλέχθηκε. */
const AC_RULES = {
  'ct-light-lm': ['moving head','movinghead','moving','beam','spot','wash','hybrid','κινητ','κεφαλ','robe','clay paky','claypaky','martin mac','sirius','7r','10r','17r'],
  'ct-light-ls': ['par','led bar','ledbar','bar ','blinder','strobe','profile','ellipsoidal','fresnel','pinspot','pin spot','flood','προβολέας','ledvance','wall washer','washer','cob','follow spot','chandelier','πολυέλαιος','vintage','softbox','φωτιστικ','lamp','λάμπα','light '],
  'ct-light-le': ['laser','λέιζερ','uv ','blacklight','black light'],
  'ct-light-lc': ['splitter','grandma','grand ma','ma lighting','dot2','lightshark','avolites','chamsys','dmx splitter','dmx node','artnet','art-net','wireless dmx','command wing','dmx'],
  'ct-sound-ap': ['line array','linearray','subwoofer','sub ',' sub','speaker','ηχείο','ηχεια','column','array','prx','eon','tour x','mantas','hdl','evox','point source','bumper','l-acoustics','d&b','rcf','outline','fbt','hk audio'],
  'ct-sound-am': ['wedge','monitor speaker','stage monitor','in ear','in-ear','iem','σφήνα'],
  'ct-sound-aa': ['amplifier','amp ','ενισχυτ','power amp','processor','controller','dsp','lab gruppen','powersoft','crown','xti','klark teknik','dbx','feedback'],
  'ct-sound-ac': ['mixer','mixing','console','κονσόλα','μίκτη','stagebox','stage box','midas','x32','xr18','m32','soundcraft','yamaha ql','yamaha cl','allen','heath','sq5','dlive','dl32','dl231','notepad','xenyx'],
  'ct-sound-amic': ['mic','microphone','μικρόφων','χειλόφων','wireless','ασύρματ','headset','lavalier','gooseneck','di box','di-box',' di ','shure','sennheiser','dpa','akg','neumann','audix','beta 58','sm58','sm57','mipro','audio-technica','condenser','dynamic'],
  'ct-video-vl': ['led wall','ledwall','led screen','p2.6','p2,6','p3.9','p3,9','p4.8','novastar','led panel','οθόνη led','hanging bar'],
  'ct-video-vp': ['projector','προβολικ','προτζέκτορ','lens','φακός','projection screen','screen','πανί','οθόνη προβολής','epson eb','beamer'],
  'ct-video-vt': [' tv','tv ','τηλεόραση','smart tv','monitor','οθόνη','touch screen','display','"','inch'],
  'ct-video-vc': ['camera','κάμερα','camcorder','handycam','atem','switcher','vision mixer','roland v-','converter','blackmagic','media server','hollyland','capture','encoder','tripod','τρίποδο'],
  'ct-rig-rt': ['truss','τρας','corner','cube','circle','plate','truss cover'],
  'ct-rig-rm': ['hoist','chainhoist','chain hoist','μοτέρ','motor','βαρούλκο','hoist controller'],
  'ct-rig-rb': ['stand','βάση','βαση','clamp','shackle','κλειδί','roundsling','sling','ιμάντ','βαρίδ','weight','pole','tower','lifter','wind up','crank','tripod stand'],
  'ct-power-pd': ['πίνακας','πινακας','distro','distribution','dimmer','power splitter','splitter 32','διανομ'],
  'ct-power-pc': ['schuko','cee','powercon','power cable','καλώδιο ρεύματος','ρεύματος','πολύμπριζο','power strip','extension','προέκταση','παροχή','sokapex','socapex','16a','32a','63a'],
  'ct-cable-cd': ['dmx cable','καλώδιο dmx','dmx καλώδιο'],
  'ct-cable-cx': ['xlr','speakon','καλώδιο μικροφώνου','καλώδιο ηχείου','jack cable'],
  'ct-cable-cm': ['multicore','snake','πολύκλωνο'],
  'ct-cable-ce': ['ethernet','cat5','cat6','cat 6','rj45','fiber','fibre','οπτικ','opticalcon','cable drum'],
  'ct-cable-ch': ['hdmi','sdi','καλώδιο hdmi','καλώδιο sdi','dvi','displayport'],
  'ct-fx': ['fog','haze','hazer','smoke','καπνού','καπνός','co2','confetti','κομφετί','spark','σπινθήρ','bubble','φυσαλίδ','snow machine'],
  'ct-stage-ss': ['stage','πατάρι','παταρ','leg','πόδι','skirt','φούστα','κουρτίνα','curtain','drape','linoleum','podium','βήμα','handrail','κάγκελο','facade','jersey'],
  'ct-stage-sf': ['case','flight','βαλίτσα','εργαλ','tool','gaffer','ταινία','tape','μπαταρ','battery','varta','δεματικ','αναλώσιμ']
};
function acTokens(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ."-]+/g,' ').split(/\s+/).filter(w=>w.length>1); }
function acNorm(s){ return ' '+String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')+' '; }
let AC_MODEL=null, AC_VER=-1;
function acModel(){ // λέξεις → κατηγορίες από τα υπάρχοντα προϊόντα
  if(AC_MODEL&&AC_VER===D.version) return AC_MODEL;
  const tok={}, catN={};
  for(const p of Object.values(D.products)){ if(!p.cat||!D.categories[p.cat]||p.archived) continue; catN[p.cat]=(catN[p.cat]||0)+1;
    for(const w of new Set(acTokens(p.name+' '+(p.sku||'').replace(/_/g,' ')))){ const m=tok[w]=tok[w]||{}; m[p.cat]=(m[p.cat]||0)+1; } }
  AC_MODEL={tok,catN}; AC_VER=D.version; return AC_MODEL;
}
function suggestCategories(name, extra){
  const cats=D.categories; const score={}; const add=(c,v)=>{ if(cats[c]) score[c]=(score[c]||0)+v; };
  const nm=acNorm(name), ex=acNorm(extra);
  // κανόνες: το όνομα μετράει περισσότερο από τον τίτλο της φωτογραφίας
  for(const [c,kw] of Object.entries(AC_RULES)) for(const k of kw){ const kk=k.normalize('NFD').replace(/[̀-ͯ]/g,'');
    if(nm.includes(kk)) add(c, k.length>5?3:2); else if(ex.includes(kk)) add(c, k.length>5?1.5:1); }
  // μάθηση από τα υπάρχοντα: σπάνιες λέξεις (μάρκες/μοντέλα) μετράνε περισσότερο
  const {tok}=acModel();
  const words=[...new Set(acTokens(name))], xw=[...new Set(acTokens(extra))].filter(w=>!words.includes(w));
  for(const [ws,wgt] of [[words,1],[xw,.4]]) for(const w of ws){ const m=tok[w]; if(!m) continue; const tot=Object.values(m).reduce((a,b)=>a+b,0); if(tot>40) continue;
    const idf=1/Math.log2(2+tot); for(const [c,n] of Object.entries(m)) add(c, wgt*4*idf*(n/tot)); }
  // ισχυρές ενδείξεις που υπερισχύουν (το «τι είναι» μετράει περισσότερο από τη μάρκα)
  const BOOST=[[/\b(stand|stands|βαση|βάση|tripod|pole|tower|lifter|t bar)\b/,'ct-rig-rb',7],[/\blaser/,'ct-light-le',6],[/power splitter|πινακας|distro/,'ct-power-pd',7],[/\b(iem|in.?ear)\b/,'ct-sound-am',6],[/\bwedge|x12\b|x15\b/,'ct-sound-am',3],
    [/\b(fog|haze|hazer|smoke|καπνου|co2|confetti|κομφετι|spark)/,'ct-fx',7],[/(dmx|db-i|data).{0,12}splitter|splitter.{0,6}(dmx)|\bdb-i\b/,'ct-light-lc',6],[/hdmi.{0,8}splitter|splitter.{0,8}hdmi|wireless hdmi|converter/,'ct-video-vc',6],
    [/touch ?screen|\btv\b|\d{2} ?(\"|inch|ιντσ)/,'ct-video-vt',5],[/\bcontroller|processor|\bdsp\b|dn9680|feedback/,'ct-sound-aa',3],[/\bdi[- ]?\d|\bdi box|\bdi-box/,'ct-sound-amic',4],
    [/moving|beam|spot\b|wash\b|focus flex|azor/,'ct-light-lm',3],[/rgbwa|\bpar\b|\bcob\b/,'ct-light-ls',3],[/gun\b|shotgun|\bpro ?35\b|lavalier|χειλοφων/,'ct-sound-amic',4]];
  for(const [re,c,b] of BOOST) if(re.test(nm)) add(c,b);
  // ιδιαιτερότητες: "cable" υπερισχύει
  if(/\b(cable|καλωδ)/.test(nm)){ for(const c of Object.keys(score)) if(!c.startsWith('ct-cable')&&c!=='ct-power-pc') score[c]*=.5; }
  const list=Object.entries(score).filter(([c,v])=>v>=1.5).sort((a,b)=>b[1]-a[1]);
  return list.slice(0,4).map(([c,v])=>({cat:c, score:v}));
}
function autoCategorize(force){
  if(!M||M.type!=='product') return; const p=M.p; if(p._catManual&&!force) return;
  if(p.id&&p.cat&&!p._catAuto&&!force) return; // υπάρχον προϊόν με κατηγορία: δεν το πειράζουμε
  const sug=suggestCategories(p.name, p._imgTitle||''); p._catSug=sug;
  if(sug.length&&(!p.cat||p._catAuto)){ p.cat=sug[0].cat; p._catAuto=true; const sel=$('select[data-pm=cat]'); if(sel) sel.value=p.cat; }
  const h=$('#catHint'); if(h) h.innerHTML=catHintHTML();
}
function catHintHTML(){
  const p=M&&M.p; if(!p||!p._catSug||!p._catSug.length) return '';
  const alts=p._catSug.filter(s=>s.cat!==p.cat).slice(0,3);
  return `${p._catAuto&&p.cat?`<span class="cat-auto">✨ Αυτόματα</span>`:''}${alts.length?`<span class="xs muted">ή:</span>${alts.map(s=>`<button type="button" class="chip-btn" data-act="pm-cat-pick" data-v="${s.cat}">${esc(catPath(s.cat))}</button>`).join('')}`:''}`;
}
ACT['pm-cat-pick']=el=>{ const p=M.p; p.cat=el.dataset.v; p._catAuto=false; p._catManual=true; const sel=$('select[data-pm=cat]'); if(sel) sel.value=p.cat; const h=$('#catHint'); if(h) h.innerHTML=catHintHTML(); };
let acTimer=null;
ON_INPUT.unshift(el=>{ if(el.dataset.pm==='name'&&M&&M.type==='product'){ clearTimeout(acTimer); acTimer=setTimeout(()=>autoCategorize(false),500); } return false; });
ON_CHANGE.unshift(el=>{ if(el.dataset.pm==='cat'&&M&&M.type==='product'){ M.p.cat=el.value; M.p._catAuto=false; M.p._catManual=true; const h=$('#catHint'); if(h) h.innerHTML=catHintHTML(); return true; } return false; });
