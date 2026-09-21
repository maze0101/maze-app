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

// Апп хаалттай үед сервераас (FCM) ирэх push: дуудлага, мессеж, найзын хүсэлт
self.addEventListener('push',e=>{
  let p={};try{p=e.data?e.data.json():{}}catch(_){}
  const d=p.data||p.notification||p||{};
  const call=d.type==='call';
  const opt={
    body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',
    tag:d.tag||undefined,renotify:!!d.tag,
    requireInteraction:call,vibrate:call?[300,150,300,150,300,150,300]:[150],
    data:{url:d.url||'./index.html'}
  };
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    // Апп харагдаж байвал апп өөрөө мэдэгдэнэ
    if(list.some(c=>c.visibilityState==='visible'&&c.focused))return;
    return self.registration.showNotification(d.title||'MAZE APP',opt);
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||'./index.html';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c)return c.focus()}
    return self.clients.openWindow(url);
  }));
});
