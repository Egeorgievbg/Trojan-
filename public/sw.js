/* Trojan 2027 push-only service worker. Never caches private sessions or survey data. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title:'Троян 2027', body:'Имате ново съобщение.' }; }
  const title = typeof data.title === 'string' ? data.title.slice(0,100) : 'Троян 2027';
  let target = '/#survey';
  try { const link = new URL(data.url || target,self.location.origin); if(link.origin === self.location.origin) target = link.pathname+link.search+link.hash; } catch {}
  const options = { body: String(data.body || 'Ново известие за празника.').slice(0,250),
    icon:'/pwa-icon.svg', badge:'/pwa-icon.svg', tag:'trojan-'+(data.category||'info'), data:{url:target} };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = event.notification.data?.url || '/#survey';
    const target = new URL(path,self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (existing) { await existing.focus(); await existing.navigate(target.href); }
    else await self.clients.openWindow(target.href);
  })());
});
