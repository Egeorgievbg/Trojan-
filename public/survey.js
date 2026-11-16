import {
  ACTIVITIES, ALLERGENS, CONTRIBUTION_UNITS, DAYS, DIETS, MEALS, NIGHTS, RESTRICTION_TYPES,
  STATUS_LABELS, TASKS, appliesToMeal
} from './event-catalog.js';
import { action, banner, dishImage, escapeHtml as e, partyApi, partyInstance, stamp } from './party-ui.js';
import { icon, loadingMark } from './interface.js';
import { thankYouSection } from './thanks.js';
import { createGuestChat } from './guest-chat.js';
import { createPushPrompt } from './notifications.js';

const stages = [
  { label: 'Присъствие', title: 'Кой ще празнува с нас?', icon: 'calendar' },
  { label: 'Ограничения', title: 'Хранителни ограничения', icon: 'shield' },
  { label: 'Меню', title: 'Меню и напитки', icon: 'table' },
  { label: 'Общ план', title: 'Какво ще подготвим заедно?', icon: 'tasks' },
  { label: 'Преглед', title: 'Готови ли сме?', icon: 'form' }
];

function toggle(values, id, limit) {
  if (values.includes(id)) return values.filter(value => value !== id);
  return values.length < limit ? [...values, id] : null;
}

function buttons(map, values, type, prefix = '') {
  return Object.entries(map).map(([id, label]) => action(
    type + ':' + prefix + id, label, 't27-chip', `aria-pressed="${values.includes(id)}"`
  )).join('');
}

function options(items, selected) {
  return items.map(([id, text]) => `<option value="${e(id)}" ${id === selected ? 'selected' : ''}>${e(text)}</option>`).join('');
}

function eventDetails(event) {
  const entries = [['Къде', event.address], ['Настаняване', event.arrival], ['Освобождаване', event.departure],
    ['Какво да носим', event.bring], ['Указания', event.notes]].filter(([, text]) => text);
  let navigation;
  try {
    const url = new URL(event.navigation);
    if (url.protocol === 'https:' && !url.username && !url.password) navigation = url.href;
  } catch {}
  if (!entries.length && !navigation) return '';
  return `<details class="t27-fold"><summary>Информация за вилата</summary>
    <dl class="t27-review-lines">${entries.map(([label, text]) => `<dt>${label}</dt><dd>${e(text)}</dd>`).join('')}</dl>
    ${navigation ? `<a class="t27-btn" href="${e(navigation)}" target="_blank" rel="noopener noreferrer">Отвори навигацията</a>` : ''}</details>`;
}

function viewModel(source) {
  const draft = structuredClone(source);
  draft.attendance ||= {};
  draft.people ||= {};
  draft.shared = { traditions: [], tasks: [], contributions: [], note: '', ...draft.shared };
  for (const item of Object.values(draft.attendance)) item.nights ||= [];
  return draft;
}

export function mountGuest({ app, link = '', onHome }) {
  const instance = partyInstance(app);
  const chat = createGuestChat(app, instance.alive);
  const push = createPushPrompt(app, 'guest', instance.alive);
  let model;
  let draft;
  let phase = 'loading';
  let step = 0;
  let activePerson = '';
  let message = '';
  let error = '';
  let busy = false;
  let dirty = false;
  let serverConflict = null;
  let compareMode = false;
  let returnToReview = false;
  let openGroups = new Set();
  const attendees = () => model.family.members.filter(person => ['yes', 'maybe'].includes(draft.attendance[person.id]?.status));
  const guestPerson = () => attendees().find(person => person.id === activePerson) ?? attendees()[0];
  const isSubmitted = () => model.status.revision > 0 && model.status.revision === model.status.submittedRevision;

  function attendanceOf(id) {
    return draft.attendance[id] ??= { status: '', meals: [], nights: [], arrival: '', departure: '' };
  }

  function answerFor(id) {
    const answer = draft.people[id] ??= {};
    answer.restriction = { status: '', kind: '', categories: [], details: '', ...answer.restriction };
    answer.diets ||= [];
    answer.selected ||= {};
    answer.activities ||= [];
    return answer;
  }

  function labelledInput(label, field, value, multiline = false, max = 80) {
    const attrs = `data-field="${e(field)}" maxlength="${max}"`;
    return `<label class="t27-field">${e(label)} ${multiline
      ? `<textarea rows="2" ${attrs}>${e(value)}</textarea>`
      : `<input ${attrs} value="${e(value)}">`}</label>`;
  }

  function dishCard(recipe, active, actionName) {
    return `<button type="button" class="t27-choice ${recipe.group === 'drink' ? 't27-choice--text' : ''}"
      aria-pressed="${active}" data-action27="${e(actionName + ':' + recipe.id)}">
      ${dishImage(recipe, model.dishPhotos.includes(recipe.id))}
      <span class="t27-choice-label">${e(recipe.name)}<span class="t27-tick" aria-hidden="true">${active ? icon('check') : ''}</span></span>
    </button>`;
  }

  function presenceCards() {
    return model.family.members.map(person => {
      const entry = attendanceOf(person.id);
      const dates = DAYS.map(day => {
        const meals = MEALS.filter(meal => meal.day === day.id);
        const fully = meals.every(meal => entry.meals.includes(meal.id));
        return `<section class="t27-date">
          <div class="t27-split"><strong>${day.label}</strong>
            ${action('day:' + person.id + ':' + day.id, fully ? 'Изчисти деня' : 'Целият ден', 't27-text-btn',
              `aria-label="${e((fully ? 'Изчисти' : 'Избери') + ' всички хранения за ' + day.label + ' за ' + person.name)}"`)}
          </div>
          <div class="t27-chips">${meals.map(meal => {
            const time = model.event.mealTimes?.[meal.id];
            return action('meal:' + person.id + ':' + meal.id, meal.title + (time ? ' · ' + time : ''),
              't27-chip', `aria-pressed="${entry.meals.includes(meal.id)}"`);
          }).join('')}</div>
        </section>`;
      }).join('');
      return `<fieldset class="t27-card">
        <legend>${e(person.name)} <span class="t27-pill">${person.child ? 'Дете' : 'Възрастен'}</span></legend>
        <div class="t27-chips">${buttons(STATUS_LABELS, [entry.status], 'presence', person.id + ':')}</div>
        ${entry.status && entry.status !== 'no' ? `<div class="t27-dates">
          ${entry.legacyDays?.length ? banner('Има записани дни от предишната анкета. Потвърди конкретните хранения.') : ''}
          ${dates}
          <div class="t27-overnight"><strong>Нощувки</strong><p class="t27-help">Избери вечерите, в които ${e(person.name)} ще остане да спи.</p>
            <div class="t27-chips">${NIGHTS.map(night => action('night:' + person.id + ':' + night.id,
              'Нощувка ' + night.label, 't27-chip', `aria-pressed="${(entry.nights ?? []).includes(night.id)}"`)).join('')}</div>
          </div>
          <details class="t27-fold"><summary>Пристигане и тръгване (по желание)</summary>
            <div class="t27-fields t27-fields--two">
              ${labelledInput('Кога пристига?', 'presence:' + person.id + ':arrival', entry.arrival)}
              ${labelledInput('Кога тръгва?', 'presence:' + person.id + ':departure', entry.departure)}
            </div>
          </details>
        </div>` : ''}
      </fieldset>`;
    }).join('');
  }

  function restrictions(person) {
    const answer = answerFor(person.id);
    const restriction = answer.restriction;
    return `<section class="t27-card">
      <h3>Има ли нещо, което трябва да избягваме?</h3>
      <div class="t27-chips">${buttons({ none: 'Няма известни', has: 'Има', unknown: 'Не знам' },
        [restriction.status], 'restriction')}</div>
      ${restriction.status === 'has' ? `<div class="t27-stack">
        <h4>Какъв е видът?</h4><div class="t27-chips">${buttons(RESTRICTION_TYPES, [restriction.kind], 'kind')}</div>
        <h4>Кои продукти да проверим?</h4><div class="t27-chips">${buttons(ALLERGENS, restriction.categories, 'allergen')}</div>
        ${labelledInput('Точен продукт или уточнение', 'person:details', restriction.details, true, 450)}
        <label class="t27-toggle"><input type="checkbox" data-field="person:crossContact" ${restriction.crossContact ? 'checked' : ''}>
          Нужно е да уточним и общите съдове/прибори</label>
      </div>` : restriction.status === 'unknown' ? banner('Организаторът ще види, че ограниченията са за уточнение.') : ''}
    </section><section class="t27-card">
      <h3>Режим и предпочитания</h3>
      <div class="t27-chips">${buttons(DIETS, answer.diets, 'diet')}</div>
      ${labelledInput('Какво просто не обича? (по желание)', 'person:dislikes', answer.dislikes, true, 250)}
    </section>`;
  }

  function preferences(person) {
    const answer = answerFor(person.id);
    const groups = model.definition.groups.filter(group => group.enabled && group.id !== 'tradition');
    const dishes = model.definition.recipes.filter(recipe => !recipe.archived && !(person.child && recipe.adultOnly));
    const favourites = dishes.filter(recipe => recipe.group !== 'drink' && appliesToMeal(recipe, MEALS[1])
      && (answer.selected[recipe.group] ?? []).includes(recipe.id));
    return `<label class="t27-toggle t27-card"><input data-field="person:noPreference" type="checkbox" ${answer.noPreference ? 'checked' : ''}>
      Нямам предпочитания за менюто</label>
      ${person.child ? '' : `<label class="t27-toggle t27-card"><input data-field="person:noAlcohol" type="checkbox" ${answer.noAlcohol ? 'checked' : ''}>
        Без алкохол за този участник</label>`}
      ${model.legacyChoices[person.id]?.length ? banner('Помогни ни да уточним старите избори: ' + model.legacyChoices[person.id].join(', ')) : ''}
      ${answer.noPreference ? '' : groups.map((group, index) => {
        const recipes = dishes.filter(recipe => recipe.group === group.id && !(answer.noAlcohol && recipe.adultOnly && recipe.group === 'drink'));
        const selected = answer.selected[group.id] ?? [];
        if (!recipes.length) return '';
        const expanded = openGroups.has(group.id) || (!openGroups.size && index === 0);
        return `<details class="t27-card t27-catalog" data-group27="${e(group.id)}" ${expanded ? 'open' : ''}>
          <summary><span>${e(group.title)}</span><small>${selected.length}/${group.limit}</small></summary>
          <p class="t27-help">${e(group.prompt)} ${group.required ? 'Задължителен избор или „Нямам предпочитания“.' : ''}</p>
          <div class="t27-choice-grid">${recipes.map(recipe => dishCard(recipe, selected.includes(recipe.id), 'pick')).join('')}</div>
        </details>`;
      }).join('')}
      ${favourites.length ? `<label class="t27-card t27-field">Първи избор за 31 декември
        <select data-field="person:favourite">${options([['', 'Без първи избор'], ...favourites.map(recipe => [recipe.id, recipe.name])], answer.favourite)}</select>
      </label>` : ''}
      ${person.child ? `<section class="t27-card"><h3>Какво ще е интересно на детето?</h3>
        <div class="t27-chips">${buttons(ACTIVITIES, answer.activities, 'activity')}</div></section>` : ''}
      <div class="t27-card">${labelledInput('Друго предпочитание (по желание)', 'person:note', answer.note, true, 450)}</div>`;
  }

  function familyPlan() {
    const tradition = model.definition.groups.find(group => group.id === 'tradition');
    const recipes = model.definition.recipes.filter(recipe => !recipe.archived && !recipe.adultOnly
      && ['tradition', 'sweet'].includes(recipe.group) && appliesToMeal(recipe, MEALS[1]));
    const available = model.definition.recipes.filter(recipe => !recipe.archived);
    return `${tradition?.enabled ? `<section class="t27-card"><h3>${e(tradition.title)}</h3>
        <p>${e(tradition.prompt)}</p><div class="t27-choice-grid">
          ${recipes.map(recipe => dishCard(recipe, draft.shared.traditions.includes(recipe.id), 'tradition')).join('')}
        </div></section>` : ''}
      <section class="t27-card"><h3>С какво можете да помогнете?</h3>
        <div class="t27-chips">${buttons(TASKS, draft.shared.tasks, 'task')}</div></section>
      <section class="t27-card"><h3>Какво можете да донесете?</h3>
        <p class="t27-help">Например 1 тава баница с локум за новогодишната вечеря.</p>
        ${draft.shared.contributions.map(entry => {
          const variants = available.filter(recipe => appliesToMeal(recipe, MEALS.find(meal => meal.id === entry.mealId) ?? MEALS[1]));
          const key = 'contribution:' + entry.id + ':';
          return `<fieldset class="t27-contribution">
            <legend>Предложение</legend><div class="t27-fields t27-fields--two">
            <label class="t27-field">Хранене<select data-field="${key}mealId">
              ${options(MEALS.map(meal => [meal.id, DAYS.find(day => day.id === meal.day).label + ' · ' + meal.title]), entry.mealId)}
            </select></label>
            <label class="t27-field">Ястие от менюто<select data-field="${key}recipeId">
              ${options([['', 'Друго'], ...variants.map(recipe => [recipe.id, recipe.name])], entry.recipeId)}
            </select></label>
            ${labelledInput('Уточнение или друго ястие', key + 'label', entry.label, false, 100)}
            <label class="t27-field">Количество<input type="number" min="0.1" max="120" step="0.1" data-field="${key}quantity" value="${e(entry.quantity)}"></label>
            <label class="t27-field">Единица<select data-field="${key}unit">
              ${options(Object.entries(CONTRIBUTION_UNITS), entry.unit)}
            </select></label></div>
            ${action('remove-contribution:' + entry.id, 'Премахни предложението', 't27-text-btn')}
          </fieldset>`;
        }).join('')}
        ${draft.shared.contributions.length < 12 ? action('add-contribution', '+ Добави предложение', 't27-btn t27-btn--line') : ''}
        ${labelledInput('Обща бележка (по желание)', 'shared:note', draft.shared.note, true, 650)}
      </section>`;
  }

  function review() {
    const labels = new Map(model.definition.recipes.map(recipe => [recipe.id, recipe.name]));
    const listed = (values, names) => (values ?? []).map(value => names instanceof Map ? names.get(value) : names[value]).filter(Boolean).join(', ');
    const details = model.family.members.map(person => {
      const participation = attendanceOf(person.id);
      const answer = answerFor(person.id);
      const restriction = answer.restriction;
      const foods = listed(Object.values(answer.selected).flat(), labels);
      const presence = MEALS.filter(meal => participation.meals.includes(meal.id)).map(meal => DAYS.find(day => day.id === meal.day).label + ' · ' + meal.title).join(', ');
      const nights = NIGHTS.filter(night => (participation.nights ?? []).includes(night.id)).map(night => night.label).join(', ');
      return `<article class="t27-card t27-review-card">
        <h3>${e(person.name)} <span class="t27-pill">${e(STATUS_LABELS[participation.status] || 'Без отговор')}</span></h3>
        <p>${e(presence || (participation.status === 'maybe' ? 'Храненията са за уточнение' : ''))}</p>
        ${participation.status !== 'no' ? `<p><strong>Нощувки:</strong> ${e(nights || 'Не са уточнени')}</p>` : ''}
        ${participation.status !== 'no' ? `<dl class="t27-review-lines">
          <dt>Ограничения</dt><dd>${e(({ none: 'Няма известни', unknown: 'За уточнение',
            has: [RESTRICTION_TYPES[restriction.kind], listed(restriction.categories, ALLERGENS), restriction.details,
              restriction.crossContact ? 'Уточнение за общите съдове' : ''].filter(Boolean).join(' · ') })[restriction.status] || 'За попълване')}</dd>
          ${answer.diets.length ? `<dt>Режим</dt><dd>${e(listed(answer.diets, DIETS))}</dd>` : ''}
          ${answer.dislikes ? `<dt>Предпочита да избягва</dt><dd>${e(answer.dislikes)}</dd>` : ''}
          <dt>Меню</dt><dd>${e(foods || 'Без избрани предпочитания')}${answer.noAlcohol ? ' · без алкохол' : ''}</dd>
          ${answer.favourite ? `<dt>Първи избор за 31.12</dt><dd>${e(labels.get(answer.favourite))}</dd>` : ''}
          ${answer.note ? `<dt>Бележка</dt><dd>${e(answer.note)}</dd>` : ''}
          ${answer.activities.length ? `<dt>Занимания</dt><dd>${e(listed(answer.activities, ACTIVITIES))}</dd>` : ''}
        </dl><div class="t27-chips">${action('edit:1:' + person.id, 'Редактирай ограничения', 't27-text-btn')}
          ${action('edit:2:' + person.id, 'Редактирай предпочитания', 't27-text-btn')}</div>` : ''}
      </article>`;
    }).join('');
    return `<div class="t27-split"><h3>Участници</h3>${action('edit:0', 'Редактирай присъствие', 't27-text-btn')}</div>${details}
      <section class="t27-card"><h3>Общ план</h3>
        ${draft.shared.traditions.length ? `<p>${e(listed(draft.shared.traditions, labels))}</p>` : ''}
        ${draft.shared.tasks.length ? `<p>${e(listed(draft.shared.tasks, TASKS))}</p>` : ''}
        ${draft.shared.contributions.map(item => `<p>${e(item.label || labels.get(item.recipeId))}
          · ${e(item.quantity)} ${e(CONTRIBUTION_UNITS[item.unit])}</p>`).join('')}
        ${draft.shared.note ? `<p>${e(draft.shared.note)}</p>` : ''}
        ${action('edit:3', 'Редактирай общия план', 't27-text-btn')}</section>`;
  }

  function render(focus = false) {
    if (!instance.alive()) return;
    const scroll = window.scrollY;
    const focused = document.activeElement?.dataset?.action27;
    if (phase === 'loading' || phase === 'error') {
      app.innerHTML = `<main class="t27 t27-guest"><div class="t27-surface t27-entry">
        <span class="t27-brand">${icon('cabin')} ТРОЯН · 2027</span>
        ${phase === 'loading' ? `<div class="t27-load-copy">${loadingMark()}</div>` : ''}
        <h1 tabindex="-1">${phase === 'loading' ? 'Зареждаме поканата…' : 'Семейна покана'}</h1>
        ${banner(error, 'error')}${phase === 'error' ? `<p>Отвори личния линк от Viber. При проблем отвори същия линк в Safari или Chrome.</p>
          <div class="t27-chips">${action('retry', 'Опитай отново')}${action('home', 'Към началото', 't27-btn t27-btn--line')}</div>` : ''}
      </div></main>`;
    } else if (phase === 'welcome' || phase === 'done') {
      const done = phase === 'done';
      app.innerHTML = `<main class="t27 t27-guest"><div class="t27-surface t27-entry ${focus ? 't27-motion-in' : ''}">
        <span class="t27-brand">${icon(done ? 'check' : 'cabin')} ТРОЯН · 31.12–03.01</span>
        <h1 tabindex="-1">${done ? 'Анкетата е изпратена' : e(model.family.title)}</h1>
        ${done ? `<p>Получихме отговорите за ${e(model.family.title)}. Потвърдени на ${e(stamp(model.status.submittedAt))}.</p>`
          : '<p>Една покана за вашето семейство. Отбележете присъствието и попълнете поотделно за всеки.</p>'}
        ${model.family.hasPhoto ? '<div class="t27-photo"><img src="/api/v2/guest/photo" alt="Снимка на вашето домакинство" decoding="async"></div>'
          : `<div class="t27-chips">${model.family.members.map(person => `<span class="t27-pill">${e(person.name)}</span>`).join('')}</div>`}
        ${banner(error, 'error')}
        <div class="t27-chips">
          ${action(done ? 'edit:4' : 'start', done ? 'Прегледай и редактирай' : model.status.revision ? 'Продължи анкетата' : 'Започни анкетата', 't27-btn t27-btn--primary', '', done ? 'edit' : 'next')}
          ${action('leave', 'Изход от семейния профил', 't27-text-btn', busy ? 'disabled' : '')}
        </div>
        ${!done && model.status.revision ? `<p class="t27-resume">Запазен етап · ${e(stages[draft.progress ?? 0].label)}</p>` : ''}
        ${done ? thankYouSection(model, review()) : ''}
        ${eventDetails(model.event)}
      </div></main>`;
    } else {
      const person = step === 1 || step === 2 ? guestPerson() : null;
      const stage = stages[step];
      const content = step === 0 ? presenceCards() : step === 1 && person ? restrictions(person)
        : step === 2 && person ? preferences(person) : step === 3 ? familyPlan() : review();
      app.innerHTML = `<main class="t27 t27-guest">
        <header class="t27-top"><div class="t27-top-inner">
          <div class="t27-split"><span class="t27-brand">${icon('cabin')} ТРОЯН · 2027</span>${action('save-exit', 'Запази и излез', 't27-text-btn', busy ? 'disabled' : '')}</div>
          <div class="t27-progress" role="progressbar" aria-label="Напредък" aria-valuemin="1" aria-valuemax="${stages.length}" aria-valuenow="${step + 1}">
            ${stages.map((_, index) => `<span class="${index <= step ? 'is-filled' : ''}"></span>`).join('')}</div>
          <div class="t27-person-context"><div class="t27-person-name"><span class="t27-person-icon">${icon(person ? 'person' : 'people')}</span><div>
            <small>${person ? 'Попълваш за' : 'За цялото семейство'}</small>
            <strong>${e(person?.name ?? model.family.title)}</strong></div></div>
            ${person ? `<span class="t27-pill">${person.child ? 'Дете' : 'Възрастен'} · ${attendees().indexOf(person) + 1}/${attendees().length}</span>` : ''}
          </div>
        </div></header>
        <section class="t27-step ${focus ? 't27-motion-in' : ''}">
          <p class="t27-kicker"><span class="t27-stage-icon">${icon(stage.icon)}</span>Етап ${step + 1} от 5 · ${e(stage.label)}</p>
          <h1 tabindex="-1">${e(stage.title)}</h1>
          ${step === 0 ? '<p>Отбележи присъствието и храненията по човек.</p>' : ''}
          ${banner(error, 'error')}
          ${serverConflict ? `<section class="t27-notice"><p>Има по-нова версия на сървъра. Твоите незапазени промени са още на този екран.</p>
            <div class="t27-chips">${action('reload-server', 'Зареди по-новата версия', 't27-btn t27-btn--line')}
            ${action('review-conflict', compareMode ? 'Затвори сравнението' : 'Сравни записите', 't27-text-btn')}</div>
            ${compareMode ? `<p>Сървърна ревизия ${e(serverConflict.status.revision)}. Можеш да прегледаш записа и после да нанесеш промени.</p>
              <ul>${serverConflict.family.members.map(member => `<li>${e(member.name)} · ${e(STATUS_LABELS[serverConflict.draft.attendance[member.id]?.status] || 'Без отговор')}
              · ${(serverConflict.draft.attendance[member.id]?.meals ?? []).length} хранения</li>`).join('')}</ul>` : ''}</section>` : ''}
          ${content}
        </section>
        <footer class="t27-bottom">
          <p role="status" class="t27-save">${e(busy ? 'Запазва се…' : dirty ? 'Има незапазени промени' : message || (isSubmitted() ? 'Има изпратена версия' : model.status.revision ? 'Черновата е запазена' : ''))}</p>
          <div class="t27-bottom-actions">
            ${action('back', 'Назад', 't27-btn t27-btn--line', step === 0 || busy ? 'disabled' : '', 'back')}
            ${action('next', step === 4 ? (isSubmitted() && !dirty ? 'Към потвърждението' : 'Изпрати анкетата')
              : 'Запази и продължи', 't27-btn t27-btn--primary', busy ? 'disabled' : '', step === 4 ? 'check' : 'next')}
          </div>
        </footer>
      </main>`;
    }
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      app.querySelector('.t27 h1')?.focus({ preventScroll: true });
    } else {
      [...app.querySelectorAll('[data-action27]')].find(node => node.dataset.action27 === focused)?.focus({ preventScroll: true });
      window.scrollTo({ top: scroll, behavior: 'instant' });
    }
    if (model && phase !== 'loading' && phase !== 'error') {
      chat.mount();
      if (phase === 'welcome' || phase === 'done') void push.show();
    }
  }

  async function start() {
    phase = 'loading';
    error = '';
    render();
    try {
      if (link) {
        const payload = decodeURIComponent(link.slice('#invite='.length));
        const dot = payload.indexOf('.');
        if (dot < 1) throw new Error('Личният линк е непълен.');
        await partyApi('guest/join', { familyId: payload.slice(0, dot), invite: payload.slice(dot + 1) });
        link = '';
      }
      const next = await partyApi('guest/state');
      if (!instance.alive()) return;
      model = next;
      if (!model.family.members.length) throw new Error('Организаторът още добавя участниците в това домакинство.');
      draft = viewModel(model.draft);
      phase = isSubmitted() ? 'done' : 'welcome';
      history.replaceState(null, '', isSubmitted() ? '/thank-you' : '/#survey');
      render(true);
    } catch (problem) {
      if (!instance.alive()) return;
      phase = 'error';
      error = problem.message;
      render(true);
    }
  }

  function selectStage(index, person = '') {
    step = index;
    activePerson = person;
    openGroups = new Set();
    error = '';
    phase = 'form';
    render(true);
  }

  function validateStage() {
    if (step === 0 && model.family.members.some(person => {
      const entry = attendanceOf(person.id);
      return !entry.status || (entry.status === 'yes' && !entry.meals.length);
    })) return 'Посочи кой идва и избери поне едно хранене за всеки потвърден гост.';
    const person = guestPerson();
    if (step === 1 && person) {
      const entry = answerFor(person.id).restriction;
      if (!entry.status) return 'Отбележи има ли ограничения, или избери „Не знам“.';
      if (entry.status === 'has' && (!entry.kind || (!entry.categories.length && !entry.details?.trim())
        || (entry.categories.includes('other') && !entry.details?.trim()))) return 'Уточни вида и какво да избягваме.';
    }
    if (step === 2 && person) {
      const answer = answerFor(person.id);
      if (!answer.noPreference && model.definition.groups.some(group => group.enabled && group.id !== 'tradition'
        && group.required && model.definition.recipes.some(recipe => recipe.group === group.id && !recipe.archived
          && !(person.child && recipe.adultOnly) && !(answer.noAlcohol && recipe.adultOnly && recipe.group === 'drink'))
        && !answer.selected[group.id]?.length)) return 'Попълни задължителните избори или отметни „Нямам предпочитания“.';
    }
    if (draft.shared.contributions.some(item => !(item.recipeId || item.label.trim()) || !(item.quantity > 0))) {
      return 'Довърши или премахни непълното предложение в „Общ план“.';
    }
    return '';
  }

  async function store(nextStep, personId, shouldConfirm = false, exit = false) {
    if (busy) return;
    if (serverConflict) {
      error = 'Първо прегледай по-новия запис от другото устройство.';
      render();
      return;
    }
    busy = true;
    error = '';
    render();
    try {
      if (dirty || !isSubmitted() || !model.status.revision) {
        model = await partyApi('guest/draft', {
          revision: model.status.revision, questionnaireVersion: model.questionnaireVersion,
          draft: { ...draft, progress: nextStep, progressPerson: personId }
        });
        if (!instance.alive()) return;
        draft = viewModel(model.draft);
        dirty = false;
        message = 'Запазено';
      }
      if (shouldConfirm && !isSubmitted()) {
        model = await partyApi('guest/confirm', {
          revision: model.status.revision, questionnaireVersion: model.questionnaireVersion
        });
        if (!instance.alive()) return;
        draft = viewModel(model.draft);
      }
      busy = false;
      if (exit) { onHome(); return; }
      if (shouldConfirm) { phase = 'done'; history.replaceState(null, '', '/thank-you'); render(true); }
      else selectStage(nextStep, personId);
    } catch (problem) {
      if (!instance.alive()) return;
      busy = false;
      error = problem.message;
      if (problem.status === 401 || problem.status === 403) {
        model = null;
        draft = null;
        dirty = false;
        phase = 'error';
      }
      if (problem.status === 409) serverConflict = await partyApi('guest/state').catch(() => null);
      render();
      app.querySelector('[role="alert"]')?.scrollIntoView({ block: 'nearest' });
    }
  }

  function patchChoice(list, id, max, write) {
    const result = toggle(list, id, max);
    if (!result) { error = `Избери до ${max} варианта.`; return; }
    write(result);
    dirty = true;
    error = '';
  }

  function edit(actionName, a, b) {
    const person = guestPerson();
    const answer = person && answerFor(person.id);
    if (actionName === 'presence') {
      const entry = attendanceOf(a);
      entry.status = b;
      if (b === 'no') { entry.meals = []; entry.nights = []; }
    } else if (actionName === 'day') {
      const entry = attendanceOf(a);
      const ids = MEALS.filter(meal => meal.day === b).map(meal => meal.id);
      entry.meals = ids.every(id => entry.meals.includes(id))
        ? entry.meals.filter(id => !ids.includes(id)) : [...new Set([...entry.meals, ...ids])];
    } else if (actionName === 'night') {
      const entry = attendanceOf(a);
      entry.nights = toggle(entry.nights ?? [], b, NIGHTS.length) ?? entry.nights ?? [];
    } else if (actionName === 'meal') {
      const entry = attendanceOf(a);
      entry.meals = toggle(entry.meals, b, MEALS.length) ?? entry.meals;
    } else if (actionName === 'restriction') answer.restriction.status = a;
    else if (actionName === 'kind') answer.restriction.kind = a;
    else if (actionName === 'allergen') return patchChoice(answer.restriction.categories, a, 15, value => { answer.restriction.categories = value; });
    else if (actionName === 'diet') return patchChoice(answer.diets, a, 5, value => { answer.diets = value; });
    else if (actionName === 'activity') return patchChoice(answer.activities, a, 5, value => { answer.activities = value; });
    else if (actionName === 'tradition') return patchChoice(draft.shared.traditions, a,
      model.definition.groups.find(group => group.id === 'tradition').limit, value => { draft.shared.traditions = value; });
    else if (actionName === 'task') return patchChoice(draft.shared.tasks, a, 8, value => { draft.shared.tasks = value; });
    else if (actionName === 'pick') {
      const recipe = model.definition.recipes.find(item => item.id === a);
      const limit = model.definition.groups.find(group => group.id === recipe.group).limit;
      return patchChoice(answer.selected[recipe.group] ?? [], a, limit, value => {
        answer.selected[recipe.group] = value;
        if (answer.favourite === a && !value.includes(a)) answer.favourite = '';
      });
    } else if (actionName === 'add-contribution') {
      draft.shared.contributions.push({ id: crypto.randomUUID(), mealId: '31-dinner', recipeId: '', label: '', quantity: 1, unit: 'portion' });
    } else if (actionName === 'remove-contribution') {
      draft.shared.contributions = draft.shared.contributions.filter(item => item.id !== a);
    } else return;
    dirty = true;
    error = '';
  }

  function follow(direction) {
    if (step !== 1 && step !== 2) return [step + direction, ''];
    const people = attendees();
    const position = people.indexOf(guestPerson());
    const next = people[position + direction];
    if (next) return [step, next.id];
    if (direction < 0 && step === 2) return [1, people.at(-1)?.id ?? ''];
    return [step + direction, ''];
  }

  instance.of(app, 'click', async event => {
    const button = event.target.closest('[data-action27]');
    if (!button || busy || !button.closest('.t27-guest')) return;
    const [name, a, b] = button.dataset.action27.split(':');
    if (name === 'home') return onHome();
    if (name === 'retry') return start();
    if (name === 'push-settings') return void push.show(true);
    if (name === 'start') { returnToReview = false; return selectStage(draft.progress ?? 0, draft.progressPerson); }
    if (name === 'leave') {
      busy = true;
      try { await partyApi('guest/leave', {}); if (instance.alive()) onHome(); }
      catch (problem) { busy = false; error = problem.message; render(); }
      return;
    }
    if (name === 'reload-server' && serverConflict) {
      if (!confirm('Да заредим по-новия запис? Незапазеното от този екран ще се изчисти.')) return;
      model = serverConflict;
      draft = viewModel(model.draft);
      serverConflict = null;
      compareMode = false;
      dirty = false;
      return selectStage(draft.progress ?? 0, draft.progressPerson);
    }
    if (name === 'review-conflict') { compareMode = !compareMode; return render(); }
    if (name === 'edit') { returnToReview = Number(a) !== 4; return selectStage(Number(a), b); }
    if (name === 'back') {
      if (returnToReview) { returnToReview = false; return selectStage(4); }
      if (step === 4 && !attendees().length) return selectStage(0);
      if (step === 3) return selectStage(2, attendees().at(-1)?.id);
      return selectStage(...follow(-1));
    }
    if (name === 'save-exit') return store(step, activePerson, false, true);
    if (name === 'next') {
      error = validateStage();
      if (error) { render(); app.querySelector('[role="alert"]')?.scrollIntoView({ block: 'nearest' }); return; }
      if (step === 4) return store(4, '', true);
      if (step === 0 && !attendees().length) return store(4, '');
      if (returnToReview) { returnToReview = false; return store(4, ''); }
      return store(...follow(1));
    }
    openGroups = new Set([...app.querySelectorAll('[data-group27][open]')].map(node => node.dataset.group27));
    edit(name, a, b);
    render();
  });

  instance.of(app, 'input', event => {
    const field = event.target;
    if (!field.dataset.field || !draft || busy) return;
    const [scope, a, b] = field.dataset.field.split(':');
    const value = field.type === 'checkbox' ? field.checked : field.type === 'number' ? Number(field.value) : field.value;
    if (scope === 'presence') attendanceOf(a)[b] = value;
    else if (scope === 'shared') draft.shared[a] = value;
    else if (scope === 'contribution') {
      const item = draft.shared.contributions.find(entry => entry.id === a);
      if (!item) return;
      item[b] = value;
      if (b === 'mealId') item.recipeId = '';
    } else {
      const answer = answerFor(guestPerson().id);
      if (['details', 'crossContact'].includes(a)) answer.restriction[a] = value;
      else answer[a] = value;
      if (a === 'noPreference' && value) { answer.selected = {}; answer.favourite = ''; }
      if (a === 'noAlcohol' && value) {
        answer.selected.drink = (answer.selected.drink ?? []).filter(id => !model.definition.recipes.find(recipe => recipe.id === id)?.adultOnly);
      }
    }
    dirty = true;
    if (['noAlcohol', 'noPreference', 'mealId'].includes(a === 'mealId' ? a : b ?? a)) render();
    else if (app.querySelector('.t27-save')) app.querySelector('.t27-save').textContent = 'Има незапазени промени';
  });

  instance.of(window, 'beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = true; }
  });
  start();
  return instance;
}
