import { isDeepStrictEqual } from 'node:util';
import {
  ACTIVITIES, ALLERGENS, CONTRIBUTION_UNITS, DEFAULT_DEFINITION, DIETS, FOOD_GROUPS,
  MEALS, RECIPES, RESTRICTION_TYPES, STATUS_LABELS, TASKS, appliesToMeal
} from '../public/event-catalog.js';

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const clean = (value, max = 250) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const validId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
export const array = value => Array.isArray(value) ? value : [];
const own = (map, id) => typeof id === 'string' && Object.hasOwn(map, id);
const groups = new Set(FOOD_GROUPS.map(group => group.id));
const mealKinds = new Set([...MEALS.map(meal => meal.kind), 'midnight']);
const mealIds = new Set(MEALS.map(meal => meal.id));
const units = new Set(['g', 'ml', 'бр']);

function bad(message) {
  throw new RequestError(400, message);
}

export function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_000_000_000) {
    bad('Невалидна ревизия.');
  }
  return value;
}

export function dateTime(value) {
  const text = clean(value, 5);
  if (text && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) bad('Въведи час във формат ЧЧ:ММ.');
  return text;
}

function choices(value, permits, max, message) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some(id => !permits(id))) bad(message);
  return [...new Set(value)];
}

export function normalizeDefinition(input, previous = DEFAULT_DEFINITION) {
  const form = object(input);
  if (array(form.groups).length !== groups.size || array(form.recipes).length > 100) {
    bad('Определи всички секции и до 100 позиции в каталога.');
  }
  const checkedGroups = form.groups.map(value => {
    const field = object(value);
    const { id, limit } = field;
    const title = clean(field.title, 70);
    const prompt = clean(field.prompt, 160);
    if (!groups.has(id) || !title || !prompt || !Number.isInteger(limit) || limit < 1 || limit > 8) {
      bad('Провери заглавието, текста и лимита за избор на секцията.');
    }
    return { id, title, prompt, limit, enabled: field.enabled !== false, required: field.enabled !== false && field.required === true };
  });
  if (new Set(checkedGroups.map(group => group.id)).size !== groups.size) bad('Всяка секция има отделен идентификатор.');

  const checkedRecipes = array(form.recipes).map(value => {
    const field = object(value);
    const { id, group } = field;
    const name = clean(field.name, 75);
    if (!validId(id) || !groups.has(group) || !name) bad('Провери името и категорията на ястие или напитка.');
    const prior = previous.recipes.find(recipe => recipe.id === id) || RECIPES.find(recipe => recipe.id === id);
    if (prior && prior.group !== group) bad('Използвана позиция запазва категорията си. Добави нова позиция.');
    const kinds = choices(field.kinds, item => mealKinds.has(item), 6, 'Невалидно хранене в каталога.');
    if (!kinds.length) bad('Избери за кое хранене да се предлага позицията.');
    const allergens = choices(field.allergens, id => own(ALLERGENS, id) && id !== 'other', 14, 'Невалидна категория алерген.');
    const entries = array(field.ingredients);
    if (entries.length > 20 || (group !== 'drink' && entries.length < 1)) {
      bad('Всяко ястие трябва да има от 1 до 20 съставки.');
    }
    const ingredients = entries.map(value => {
      const entry = object(value);
      const { amount, unit } = entry;
      const name = clean(entry.name, 75);
      const category = clean(entry.category, 40);
      if (!name || !category || !units.has(unit) || !Number.isFinite(amount) || amount <= 0 || amount > 5000) {
        bad('Въведи име, категория, мерна единица и количество на порция.');
      }
      return { name, category, unit, amount };
    });
    const adultOnly = prior?.adultOnly === true || field.adultOnly === true
      || (group === 'drink' && /алкохол|ракия|вино|розе|бира|уиски|водка|ром\b|джин|ликьор|бренди|коняк|шампан|вермут/i.test(name)
        && !/^(?:Безалкохолно|Безалкохолна напитка|Пенлив сок за наздравица)$/i.test(name));
    return { id, name, group, kinds, ingredients, allergens, adultOnly, archived: field.archived === true, legacy: prior?.legacy ?? [] };
  });
  const ids = new Set(checkedRecipes.map(recipe => recipe.id));
  if (ids.size !== checkedRecipes.length) bad('Идентификаторите на позициите трябва да са уникални.');
  for (const recipe of previous.recipes) {
    if (!ids.has(recipe.id)) bad('Архивирай старата позиция, за да останат четими отговорите.');
  }
  return { groups: checkedGroups, recipes: checkedRecipes };
}

function normalizePerson(value, person, definition, complete, attending) {
  const raw = object(value);
  const given = object(raw.restriction);
  const status = ['none', 'has', 'unknown'].includes(given.status) ? given.status : '';
  if (complete && attending && !status) bad('Посочи хранителните ограничения за всеки човек, който може да дойде.');
  const categories = status === 'has'
    ? choices(given.categories, key => own(ALLERGENS, key), 15, 'Провери избраните категории алергени.')
    : [];
  const kind = status === 'has' && own(RESTRICTION_TYPES, given.kind) ? given.kind : '';
  const details = status === 'has' ? clean(given.details, 450) : '';
  if (complete && attending && status === 'has' && (!kind || (!categories.length && !details) || (categories.includes('other') && !details))) {
    bad('Уточни вида и продукта при отбелязано хранително ограничение.');
  }
  const selected = object(raw.selected);
  const skipped = raw.noPreference === true;
  const noAlcohol = raw.noAlcohol === true && !person.child;
  const selections = {};
  for (const group of definition.groups) {
    if (!group.enabled || group.id === 'tradition') continue;
    const permitted = definition.recipes.filter(recipe => recipe.group === group.id
      && !recipe.archived && !(person.child && recipe.adultOnly) && !(noAlcohol && group.id === 'drink' && recipe.adultOnly));
    const ids = choices(selected[group.id], id => permitted.some(recipe => recipe.id === id), group.limit,
      'Провери избраните ястия и напитки за този участник.');
    if (complete && attending && group.required && permitted.length && !skipped && !ids.length) {
      bad('Попълни задължителните предпочитания или избери „Нямам предпочитание“.');
    }
    selections[group.id] = ids;
  }
  const favourite = clean(raw.favourite, 64);
  if (favourite && !definition.recipes.some(recipe => recipe.id === favourite && !recipe.archived
    && !(person.child && recipe.adultOnly) && recipe.group !== 'drink'
    && appliesToMeal(recipe, MEALS[1]) && Object.values(selections).some(ids => ids.includes(favourite)))) {
    bad('Избери любимо ястие сред отбелязаните варианти за 31 декември.');
  }
  return {
    restriction: { status, kind, categories, details, crossContact: status === 'has' && given.crossContact === true },
    diets: choices(raw.diets, key => own(DIETS, key), 5, 'Невалиден хранителен режим.'),
    dislikes: clean(raw.dislikes, 250), note: clean(raw.note, 450), selected: selections, favourite,
    noPreference: skipped, noAlcohol,
    activities: person.child ? choices(raw.activities, key => own(ACTIVITIES, key), 5, 'Невалидно занимание.') : []
  };
}

export function normalizeSurvey(input, family, definition, complete = false) {
  const raw = object(input);
  const attendance = object(raw.attendance);
  const people = object(raw.people);
  const members = family.members.filter(member => !member.archived_at);
  const memberIds = new Set(members.map(person => person.id));
  if ([...Object.keys(attendance), ...Object.keys(people)].some(id => !memberIds.has(id))) {
    throw new RequestError(403, 'Обнови списъка с хора за това домакинство.');
  }
  const out = {
    attendance: {}, people: {}, shared: {},
    progress: Math.max(0, Math.min(4, Number.isInteger(raw.progress) ? raw.progress : 0)),
    progressPerson: memberIds.has(raw.progressPerson) ? raw.progressPerson : ''
  };
  for (const person of members) {
    const value = object(attendance[person.id]);
    const status = own(STATUS_LABELS, value.status) ? value.status : '';
    const meals = status === 'no' ? [] : choices(value.meals, id => mealIds.has(id), 7, 'Невалиден избор на хранене.');
    if (complete && (!status || (status === 'yes' && !meals.length))) {
      bad('Посочи присъствие за всеки човек и поне едно хранене за потвърдените гости.');
    }
    out.attendance[person.id] = {
      status, meals, arrival: status === 'no' ? '' : clean(value.arrival, 80),
      departure: status === 'no' ? '' : clean(value.departure, 80)
    };
    out.people[person.id] = normalizePerson(people[person.id], person, definition, complete, status === 'yes' || status === 'maybe');
  }
  const shared = object(raw.shared);
  const tradition = definition.groups.find(group => group.id === 'tradition');
  const recipes = definition.recipes.filter(recipe => !recipe.archived);
  const traditionIds = new Set(recipes.filter(recipe => ['tradition', 'sweet'].includes(recipe.group)
    && !recipe.adultOnly && appliesToMeal(recipe, MEALS[1])).map(recipe => recipe.id));
  const contributions = array(shared.contributions);
  if (contributions.length > 12) bad('Въведи до 12 предложения за принос.');
  const contributionIds = new Set();
  out.shared = {
    traditions: tradition?.enabled ? choices(shared.traditions, id => traditionIds.has(id), tradition.limit,
      'Провери избора за празничната трапеза.') : [],
    tasks: choices(shared.tasks, key => own(TASKS, key), 8, 'Невалидна отговорност.'),
    note: clean(shared.note, 650),
    contributions: contributions.map(value => {
      const entry = object(value);
      const { id, quantity, unit, mealId, recipeId = '' } = entry;
      const label = clean(entry.label, 100);
      const recipe = recipes.find(item => item.id === recipeId);
      if (!validId(id) || contributionIds.has(id) || !(label || recipe) || !Number.isFinite(quantity)
        || quantity <= 0 || quantity > 120 || !own(CONTRIBUTION_UNITS, unit) || !mealIds.has(mealId)
        || (recipeId && (!recipe || !appliesToMeal(recipe, MEALS.find(meal => meal.id === mealId))))) {
        bad('Провери ястието, количеството, единицата и храненето в предложението.');
      }
      contributionIds.add(id);
      return { id, quantity, unit, mealId, recipeId, label };
    })
  };
  return out;
}

export function legacyDraft(state, definition) {
  const profile = { attendance: {}, people: {}, shared: { notes: '' }, progress: 0 };
  const ambiguous = {};
  for (const member of state.family.members) {
    const entry = state.attendance[member.id] ?? {};
    profile.attendance[member.id] = {
      status: entry.status ?? '', meals: [],
      legacyDays: entry.status === 'no' ? [] : array(entry.days)
    };
    const answers = object(state.answers[member.id]);
    const restrictions = object(answers.restrictions);
    const selected = {};
    const unmatched = new Set();
    for (const topic of ['food', 'sides', 'drinks', 'breakfast', 'desserts']) {
      for (const label of array(answers[topic]?.selected)) {
        const recipe = definition.recipes.find(recipe => !recipe.archived && recipe.legacy.includes(label)
          && definition.groups.some(group => group.id === recipe.group && group.enabled)
          && !(member.child && recipe.adultOnly));
        if (!recipe) { unmatched.add(label); continue; }
        const list = selected[recipe.group] ??= [];
        const { limit } = definition.groups.find(group => group.id === recipe.group);
        if (!list.includes(recipe.id) && list.length < limit) list.push(recipe.id);
      }
    }
    const categories = Object.entries(ALLERGENS).filter(([, label]) => array(restrictions.allergenCategories).includes(label)).map(([key]) => key);
    if (array(restrictions.allergenCategories).includes('Друго')) categories.push('other');
    profile.people[member.id] = {
      selected, restriction: {
        status: restrictions.allergyStatus || '',
        kind: own(RESTRICTION_TYPES, restrictions.restrictionType) ? restrictions.restrictionType : '',
        details: restrictions.allergens || '', categories
      },
      dislikes: restrictions.dislikes || ''
    };
    if (unmatched.size) ambiguous[member.id] = [...unmatched];
  }
  return { profile, ambiguous };
}

export function summarizeMeals(families, definition, acceptances = []) {
  const summaries = MEALS.map(meal => ({
    ...meal, confirmed: 0, possible: 0, children: 0, childPossible: 0,
    pending: 0, restrictions: [], votes: {}, contributions: []
  }));
  for (const { family, survey } of families) {
    const confirmed = survey?.submitted;
    for (const person of family.members.filter(person => !person.archived_at)) {
      const attendance = confirmed?.attendance?.[person.id];
      for (const meal of summaries) {
        if (!attendance || (attendance.status === 'maybe' && !array(attendance.meals).length)) {
          meal.pending++;
          continue;
        }
        if (!array(attendance.meals).includes(meal.id)) continue;
        if (attendance.status === 'yes') {
          meal.confirmed++;
          if (person.child) meal.children++;
        } else if (attendance.status === 'maybe') {
          meal.possible++;
          if (person.child) meal.childPossible++;
        } else continue;
        const profile = confirmed.people?.[person.id] ?? {};
        const restriction = profile.restriction;
        if (!restriction || restriction.status !== 'none' || array(profile.diets).length) {
          meal.restrictions.push({
            person: person.name, status: attendance.status, restriction, diets: array(profile.diets)
          });
        }
        const picks = new Set(Object.values(object(profile.selected)).flat());
        if (meal.id === '31-dinner') {
          for (const id of array(confirmed.shared?.traditions)) picks.add(id);
        }
        for (const id of picks) {
          const recipe = definition.recipes.find(option => option.id === id && !option.archived);
          if (!recipe || !appliesToMeal(recipe, meal) || (person.child && recipe.adultOnly)) continue;
          const vote = meal.votes[id] ??= { confirmed: 0, possible: 0, favourite: 0 };
          if (attendance.status === 'yes') {
            vote.confirmed++;
            if (profile.favourite === id) vote.favourite++;
          } else vote.possible++;
        }
      }
    }
    for (const proposal of array(confirmed?.shared?.contributions)) {
      const meal = summaries.find(item => item.id === proposal.mealId);
      const approved = acceptances.some(entry => entry.household_id === family.id
        && entry.contribution_id === proposal.id && isDeepStrictEqual(entry.proposal, proposal));
      meal?.contributions.push({ ...proposal, householdId: family.id, household: family.title, approved });
    }
  }
  return summaries;
}

export function shoppingList(menu, recipes, purchases, summaries) {
  const map = new Map();
  const markers = new Map(purchases.map(item => [item.item_id, item]));
  for (const line of menu) {
    const recipe = recipes.find(item => item.id === line.recipe_id);
    const meal = summaries.find(item => item.id === line.slot_id);
    if (!recipe || !meal) continue;
    const provided = meal.contributions.filter(item => item.approved && item.unit === 'portion' && item.recipeId === recipe.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    const portions = Math.max(0, Number(line.portions) - provided);
    for (const ingredient of recipe.ingredients) {
      const { name, category, unit, amount } = ingredient;
      const id = name + '|' + unit;
      const item = map.get(id) ?? { id, name, category, unit, required: 0, usedIn: [] };
      item.required += amount * portions;
      item.usedIn.push(meal.title + ' · ' + recipe.name);
      map.set(id, item);
    }
  }
  const precision = value => Math.round(value * 1000) / 1000;
  return [...map.values()].map(item => {
    const marker = markers.get(item.id);
    const bought = Number(marker?.purchased_qty || 0);
    const stock = Number(marker?.stock_qty || 0);
    const required = item.unit === 'бр' ? Math.ceil(item.required) : precision(item.required);
    return {
      ...item, required, bought, stock, remaining: precision(Math.max(0, required - bought - stock)),
      legacyBought: marker?.purchased_qty == null && marker?.bought === true, assignedTo: marker?.assigned_to ?? ''
    };
  }).sort((a, b) => a.category.localeCompare(b.category, 'bg') || a.name.localeCompare(b.name, 'bg'));
}

export function csvFor(items) {
  const cell = input => {
    const text = String(input ?? '');
    const safe = /^[=+\-@\t\r\n]/u.test(text.trimStart()) || /^[\t\r\n]/u.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const rows = [['Продукт', 'Категория', 'Нужно', 'Наличност', 'Купено', 'За допълване', 'Единица', 'Отговорник']];
  for (const item of items) rows.push([item.name, item.category, item.required, item.stock, item.bought, item.remaining, item.unit, item.assignedTo]);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
