import { ALLERGENS, CONTRIBUTION_UNITS, DAYS, DIETS, MEALS, STATUS_LABELS, TASKS, appliesToMeal } from './event-catalog.js';
import { action, banner, dishImage, escapeHtml as e, partyApi, partyInstance, stamp } from './party-ui.js';
import { icon, loadingMark } from './interface.js';

const tabs = [
  ['families', 'Семейства', 'people'], ['questions', 'Анкета', 'form'], ['catalog', 'Каталог', 'photos'],
  ['menu', 'Меню', 'table'], ['shopping', 'Покупки', 'basket'], ['program', 'Подготовка', 'tasks']
];
const kinds = {
  snack: 'Следобедно хапване', breakfast: 'Закуска', lunch: 'Обяд',
  dinner: 'Вечеря', light: 'Лек обяд', midnight: 'Полунощ на 31.12'
};
const organizerButtons = 't27-btn t27-btn--primary';
const dateLabel = id => DAYS.find(day => day.id === id)?.label ?? id;
const option = (value, label, current) => `<option value="${e(value)}" ${current === value ? 'selected' : ''}>${e(label)}</option>`;
const checked = value => value ? 'checked' : '';
const submissions = survey => !survey ? 'Без нова анкета'
  : !survey.submitted_revision ? 'Чернова'
  : survey.revision === survey.submitted_revision ? 'Изпратена' : 'Непотвърдени промени';
const control = (label, name, value = '', extra = '') =>
  `<label class="t27-field">${e(label)}<input name="${e(name)}" value="${e(value)}" ${extra}></label>`;
const check = (label, name, on) =>
  `<label class="t27-toggle"><input type="checkbox" name="${e(name)}" ${checked(on)}>${e(label)}</label>`;
const saveButton = (label = 'Запази') =>
  `<button type="submit" class="${organizerButtons}">${e(label)}</button>`;
const textarea = (label, name, value = '') =>
  `<label class="t27-field">${e(label)}<textarea name="${e(name)}" rows="2">${e(value)}</textarea></label>`;

export function mountOrganizer({ app, onHome }) {
  const instance = partyInstance(app);
  let data;
  let tab = 'families';
  let opened = '';
  let filter = 'all';
  let mealId = MEALS[1].id;
  let recipeId = '';
  let invite;
  let history;
  let draft;
  let draftDirty = false;
  let previewChild = false;
  let showPreview = false;
  let busy = false;
  let note = '';
  let error = '';
  let loggedOut = false;
  const selection = () => data.families.find(group => group.family.id === opened);
  const editable = () => draft.recipes.find(recipe => recipe.id === recipeId) ?? draft.recipes[0];
  const byName = id => data.recipes.find(recipe => recipe.id === id)?.name ?? id;

  function familyOverview() {
    const catalogue = data.families.filter(({ family, survey }) => {
      if (filter === 'archived') return family.archived_at;
      if (family.archived_at) return false;
      if (filter === 'pending') return !survey || survey.revision !== survey.submitted_revision;
      if (filter === 'submitted') return survey?.submitted_revision === survey?.revision && !!survey;
      return true;
    });
    const selected = selection();
    return `<div class="t27-stats">
      <div><strong>${data.families.filter(group => !group.family.archived_at).length}</strong><span>Активни домакинства</span></div>
      <div><strong>${data.families.filter(group => !group.family.archived_at && group.survey?.submitted_at).length}</strong><span>С изпратена анкета</span></div>
      <div><strong>${data.meals.find(meal => meal.id === '31-dinner').confirmed}</strong><span>За вечерята на 31.12</span></div>
      </div>
      <label class="t27-field t27-filter">Покажи<select data-select27="filter">
      ${[['all', 'Активни'], ['pending', 'Чакат отговор'], ['submitted', 'Изпратени'], ['archived', 'Архив']].map(([id, label]) => option(id, label, filter)).join('')}
      </select></label>
      <div class="t27-family-grid">${catalogue.map(({ family, survey }) => `<button type="button" data-action27="family:${e(family.id)}" aria-pressed="${opened === family.id}" class="t27-family-tile">
        <span class="t27-avatar" aria-hidden="true">${e(family.title.trim().slice(0, 1).toUpperCase())}</span>
        <span><strong>${e(family.title)}</strong><small>${family.members.filter(person => !person.archived_at).length} души · ${submissions(survey)}</small></span>
        <span aria-hidden="true">›</span></button>`).join('')}</div>
      ${selected ? editFamily(selected) : '<p class="t27-help">Избери домакинство, за да редактираш имената, снимката и поканата.</p>'}
      <details class="t27-card"><summary>Добави домакинство</summary>
        <form data-form27="family" class="t27-stack">${control('Име на домакинството', 'title', '', 'required maxlength="100"')}${saveButton('Добави домакинство')}</form>
      </details>`;
  }

  function householdAnswers(family, record, definitions = null, version = null) {
    if (!record) return 'Няма изпратени отговори в тази версия.';
    const membership = Array.isArray(family.members) ? family.members : [];
    const definitionNames = definitions?.[version] ? new Map(definitions[version].recipes.map(recipe => [recipe.id, recipe.name])) : null;
    const foodName = id => definitionNames?.get(id) ?? byName(id);
    return membership.map(person => {
      const attendance = record.attendance?.[person.id];
      const profile = record.people?.[person.id];
      const restriction = profile?.restriction;
      const slots = MEALS.filter(meal => attendance?.meals?.includes(meal.id));
      return `<article class="t27-compact-card">
        <strong>${e(person.name)} · ${e(STATUS_LABELS[attendance?.status] || 'Без отговор')}</strong>
        <p>${e(slots.map(meal => dateLabel(meal.day) + ' · ' + meal.title).join(', '))}</p>
        ${restriction?.status === 'has' ? `<p class="t27-allergy">Ограничение · ${e(restriction.categories.map(id => ALLERGENS[id]).join(', '))}
          ${e(restriction.details)} ${restriction.crossContact ? '· провери общите съдове' : ''}</p>`
          : restriction?.status === 'unknown' ? '<p class="t27-allergy">Ограничения за уточнение</p>' : ''}
        ${profile ? `<p>${e(Object.values(profile.selected ?? {}).flat().map(foodName).join(', '))}</p>
          <p>${e([...(profile.diets ?? []).map(id => DIETS[id]), profile.dislikes, profile.note].filter(Boolean).join(' · '))}</p>` : ''}
      </article>`;
    }).join('');
  }

  function editFamily({ family, survey }) {
    const photo = family.hasPhoto ? `<div class="t27-photo t27-photo--admin"><img alt="Семейна снимка"
      src="/api/v2/admin/photo?id=${encodeURIComponent(family.id)}" loading="lazy"></div>` : '<p class="t27-help">Снимка може да се добави, когато е готова.</p>';
    const memberForm = (person, adding = false) => `<form class="t27-member-editor" data-form27="member" data-id="${e(person.id)}">
      ${control('Име', 'name', person.name, 'required maxlength="70"')}
      ${control('Ред', 'ordinal', person.ordinal, 'type="number" min="0" max="999" required')}
      ${check('Дете', 'child', person.child)} ${adding ? '' : check('В архив', 'archived', person.archived_at)}
      ${saveButton(adding ? 'Добави участник' : 'Запази участника')}
    </form>`;
    return `<article class="t27-card t27-stack">
      <div class="t27-split"><h2>${e(family.title)}</h2><span class="t27-pill">${submissions(survey)}</span></div>
      ${photo}
      <form class="t27-inline-form" data-form27="family-photo">
        <label class="t27-field">Семейна снимка<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label>
        ${saveButton('Запази снимката')}
      </form>
      <form data-form27="family" data-id="${e(family.id)}" class="t27-inline-form">
        ${control('Име на домакинството', 'title', family.title, 'required maxlength="100"')}${check('В архив', 'archived', family.archived_at)}
        ${saveButton('Запази домакинството')}
      </form>
      <details class="t27-fold"><summary>Редактирай участниците</summary>
        ${family.members.map(member => memberForm(member)).join('')}
        ${memberForm({ id: '', name: '', ordinal: Math.max(0, ...family.members.map(member => member.ordinal)) + 1 }, true)}
      </details>
      <details class="t27-fold" ${invite?.home === family.id ? 'open' : ''}><summary>Семейна покана</summary>
        <p>Последен линк · ${family.inviteIssuedAt ? e(stamp(family.inviteIssuedAt)) : 'Няма'}.
          ${family.inviteExpiresAt ? ' Изтича на ' + e(stamp(family.inviteExpiresAt)) + '.' : ''}</p>
        ${family.archived_at ? '' : `<form class="t27-inline-form" data-form27="invite">
          ${control('Валидна до (по желание)', 'expires', '', 'type="date"')}
          ${saveButton(family.inviteIssuedAt ? 'Смени личния линк' : 'Създай личен линк')}
        </form>`}
        ${invite?.home === family.id ? `<label class="t27-field">Личен линк за Viber
          <textarea readonly rows="3" data-invite27>${e(invite.url)}</textarea></label>
          ${action('copy-invite', 'Копирай личния линк', 't27-btn t27-btn--line')}` : ''}
      </details>
      <section class="t27-fold"><h3>Последни изпратени отговори</h3>
        ${householdAnswers(family, survey?.submitted)}
        ${survey?.draft && survey.revision !== survey.submitted_revision ? `<details><summary>Виж запазената чернова</summary>
          ${householdAnswers(family, survey.draft)}</details>` : ''}
        ${action('history', 'Предишни отговори', 't27-btn t27-btn--line')}
        ${history ? `<div class="t27-stack">${history.history.map(entry => `<details class="t27-fold"><summary>Версия ${entry.revision} · ${e(stamp(entry.submitted_at))}</summary>
          ${householdAnswers(family, entry.snapshot, history.definitions, entry.questionnaire_version)}</details>`).join('')}
          <details class="t27-fold"><summary>Записи от старата анкета</summary>${family.members.map(person => {
            const old = history.legacy.answers[person.id] ?? {};
            const answers = Object.values(old).flatMap(value => [...(Array.isArray(value.selected) ? value.selected : []), value.note, value.allergens, value.dislikes]).filter(Boolean);
            const attendance = history.legacy.attendance[person.id];
            return `<p><strong>${e(person.name)}</strong> · ${e(STATUS_LABELS[attendance?.status] || 'Без отговор')} · ${e(answers.join(', ') || 'Без предпочитания')}</p>`;
          }).join('')}</details></div>` : ''}
      </section>
    </article>`;
  }

  function editableInput(label, path, value, attrs = '') {
    return `<label class="t27-field">${e(label)}<input data-edit27="${e(path)}" value="${e(value)}" ${attrs}></label>`;
  }

  function editableCheck(label, path, on) {
    return `<label class="t27-toggle"><input type="checkbox" data-edit27="${e(path)}" ${checked(on)}>${e(label)}</label>`;
  }

  function draftToolbar() {
    return `<div class="t27-card t27-split"><div><strong>Публикувана анкета · версия ${data.questionnaire.version}</strong>
      <p class="t27-help">${draftDirty ? 'Има незапазени промени'
        : data.questionnaire.draft ? 'Черновата е запазена за преглед' : 'Редакциите ще се запазят като чернова'}</p></div>
      <div class="t27-chips">
        ${action('save-draft', 'Запази черновата', 't27-btn t27-btn--line', busy ? 'disabled' : '')}
        ${action('publish', 'Публикувай версия', organizerButtons, draftDirty || !data.questionnaire.draft || busy ? 'disabled' : '')}
      </div></div>`;
  }

  function questionsView() {
    return `${draftToolbar()}<div class="t27-stack">${draft.groups.map((group, index) => `<section class="t27-card t27-stack">
      <div class="t27-split"><h3>${e(group.title)}</h3><div class="t27-chips">
      ${action('up:' + index, '↑ Нагоре', 't27-text-btn', index === 0 ? 'disabled' : '')}
      ${action('down:' + index, '↓ Надолу', 't27-text-btn', index === draft.groups.length - 1 ? 'disabled' : '')}</div></div>
      <div class="t27-fields t27-fields--two">
        ${editableInput('Заглавие', 'groups:' + index + ':title', group.title, 'maxlength="70"')}
        ${editableInput('Въпрос', 'groups:' + index + ':prompt', group.prompt, 'maxlength="160"')}
        ${editableInput('Максимум избора', 'groups:' + index + ':limit', group.limit, 'type="number" min="1" max="8"')}
        ${editableCheck('Покажи секцията', 'groups:' + index + ':enabled', group.enabled)}
        ${group.id === 'tradition' ? '' : editableCheck('Задължителна', 'groups:' + index + ':required', group.required)}
      </div></section>`).join('')}</div>
      <section class="t27-card t27-stack">
        <div class="t27-split"><h3>Преглед на черновата</h3>
          ${action('preview', showPreview ? 'Затвори' : 'Преглед като участник', 't27-btn t27-btn--line')}</div>
        ${showPreview ? `<label class="t27-toggle"><input type="checkbox" data-select27="previewChild" ${checked(previewChild)}>Детски изглед</label>
        ${draft.groups.filter(group => group.enabled).map(group => `<div class="t27-compact-card"><h4>${e(group.title)}</h4>
          <p>${e(group.prompt)} · до ${e(group.limit)}</p><p>${e(draft.recipes.filter(recipe => recipe.group === group.id && !recipe.archived
            && !(previewChild && recipe.adultOnly)).map(recipe => recipe.name).join(', '))}</p></div>`).join('')}` : ''}
      </section>`;
  }

  function catalogView() {
    const item = editable();
    if (!item) return draftToolbar();
    const index = draft.recipes.indexOf(item);
    const prefix = 'recipes:' + index + ':';
    return `${draftToolbar()}<section class="t27-card t27-stack">
      <div class="t27-inline-form"><label class="t27-field">Позиция от каталога<select data-select27="recipe">
      ${draft.recipes.map(recipe => option(recipe.id, recipe.name + (recipe.archived ? ' · архив' : ''), item.id)).join('')}</select></label>
      ${action('recipe-add', '+ Добави позиция', 't27-btn t27-btn--line')}</div>
      <div class="t27-fields t27-fields--two">
        <div>${dishImage(item, data.dishPhotos.includes(item.id))}</div>
        <div class="t27-stack">
          ${editableInput('Име на позицията', prefix + 'name', item.name, 'maxlength="75"')}
          <label class="t27-field">Група<select data-edit27="${prefix}group">
            ${draft.groups.map(group => option(group.id, group.title, item.group)).join('')}</select></label>
          ${editableCheck('Само за възрастни', prefix + 'adultOnly', item.adultOnly)}
          ${editableCheck('В архив', prefix + 'archived', item.archived)}
        </div>
      </div>
      ${item.group === 'drink' ? '' : `<form class="t27-inline-form" data-form27="dish-photo">
        <label class="t27-field">Снимка на ястието<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label>
        ${saveButton('Качи снимка')}</form>`}
      <fieldset class="t27-fold"><legend>Предлага се за</legend><div class="t27-chips">
        ${Object.entries(kinds).map(([id, label]) => editableCheck(label, prefix + 'kinds:' + id, item.kinds.includes(id))).join('')}
      </div></fieldset>
      <fieldset class="t27-fold"><legend>Категории според рецептата</legend><div class="t27-chips">
        ${Object.entries(ALLERGENS).filter(([id]) => id !== 'other').map(([id, label]) => editableCheck(label, prefix + 'allergens:' + id, item.allergens.includes(id))).join('')}
      </div></fieldset>
      <h3>Съставки за една порция</h3>
      ${item.ingredients.map((ingredient, i) => {
        const key = prefix + 'ingredients:' + i + ':';
        return `<div class="t27-member-editor">
          ${editableInput('Продукт', key + 'name', ingredient.name, 'maxlength="75"')}
          ${editableInput('Количество', key + 'amount', ingredient.amount, 'type="number" min="0.01" step="0.01"')}
          <label class="t27-field">Единица<select data-edit27="${key}unit">
          ${[['g', 'г'], ['ml', 'мл'], ['бр', 'бр.']].map(([id, label]) => option(id, label, ingredient.unit)).join('')}</select></label>
          ${editableInput('Категория', key + 'category', ingredient.category, 'maxlength="40"')}
          ${action('ingredient-remove:' + i, 'Премахни', 't27-text-btn')}</div>`;
      }).join('')}
      ${action('ingredient-add', '+ Съставка', 't27-btn t27-btn--line')}
    </section>`;
  }

  function plannedMeal() {
    const meal = data.meals.find(item => item.id === mealId);
    const ordered = data.recipes.filter(recipe => !recipe.archived && appliesToMeal(recipe, meal))
      .sort((a, b) => ((meal.votes[b.id]?.confirmed || 0) - (meal.votes[a.id]?.confirmed || 0)) || a.name.localeCompare(b.name, 'bg'));
    return `<label class="t27-field t27-filter">Хранене<select data-select27="meal">
      ${data.meals.map(item => option(item.id, dateLabel(item.day) + ' · ' + item.title, mealId)).join('')}</select></label>
      <div class="t27-stats">
        <div><strong>${meal.confirmed}</strong><span>Потвърдени · ${meal.children} деца</span></div>
        <div><strong>${meal.possible}</strong><span>Възможни · ${meal.childPossible} деца</span></div>
        <div><strong>${meal.pending}</strong><span>За уточнение</span></div>
      </div>
      ${meal.restrictions.length ? `<section class="t27-card t27-restrictions"><h3>Провери хранителните ограничения</h3>
        ${meal.restrictions.map(({ person, restriction, diets, status }) => `<p><strong>${e(person)}</strong> · ${STATUS_LABELS[status]}
          · ${e(restriction?.status === 'has' ? [restriction.categories.map(id => ALLERGENS[id]).join(', '), restriction.details, restriction.crossContact ? 'общи съдове' : ''].filter(Boolean).join(' · ')
            : restriction?.status === 'none' ? 'Режим' : 'За уточнение')}${diets.length ? ' · ' + e(diets.map(id => DIETS[id]).join(', ')) : ''}</p>`).join('')}
        <p class="t27-help">Сравни действителните съставки, етикетите и използваните съдове.</p></section>` : ''}
      <section class="t27-card"><h3>Одобрени ястия и порции</h3>
        ${data.menu.filter(line => line.slot_id === mealId).map(line => {
          const recipe = data.recipes.find(item => item.id === line.recipe_id);
          const matches = meal.restrictions.filter(item => item.restriction?.categories?.some(id => recipe?.allergens?.includes(id)));
          return `<form class="t27-member-editor" data-form27="menu" data-id="${e(line.recipe_id)}">
            <div><strong>${e(byName(line.recipe_id))}</strong>${recipe?.archived ? '<p class="t27-help">Рецепта от предишния каталог</p>' : ''}
              ${matches.length ? `<p class="t27-allergy">Провери за ${e(matches.map(person => person.person).join(', '))}</p>` : ''}</div>
            ${control('Порции', 'portions', line.portions, 'type="number" min="0" max="120" required')}
            ${check('Проверих съставките', 'reviewed', line.allergen_reviewed)}
            ${saveButton()}${action('remove-menu:' + line.recipe_id, 'Премахни', 't27-text-btn')}
          </form>`;
        }).join('')}
        <form class="t27-inline-form" data-form27="menu">
          <label class="t27-field">Ястие или напитка<select name="recipe" required>
            <option value="">Избери от каталога</option>
            ${ordered.filter(recipe => !data.menu.some(line => line.slot_id === mealId && line.recipe_id === recipe.id))
              .map(recipe => option(recipe.id, recipe.name + (meal.votes[recipe.id] ? ' · ' + meal.votes[recipe.id].confirmed + ' гласа' : ''), '')).join('')}
          </select></label>
          ${control('Порции', 'portions', Math.max(1, meal.confirmed), 'type="number" min="1" max="120" required')}
          ${saveButton('Добави към менюто')}</form>
      </section>
      <section class="t27-card"><h3>Какво носят семействата</h3>
        ${meal.contributions.length ? meal.contributions.map(item => `<article class="t27-split t27-compact-card">
          <div><strong>${e(item.label || byName(item.recipeId))}</strong>
            <p>${e(item.household)} · ${item.quantity} ${e(CONTRIBUTION_UNITS[item.unit])}
              · ${item.approved ? 'Потвърдено' : 'Предложено'}</p></div>
          ${action('contribution:' + item.householdId + ':' + item.id + ':' + !item.approved,
            item.approved ? 'Върни като предложение' : 'Потвърди', 't27-btn t27-btn--line')}</article>`).join('')
          : '<p class="t27-help">Няма предложения за това хранене.</p>'}
      </section>`;
  }

  function shopping() {
    const format = new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 3 });
    return `<div class="t27-split"><h2>Списък за покупки</h2>
      <a class="t27-btn t27-btn--line" href="/api/v2/admin/shopping.csv">Изтегли CSV</a></div>
      <p>Провери наличностите и въведи купеното количество. Остатъкът се преизчислява от одобреното меню.</p>
      ${data.shopping.length ? data.shopping.map(item => `<section class="t27-card">
        <div class="t27-split"><div><h3>${e(item.name)}</h3><p class="t27-help">${e(item.category)} · нужно ${format.format(item.required)} ${e(item.unit)}</p></div>
          <span class="t27-pill ${item.remaining ? 't27-pill--amber' : ''}">
            ${item.remaining ? 'За допълване · ' + format.format(item.remaining) + ' ' + e(item.unit) : 'Осигурено'}
          </span></div>
        ${item.legacyBought ? banner('От предишния списък: отбелязано „Купено“ без количество. Потвърди реалното количество.') : ''}
        <form class="t27-inline-form" data-form27="purchase" data-id="${e(item.id)}">
          ${control('Налични (' + item.unit + ')', 'stock', item.stock, 'type="number" min="0" step="0.001" required')}
          ${control('Купени (' + item.unit + ')', 'bought', item.bought, 'type="number" min="0" step="0.001" required')}
          ${control('Отговорник', 'assigned', item.assignedTo, 'maxlength="80"')}
          ${saveButton()}
        </form></section>`).join('') : '<section class="t27-card"><p>Добави ястия и порции в „Меню“.</p></section>'}`;
  }

  function program() {
    const event = data.event;
    const volunteer = id => data.families.filter(group => !group.family.archived_at && group.survey?.submitted?.shared?.tasks?.includes(id)).map(group => group.family.title);
    return `<form class="t27-stack" data-form27="event">
      <section class="t27-card"><h3>Часове на храненията</h3><div class="t27-fields t27-fields--two">
      ${MEALS.map(meal => control(dateLabel(meal.day) + ' · ' + meal.title, 'time:' + meal.id, event.mealTimes?.[meal.id], 'type="time"')).join('')}
      </div></section>
      <section class="t27-card"><h3>Отговорности за празника</h3>
        ${Object.entries(TASKS).map(([id, label]) => {
          const task = event.chores?.[id] ?? {};
          const base = 'task:' + id + ':';
          return `<fieldset class="t27-fold"><legend>${e(label)}</legend>
            ${volunteer(id).length ? `<p>Предлагат помощ · ${e(volunteer(id).join(', '))}</p>` : ''}
            <div class="t27-fields t27-fields--two">
              ${control('Отговорник', base + 'owner', task.owner, 'maxlength="80"')}
              ${control('Кога', base + 'when', task.when, 'maxlength="70"')}
              ${control('Уточнение', base + 'note', task.note, 'maxlength="220"')}
              <label class="t27-field">Статус<select name="${base}status">
                ${[['open', 'За уточнение'], ['assigned', 'Възложено'], ['done', 'Готово']].map(([key, value]) => option(key, value, task.status || 'open')).join('')}
              </select></label>
            </div></fieldset>`;
        }).join('')}
      </section>
      <section class="t27-card"><h3>Вилата</h3><div class="t27-fields t27-fields--two">
        ${control('Точен адрес', 'address', event.address)}
        ${control('Навигация', 'navigation', event.navigation, 'type="url"')}
        ${control('Настаняване', 'arrival', event.arrival)}
        ${control('Освобождаване', 'departure', event.departure)}
        ${textarea('Какво да носим', 'bring', event.bring)}
        ${textarea('Други указания', 'notes', event.notes)}
      </div></section>${saveButton('Запази подготовката')}
    </form>`;
  }

  const views = { families: familyOverview, questions: questionsView, catalog: catalogView, menu: plannedMeal, shopping, program };

  function render(changeTab = false) {
    if (!instance.alive()) return;
    if (!data) {
      app.innerHTML = `<main class="t27 t27-admin"><section class="t27-entry t27-surface">
        <span class="t27-brand">${icon('cabin')} ТРОЯН · 2027</span>
        ${!loggedOut && !error ? `<div class="t27-load-copy">${loadingMark()}</div>` : ''}
        <h1>${loggedOut ? 'Вход за организатора' : error ? 'Организатор' : 'Зарежда се…'}</h1>
        ${banner(error, 'error')}${loggedOut ? '<a class="t27-btn t27-btn--primary" href="/api/auth/google">Вход с Google</a>' : error ? action('retry', 'Опитай отново') : ''}
        ${action('home', 'Към началото', 't27-text-btn')}
      </section></main>`;
      return;
    }
    app.innerHTML = `<main class="t27 t27-admin"><header class="t27-admin-header">
      <div class="t27-split"><span class="t27-brand">${icon('cabin')} ТРОЯН · 2027</span><div class="t27-chips">
        ${action('home', 'Начало', 't27-text-btn')}${action('logout', 'Изход', 't27-text-btn', '', 'logout')}</div></div>
      <h1>Организация на празника</h1><p>31 декември – 2 януари · Троян</p>
      <nav aria-label="Организатор" class="t27-admin-nav">${tabs.map(([key, label, mark]) =>
        action('tab:' + key, label, 't27-chip', `aria-pressed="${key === tab}"`, mark)).join('')}</nav>
    </header><section class="t27-admin-body ${changeTab ? 't27-motion-in' : ''}" aria-busy="${busy}">
      ${banner(error, 'error')}${banner(note, 'ok')}${views[tab]()}
    </section></main>`;
  }

  async function reload() {
    data = await partyApi('admin/overview');
    if (data && !draftDirty) draft = structuredClone(data.questionnaire.draft ?? data.definition);
  }

  async function run(callback, message = 'Запазено.') {
    if (busy) return;
    busy = true;
    error = '';
    note = '';
    for (const button of app.querySelectorAll('button[type="submit"]')) button.disabled = true;
    try {
      await callback();
      if (message) note = message;
    } catch (problem) {
      error = problem.message;
      if (problem.status === 401) { data = null; loggedOut = true; }
    } finally { busy = false; render(); }
  }

  async function mutation(path, body, message) {
    return run(async () => {
      const response = await partyApi('admin/' + path, body);
      if (response.families) data = response;
      else await reload();
    }, message);
  }

  async function photo64(file) {
    if (!(file instanceof File) || !file.size || file.size > 3_000_000) throw new Error('Избери снимка до 3 MB.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Снимката не може да се прочете.'));
      reader.readAsDataURL(file);
    });
  }

  instance.of(app, 'click', async event => {
    const button = event.target.closest('[data-action27]');
    if (!button || busy || !button.closest('.t27-admin')) return;
    const [name, a, b, c] = button.dataset.action27.split(':');
    if (name === 'home' || name === 'logout') {
      if (draftDirty && !confirm('Има незапазена чернова. Да излезем ли?')) return;
      if (name === 'home') return onHome();
      return run(async () => {
        const result = await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
        if (!result.ok) throw new Error('Изходът е неуспешен. Опитай пак.');
        data = null; draft = null; draftDirty = false; loggedOut = true;
      }, '');
    }
    if (name === 'retry') return run(reload, '');
    if (name === 'tab') {
      tab = a; note = ''; error = ''; render(true);
      app.querySelector('.t27-admin-nav [aria-pressed="true"]')?.focus({ preventScroll: true });
      return;
    }
    if (name === 'family') { opened = a; history = null; note = ''; error = ''; render(); return; }
    if (name === 'history') return run(async () => { history = await partyApi('admin/history?id=' + encodeURIComponent(opened)); }, '');
    if (name === 'copy-invite') {
      return run(async () => { await navigator.clipboard.writeText(invite.url); }, 'Личният линк е копиран.');
    }
    if (name === 'preview') { showPreview = !showPreview; render(); return; }
    if (name === 'up' || name === 'down') {
      const index = Number(a);
      const target = index + (name === 'up' ? -1 : 1);
      [draft.groups[index], draft.groups[target]] = [draft.groups[target], draft.groups[index]];
      draftDirty = true; render(); return;
    }
    if (name === 'recipe-add') {
      recipeId = 'dish-' + crypto.randomUUID();
      draft.recipes.push({ id: recipeId, name: 'Ново ястие', group: 'main', kinds: ['dinner'],
        ingredients: [], allergens: [], adultOnly: false, archived: true });
      draftDirty = true; render(); return;
    }
    if (name === 'ingredient-add' || name === 'ingredient-remove') {
      if (name === 'ingredient-add') editable().ingredients.push({ name: '', amount: 1, unit: 'g', category: 'Основни' });
      else editable().ingredients.splice(Number(a), 1);
      draftDirty = true; render(); return;
    }
    if (name === 'save-draft') return run(async () => {
      await partyApi('admin/questionnaire', { definition: draft, draftRevision: data.questionnaire.draftRevision });
      draftDirty = false;
      await reload();
    }, 'Черновата е запазена.');
    if (name === 'publish') {
      if (!confirm('Да публикуваме новата версия за следващите анкети?')) return;
      return mutation('publish', { draftRevision: data.questionnaire.draftRevision }, 'Новата версия е публикувана.');
    }
    if (name === 'remove-menu') return mutation('menu', { slotId: mealId, recipeId: a, portions: 0 }, 'Ястието е премахнато от храненето.');
    if (name === 'contribution') return mutation('contribution', { householdId: a, contributionId: b, approved: c === 'true' });
  });

  instance.of(app, 'input', event => {
    const target = event.target;
    if (!target.dataset.edit27 || !draft) return;
    const [field, index, property, part, sub] = target.dataset.edit27.split(':');
    const row = draft[field][Number(index)];
    const value = target.type === 'checkbox' ? target.checked : target.type === 'number' ? Number(target.value) : target.value;
    if (['kinds', 'allergens'].includes(property)) {
      row[property] = value ? [...new Set([...row[property], part])] : row[property].filter(item => item !== part);
    } else if (property === 'ingredients') row.ingredients[Number(part)][sub] = value;
    else row[property] = value;
    draftDirty = true;
    const publish = app.querySelector('[data-action27="publish"]');
    if (publish) publish.disabled = true;
  });

  instance.of(app, 'change', event => {
    const field = event.target.dataset.select27;
    if (field === 'filter') { filter = event.target.value; opened = ''; history = null; }
    else if (field === 'meal') mealId = event.target.value;
    else if (field === 'recipe') recipeId = event.target.value;
    else if (field === 'previewChild') previewChild = event.target.checked;
    else if (event.target.dataset.edit27?.endsWith(':group')) { render(); return; }
    else return;
    note = ''; error = ''; render();
  });

  instance.of(app, 'submit', async event => {
    const form = event.target;
    const kind = form.dataset.form27;
    if (!kind) return;
    event.preventDefault();
    if (busy) return;
    const value = new FormData(form);
    const get = name => value.get(name) ?? '';
    const family = selection()?.family;
    const id = form.dataset.id || '';
    if (kind === 'family') return run(async () => {
      const result = await partyApi('admin/family', { id, title: get('title'), archived: value.has('archived') });
      opened = result.id; history = null;
      await reload();
    });
    if (kind === 'member') return mutation('member', { id, householdId: family.id, name: get('name'),
      ordinal: Number(get('ordinal')), child: value.has('child'), archived: value.has('archived') });
    if (kind === 'invite') {
      if (family.inviteIssuedAt && !confirm('Новият линк ще обезсили предишния за това домакинство. Да го сменим ли?')) return;
      return run(async () => {
        const result = await partyApi('admin/invite', { householdId: family.id, expires: get('expires') });
        invite = { home: family.id, url: result.url }; await reload();
      }, 'Личният линк е създаден.');
    }
    if (kind === 'family-photo' || kind === 'dish-photo') {
      return run(async () => {
        if (kind === 'dish-photo' && draftDirty) throw new Error('Първо запази черновата на каталога.');
        await partyApi('admin/' + kind, { id: kind === 'family-photo' ? family.id : editable().id, image: await photo64(get('image')) });
        await reload();
      }, 'Снимката е запазена.');
    }
    if (kind === 'menu') return mutation('menu', { slotId: mealId, recipeId: id || get('recipe'),
      portions: Number(get('portions')), reviewed: value.has('reviewed') });
    if (kind === 'purchase') return mutation('purchase', { id, bought: Number(get('bought')),
      stock: Number(get('stock')), assignedTo: get('assigned') });
    if (kind === 'event') return mutation('event', {
      ...Object.fromEntries(['address', 'navigation', 'arrival', 'departure', 'bring', 'notes'].map(key => [key, get(key)])),
      mealTimes: Object.fromEntries(MEALS.map(meal => [meal.id, get('time:' + meal.id)])),
      chores: Object.fromEntries(Object.keys(TASKS).map(key => [key, Object.fromEntries(['owner', 'when', 'note', 'status']
        .map(property => [property, get('task:' + key + ':' + property)]))]))
    });
  });
  instance.of(window, 'beforeunload', event => {
    if (draftDirty) { event.preventDefault(); event.returnValue = true; }
  });
  render();
  run(reload, '');
  return instance;
}
