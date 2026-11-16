import { partyApi, escapeHtml as e, stamp } from './party-ui.js';

export function createGuestChat(app, alive) {
  let open = false, messages = [], error = '', busy = false, timer = null;
  function html() {
    return `<aside class="t27-messenger" aria-label="Съобщения с организаторите">
      <button type="button" class="t27-chat-toggle" data-chat-toggle aria-expanded="${open}">
        <span aria-hidden="true">💬</span> Чат с организаторите</button>
      ${open ? `<section class="t27-chat-window">
        <div class="t27-chat-head"><strong>Съобщения</strong><button type="button" data-chat-toggle aria-label="Затвори чата">✕</button></div>
        <div class="t27-chat-messages" aria-live="polite">
          ${messages.length ? messages.map(item => `<article class="t27-chat-line ${item.sender_role === 'guest' ? 'is-mine' : 'is-admin'}">
            <small>${item.sender_role === 'guest' ? 'Вашето домакинство' : 'Организатор'} · ${e(stamp(item.created_at))}</small>
            <p>${e(item.body)}</p></article>`).join('') : '<p class="t27-help">Няма съобщения. Можеш да пишеш на организаторите.</p>'}
        </div>
        <form data-chat-form><label class="t27-field">Напиши съобщение
          <textarea name="body" rows="2" maxlength="1200" required placeholder="Какво искаш да попиташ?"></textarea></label>
          <button type="submit" class="t27-btn t27-btn--primary" ${busy ? 'disabled' : ''}>Изпрати</button></form>
        ${error ? `<p class="t27-error" role="alert">${e(error)}</p>` : ''}
      </section>` : ''}
    </aside>`;
  }
  function mount() {
    if (!alive() || !app.querySelector('.t27-guest')) return;
    app.querySelector('.t27-messenger')?.remove();
    const root=document.createElement('div');
    root.innerHTML=html();
    const node=root.firstElementChild;
    app.append(node);
    node.querySelectorAll('[data-chat-toggle]').forEach(button => button.addEventListener('click', () => {
      open=!open; if(open) void refresh(); else if(timer) clearTimeout(timer);
      mount();
    }));
    const form=node.querySelector('[data-chat-form]');
    if(form) form.addEventListener('submit',async event => {
      event.preventDefault(); if(busy) return;
      const body=form.elements.body.value.trim(); if(!body) return;
      busy=true; error=''; form.querySelector('button').disabled=true;
      try { await partyApi('guest/message',{body}); await refresh(); }
      catch(err){error=err.message;} finally {busy=false;mount();}
    });
  }
  async function refresh() {
    if(!open || !alive()) return;
    if(timer){clearTimeout(timer);timer=null;}
    try {
      const result=await partyApi('guest/messages');
      messages=result.messages||[];error='';
      await partyApi('guest/messages/read',{}).catch(() => {});
    } catch(err) { error=err.message; }
    if(!alive()) return;
    mount();
    if(open) timer=setTimeout(() => { if(!document.hidden) void refresh(); else timer=setTimeout(() => void refresh(),12000); },12000);
  }
  return { mount };
}
