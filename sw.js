const CACHE='maze-app-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
// Нэгдүгээрт сүлжээ (үргэлж шинэ хувилбар), офлайн үед кэш
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(
    fetch(r,{cache:'no-cache'}).then(res=>{
      if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}
      return res;
    }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html')))
  );
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c)return c.focus()}
    return self.clients.openWindow('./index.html');
  }));
});
