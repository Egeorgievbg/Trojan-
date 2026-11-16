import { partyApi, escapeHtml as e, stamp } from './party-ui.js';

export function createAdminComms(app, alive, on, rerender) {
  let families=null, selected='', conversation=[], logs=null, configured=null, loading=false, busy=false, error='', notice='';
  const label = id => families?.find(item => item.id === id)?.title || id;
  async function loadFamilies() {
    if(loading) return;
    loading=true;
    try { const result=await partyApi('admin/messages'); families=result.households; error=''; }
    catch(err) { error=err.message; }
    finally { loading=false; if(alive()) rerender(); }
  }
  async function open(id) {
    selected=id;loading=true;error='';
    try {
      const result=await partyApi('admin/messages?householdId='+encodeURIComponent(id));
      conversation=result.messages || [];
      await partyApi('admin/messages/read',{householdId:id});
      const overview=await partyApi('admin/messages');families=overview.households;
    } catch(err) { error=err.message; }
    finally { loading=false; if(alive())rerender(); }
  }
  async function loadLogs() {
    if(loading) return;
    loading=true;
    try { const r=await partyApi('admin/notifications');logs=r.logs||[];configured=r.configured === true;error=''; }
    catch(err) { error=err.message; }
    finally { loading=false; if(alive())rerender(); }
  }
  function onMount(tab) {
    if(tab==='chat' && families === null && !loading) void loadFamilies();
    if(tab==='notifications' && logs === null && !loading) void loadLogs();
  }
  function banner() { return `${error ? `<p role="alert" class="t27-error">${e(error)}</p>` : ''}
    ${notice ? `<p role="status" class="t27-notice">${e(notice)}</p>` : ''}`; }
  function chatView() {
    return `<section class="t27-stack"><h2>Съобщения с гостите</h2>${banner()}
      <div class="t27-admin-messaging">
        <nav class="t27-chat-families" aria-label="Разговори">
          ${families === null ? '<p>Зареждаме разговорите…</p>' : families.map(item => `
            <button type="button" data-admin-thread="${e(item.id)}" aria-pressed="${item.id === selected}">
              <strong>${e(item.title)}</strong>${item.unread ? `<span class="t27-pill">${e(item.unread)} нови</span>` : ''}
            </button>`).join('')}
        </nav>
        <section class="t27-admin-conversation">
          ${!selected ? '<p>Избери домакинство, за да прегледаш и изпратиш лично съобщение.</p>' : `
            <h3>${e(label(selected))}</h3>
            <div class="t27-chat-messages">${conversation.length ? conversation.map(item => `
              <article class="t27-chat-line ${item.sender_role === 'admin' ? 'is-mine' : 'is-guest'}">
                <small>${item.sender_role === 'admin' ? 'Организатор' : 'Домакинство'} · ${e(stamp(item.created_at))}</small>
                <p>${e(item.body)}</p>
              </article>`).join('') : '<p>Няма съобщения.</p>'}</div>
            <form data-admin-msg-form class="t27-stack">
              <label class="t27-field">Съобщение<textarea rows="3" maxlength="1200" name="body" required placeholder="Напиши съобщение до домакинството"></textarea></label>
              <button type="submit" class="t27-btn t27-btn--primary" ${busy ? 'disabled' : ''}>Изпрати</button>
            </form>`}
        </section>
      </div></section>`;
  }
  function notificationsView(data) {
    const items=(data?.families||[]).filter(x=>!x.family.archived_at).map(x=>x.family);
    return `<section class="t27-stack"><h2>Център за известия</h2>${banner()}
      <p class="t27-help">Изпращай само на гости, които доброволно са разрешили известията. Без абонамент се показва резултат „0 получатели“.</p>
      ${configured === false ? '<p class="t27-notice" role="status">Изпращането на push е изключено: липсва VAPID конфигурация във Vercel. Съобщенията в приложението продължават да работят.</p>' : ''}
      <form data-admin-notify class="t27-card t27-stack">
        <label class="t27-field">Получател<select name="householdId">
          <option value="">Всички абонирани участници</option>
          ${items.map(item=>`<option value="${e(item.id)}">${e(item.title)}</option>`).join('')}
        </select></label>
        <label class="t27-field">Тип<select name="category">
          <option value="announcements">Организационна новина</option>
          <option value="messages">Съобщение</option>
          <option value="menu">Меню</option>
          <option value="tasks">Задачи</option>
        </select></label>
        <label class="t27-field">Заглавие<input name="title" maxlength="100" required value="Троян 2027"></label>
        <label class="t27-field">Текст<textarea rows="3" name="body" maxlength="250" required></textarea></label>
        <label class="t27-field">Отваряне в приложението<select name="url">
          <option value="/#survey">Анкета</option>
          <option value="/thank-you">Моите отговори</option>
          <option value="/">Начало</option>
        </select></label>
        <button type="submit" class="t27-btn t27-btn--primary" ${busy || configured !== true ? 'disabled' : ''}>Изпрати известие</button>
      </form>
      <section class="t27-card"><h3>Последни изпращания</h3>
        ${logs===null ? '<p>Зареждаме историята…</p>' : logs.length ? `<div class="t27-stack">${logs.map(item => `
          <p><strong>${e(item.title)}</strong> · ${e(item.status)} · ${e(stamp(item.created_at))}</p>`).join('')}</div>`
        : '<p>Все още няма изпратени известия.</p>'}</section>
      </section>`;
  }
  on(app,'click',event=>{
    const button=event.target.closest('[data-admin-thread]');
    if(!button || busy) return;
    void open(button.dataset.adminThread);
  });
  on(app,'submit',async event => {
    const form=event.target;
    if(!form.matches('[data-admin-msg-form], [data-admin-notify]'))return;
    event.preventDefault();if(busy)return;
    busy=true;error='';notice='';
    try {
      if(form.matches('[data-admin-msg-form]')) {
        const body=form.elements.body.value.trim();
        if (!selected || !body) throw new Error('Избери домакинство и напиши съобщение.');
        await partyApi('admin/message',{householdId:selected,body});
        await open(selected);notice='Съобщението е записано в разговора.';
      } else {
        const householdId=form.elements.householdId.value;
        const r=await partyApi('admin/notifications/send',{
          audience:householdId?'single':'all',householdId,category:form.elements.category.value,
          title:form.elements.title.value,body:form.elements.body.value,url:form.elements.url.value
        });
        notice=`Приети от push услугата: ${r.accepted}; неуспешни: ${r.failed}; изтекли: ${r.expired}; абонаменти: ${r.subscribers}.`;
        const result=await partyApi('admin/notifications');logs=result.logs||[];configured=result.configured === true;
      }
    } catch(err) { error=err.message; }
    finally { busy=false;if(alive())rerender(); }
  });
  return { chatView, notificationsView, onMount };
}
