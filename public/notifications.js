import { partyApi, escapeHtml as e } from './party-ui.js';

const labels = { messages:'Лични съобщения', announcements:'Новини за събитието', menu:'Промени в менюто', tasks:'Задачи и напомняния' };
const keyBytes = key => {
  const str = key.replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(str.padEnd(Math.ceil(str.length / 4) * 4,'='));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k,v) { try { localStorage.setItem(k,v); } catch {} }
};

// Called only after a validated household session or organizer authentication.
export function createPushPrompt(app, role, alive) {
  const setting = 't27-push-choice-' + role;
  let promise = null;
  let configured = null;
  let busy = false;
  const prefix = role === 'admin' ? 'admin' : 'guest';
  const supported = () => window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator
    && 'PushManager' in window;
  function getConfig() {
    promise ??= partyApi(prefix+'/push/config').catch(() => ({enabled:false}));
    return promise;
  }
  function close() { app.querySelector('[data-push-prompt]')?.remove(); }
  async function show(force = false) {
    if (!alive() || !supported() || busy) return;
    if (!force && storage.get(setting) === 'dismissed') return;
    const cfg = await getConfig();
    if (!alive() || !cfg.enabled) return;
    configured = cfg;
    const registration = await navigator.serviceWorker.getRegistration('/').catch(() => null);
    const active = Notification.permission === 'granted' && !!(await registration?.pushManager?.getSubscription().catch(() => null));
    if (!force && (active || Notification.permission === 'denied')) return;
    close();
    const panel = document.createElement('section');
    panel.className = 't27-push-prompt';
    panel.dataset.pushPrompt = 'true';
    panel.setAttribute('role','region'); panel.setAttribute('aria-label','Разрешение за известия');
    const ios = /iP(hone|ad|od)/i.test(navigator.userAgent) && !navigator.standalone
      && !window.matchMedia('(display-mode: standalone)').matches;
    panel.innerHTML = `<div class="t27-push-head"><span aria-hidden="true">🔔</span>
      <h2>Не пропускай новостите за Троян 2027</h2></div>
      <p>С твое разрешение можем да изпращаме известия за организацията и съобщенията,
       дори когато приложението е затворено. Разрешението може да бъде оттеглено по всяко време.</p>
      ${ios ? '<p class="t27-help">На iPhone първо добави приложението към началния екран чрез Safari → Споделяне → Добави към началния екран.</p>' : ''}
      <fieldset class="t27-push-options"><legend>За какво да те уведомяваме?</legend>
        ${Object.entries(labels).map(([id,label]) => `<label><input type="checkbox" value="${id}" checked> ${e(label)}</label>`).join('')}</fieldset>
      <p class="t27-help">Абонаментът съдържа браузърен адрес и криптографски ключове.
       <a href="/privacy.html" target="_blank" rel="noopener">Прочети за поверителността</a>.</p>
      ${Notification.permission === 'denied' ? '<p class="t27-help">Известията са блокирани от браузъра. Промени разрешението в настройките на сайта, ако искаш да ги включиш.</p>' : ''}
      <div class="t27-chips"><button type="button" class="t27-btn t27-btn--primary" data-push-allow ${Notification.permission === 'denied' ? 'disabled' : ''}>${active ? 'Обнови настройките' : 'Разрешавам известията'}</button>
        ${active ? '<button type="button" class="t27-btn t27-btn--line" data-push-revoke>Изключи известията</button>' : ''}
        <button type="button" class="t27-btn t27-btn--line" data-push-dismiss>Не сега</button></div>
      <p data-push-status role="status" aria-live="polite"></p>`;
    app.appendChild(panel);
    panel.querySelector('[data-push-dismiss]').addEventListener('click',() => {
      storage.set(setting,'dismissed'); close();
    });
    panel.querySelector('[data-push-revoke]')?.addEventListener('click',async () => {
      if (busy) return;
      busy = true;
      const status = panel.querySelector('[data-push-status]');
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const sub = await registration?.pushManager?.getSubscription();
        if (!sub) { status.textContent='Няма активен абонамент.'; return; }
        const removed = await partyApi(prefix+'/push/unsubscribe',{endpoint:sub.endpoint});
        if (!removed.removed) { status.textContent='Абонаментът принадлежи на друг профил. Не е изтрит.'; return; }
        await sub.unsubscribe();
        storage.set(setting,'dismissed');
        status.textContent='Известията са изключени.';
        panel.querySelector('[data-push-revoke]').disabled=true;
      } catch { status.textContent='Неуспешно изключване. Опитай пак.'; }
      finally { busy=false; }
    });
    panel.querySelector('[data-push-allow]').addEventListener('click',async () => {
      if (busy) return;
      // Permission request occurs directly inside the user gesture.
      const permissionPromise = Notification.requestPermission();
      busy = true;
      const status = panel.querySelector('[data-push-status]');
      try {
        const permission = await permissionPromise;
        if (permission !== 'granted') { status.textContent='Известията не са разрешени. Можеш да продължиш без тях.'; return; }
        await navigator.serviceWorker.register('/sw.js',{scope:'/'});
        const ready = await navigator.serviceWorker.ready;
        const subscription = await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(configured.publicKey)});
        const categories = [...panel.querySelectorAll('.t27-push-options input:checked')].map(node => node.value);
        await partyApi(prefix+'/push/subscribe',{subscription:subscription.toJSON(),categories});
        storage.set(setting,'enabled');
        status.textContent = 'Известията са включени.';
        panel.querySelector('[data-push-allow]').disabled = true;
      } catch {
        status.textContent = 'Абонаментът не успя. Провери настройките на браузъра и опитай пак.';
      } finally { busy = false; }
    });
  }
  return { show, close };
}
