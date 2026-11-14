/* ΔΙΗΧΟ Αποθήκη — service worker: πάντα πρώτα το δίκτυο (για άμεσες ενημερώσεις),
   αποθηκευμένο αντίγραφο της εφαρμογής μόνο όταν δεν υπάρχει σύνδεση. Τα δεδομένα (/api) δεν αποθηκεύονται. */
const C='apothiki-shell-v1';
const SHELL=['/','/index.html','/style.css','/qr.js','/core.js','/app.js','/store.js','/v_orders.js','/v_inventory.js','/v_other.js','/logo.png','/icon-192.png'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request, cp)); } return r; })
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('/index.html'))));
});
