import { partyApi, escapeHtml as e, stamp } from './party-ui.js';

// Human messages and AI answers are deliberately separate. AI does not inherit private chat history.
export function createGuestChat(app, alive) {
  let open=false, mode='human', messages=[], aiHistory=[], error='', busy=false, timer=null;
  const view = () => `<aside class="t27-messenger" aria-label="Помощ и съобщения">
    <button type="button" class="t27-chat-toggle" data-chat-toggle aria-expanded="${open}">
      <span aria-hidden="true">💬</span> Помощ и чат</button>
    ${open ? `<section class="t27-chat-window">
      <div class="t27-chat-head"><strong>Троян 2027</strong><button type="button" data-chat-toggle aria-label="Затвори чата">✕</button></div>
      <div class="t27-chat-modes" role="group" aria-label="Тип разговор">
        <button type="button" data-chat-mode="human" aria-pressed="${mode==='human'}">Организатори</button>
        <button type="button" data-chat-mode="ai" aria-pressed="${mode==='ai'}">AI помощник</button>
      </div>
      ${mode==='human' ? `<div class="t27-chat-messages" aria-live="polite">
        ${messages.length ? messages.map(item => `<article class="t27-chat-line ${item.sender_role === 'guest' ? 'is-mine' : 'is-admin'}">
          <small>${item.sender_role === 'guest' ? 'Вашето домакинство' : 'Организатор'} · ${e(stamp(item.created_at))}</small>
          <p>${e(item.body)}</p></article>`).join('') : '<p class="t27-help">Няма съобщения. Можеш да пишеш на организаторите.</p>'}
      </div>` : `<div class="t27-chat-messages" aria-live="polite">
        <p class="t27-help">AI отговаря само по наличните данни за празника. Въпросът и ограничен организационен контекст се изпращат към AI доставчик; не въвеждай чувствителна информация.</p>
        ${aiHistory.map(item => `<article class="t27-chat-line ${item.role==='user'?'is-mine':'is-admin'}">
          <small>${item.role==='user'?'Ваш въпрос':'AI помощник'}</small><p>${e(item.text)}</p></article>`).join('')}
      </div>`}
      <form data-chat-form><label class="t27-field">${mode==='human'?'Съобщение':'Въпрос за организацията'}
        <textarea name="body" rows="2" maxlength="${mode==='human'?1200:500}" required
          placeholder="${mode==='human'?'Напиши на организаторите':'Напр. Какво ще ядем на 31 декември?'}"></textarea></label>
        <button type="submit" class="t27-btn t27-btn--primary" ${busy?'disabled':''}>${mode==='human'?'Изпрати':'Попитай AI'}</button></form>
      ${error ? `<p class="t27-error" role="alert">${e(error)}</p>` : ''}
    </section>` : ''}
  </aside>`;
  function mount() {
    if (!alive() || !app.querySelector('.t27-guest')) return;
    app.querySelector('.t27-messenger')?.remove();
    const root=document.createElement('div'); root.innerHTML=view();
    const node=root.firstElementChild; app.append(node);
    node.querySelectorAll('[data-chat-toggle]').forEach(button => button.addEventListener('click', () => {
      open=!open; if(open && mode==='human') void refresh(); else if(timer)clearTimeout(timer);
      mount();
    }));
    node.querySelectorAll('[data-chat-mode]').forEach(button => button.addEventListener('click',()=>{
      mode=button.dataset.chatMode;error='';
      if(timer)clearTimeout(timer);
      if(mode==='human')void refresh();
      mount();
    }));
    const form=node.querySelector('[data-chat-form]');
    if(form)form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const body=form.elements.body.value.trim();if(!body)return;
      busy=true;error='';form.querySelector('button').disabled=true;
      try {
        if(mode==='human') {
          await partyApi('guest/message',{body});
          await refresh();
        } else {
          const result=await partyApi('guest/ai',{question:body});
          aiHistory.push({role:'user',text:body},{role:'ai',text:result.answer});
          aiHistory=aiHistory.slice(-16);
        }
      } catch(err) { error=err.message; }
      finally {busy=false;mount();}
    });
  }
  async function refresh() {
    if(!open || mode!=='human' || !alive())return;
    if(timer){clearTimeout(timer);timer=null;}
    try {
      const result=await partyApi('guest/messages');messages=result.messages||[];error='';
      await partyApi('guest/messages/read',{}).catch(()=>{});
    } catch(err) {error=err.message;}
    if(!alive())return;
    mount();
    if(open && mode==='human')timer=setTimeout(()=>{if(!document.hidden)void refresh();else timer=setTimeout(()=>void refresh(),12000);},12000);
  }
  return { mount };
}
