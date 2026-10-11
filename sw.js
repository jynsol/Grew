// Offline shell for 그루. Pages: network first, cached copy when offline. Scripts, styles, images, sounds
// and web fonts: cached copy right away, refreshed in the background. Login, sync and search APIs never
// touch the cache.
const CACHE='grew-v2';
const SHELL=['./','./index.html','./manifest.webmanifest','./assets/images/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const STATIC_HOSTS=['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'];
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const url=new URL(req.url),same=url.origin===self.location.origin;
 if(req.mode==='navigate'){
  e.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));return;
 }
 if(!(same||STATIC_HOSTS.includes(url.hostname)))return;
 if(same&&!/\.(js|css|webp|png|jpg|jpeg|svg|woff2?|webmanifest)$/i.test(url.pathname))return;
 e.respondWith(caches.open(CACHE).then(async c=>{
  const hit=await c.match(req);
  const net=fetch(req).then(res=>{if((res.status===200||res.type==="opaque")&&!req.headers.has("range"))c.put(req,res.clone());return res}).catch(()=>hit);
  return hit||net;
 }));
});
