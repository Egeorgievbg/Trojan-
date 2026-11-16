import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { isolatedEvent } from './fixture.mjs';
import { RECIPES } from '../public/event-catalog.js';

test('Trojan V2 invitations, survey and organizer against isolated PostgreSQL', async t => {
  const { pg, handler, organizer, invitation } = await isolatedEvent();
  t.after(() => pg.close());
  const admin = 'troian_admin=' + organizer;
  async function request(path, body, cookie = '', options = {}) {
    const url = new URL('/api/' + path, 'https://example.test');
    const headers = {};
    let status = 200;
    let data;
    const res = {
      setHeader(k, v) { headers[k] = v; }, getHeader(k) { return headers[k]; },
      status(code) { status = code; return this; }, json(value) { data = value; },
      end(bytes) { data = bytes; }
    };
    await handler({
      url: url.pathname + url.search, query: Object.fromEntries(url.searchParams),
      method: body === undefined ? 'GET' : 'POST', body,
      headers: { host: url.host, cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...options }
    }, res);
    return { data, status, headers };
  }
  async function join(home, invite) {
    const response = await request('v2/guest/join', { familyId: home, invite });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.deepEqual(response.data, { ok: true });
    assert.match(response.headers['Set-Cookie'][0], /HttpOnly/);
    assert.match(response.headers['Set-Cookie'][0], /SameSite=Lax; Secure/);
    return response.headers['Set-Cookie'][0].split(';')[0];
  }
  const invite = await invitation('household-a');
  const guest = await join('household-a', invite);
  const other = await join('household-b', await invitation('household-b'));
  const adultId = 'adult-a1';
  const childId = 'child-a3';
  let current;
  let draft;
  async function save(survey, revision = current.status.revision, session = guest) {
    return request('v2/guest/draft', { draft: survey, revision, questionnaireVersion: current.questionnaireVersion }, session);
  }
  async function confirm(revision = current.status.revision) {
    return request('v2/guest/confirm', { revision, questionnaireVersion: current.questionnaireVersion }, guest);
  }

  await t.test('public counts, absent authorization and protected portraits', async () => {
    assert.deepEqual((await request('v2/status')).data, { available: true });
    assert.deepEqual((await request('public')).data.overview, { households: 4, participants: 14 });
    assert.deepEqual(Object.keys((await request('public')).data).sort(), ['event', 'overview']);
    for (const path of ['v2/admin/overview', 'v2/admin/shopping.csv', 'v2/admin/photo?id=household-a', 'v2/guest/state', 'v2/guest/photo']) {
      assert.equal((await request(path)).status, 401);
    }
    assert.equal((await request('v2/guest/join', { familyId: 'household-b', invite })).status, 401);
    assert.equal((await request('v2/guest/join', { familyId: 'household-a', invite }, '', { origin: 'https://invalid.test' })).status, 403);
    assert.equal((await request('v2/guest/join', {}, '', { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await request('guest/state', {})).status, 410);
    const expired = await invitation('household-c', '2000-01-01');
    assert.equal((await request('v2/guest/join', { familyId: 'household-c', invite: expired })).status, 401);
    const photo = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#2b673f' } })
      .withMetadata().jpeg().toBuffer();
    assert.equal((await request('v2/admin/family-photo', { id: 'household-a', image: photo.toString('base64') }, guest)).status, 401);
    assert.equal((await request('v2/admin/family-photo', { id: 'household-a', image: 'AAAA' }, admin)).status, 400);
    assert.equal((await request('v2/admin/family-photo', { id: 'household-a', image: photo.toString('base64') }, admin)).status, 200);
    const protectedPhoto = await request('v2/guest/photo', undefined, guest);
    assert.equal(protectedPhoto.status, 200);
    assert.equal(protectedPhoto.headers['Cache-Control'], 'private, no-store');
    assert.equal(protectedPhoto.headers['Cross-Origin-Resource-Policy'], 'same-origin');
    assert.equal((await sharp(protectedPhoto.data).metadata()).exif, undefined);
    assert.equal((await request('v2/guest/photo?id=household-a', undefined, other)).status, 404);
  });

  await t.test('malformed bodies, per-person attendance, restriction and isolated autosave', async () => {
    const result = await request('v2/guest/state', undefined, guest);
    assert.equal(result.status, 200);
    current = result.data;
    assert.equal(current.family.hasPhoto, true);
    assert.equal(current.family.id, 'household-a');
    assert.equal(current.family.members.length, 3);
    draft = {
      attendance: {
        [adultId]: { status: 'yes', meals: ['31-dinner', '01-breakfast'] },
        [childId]: { status: 'yes', meals: ['31-dinner'] },
        'adult-a2': { status: 'maybe', meals: ['31-dinner'] }
      },
      people: {
        [adultId]: { restriction: { status: 'none' }, selected: { main: ['kyufte'], drink: ['rakia-plum'] }, favourite: 'kyufte' },
        [childId]: { restriction: { status: 'has', kind: 'allergy', categories: ['nuts'], details: 'примерни ядки', crossContact: true },
          selected: { drink: ['juice'], sweet: ['fruit'] }, activities: ['workshop'] },
        'adult-a2': { restriction: { status: 'unknown' } }
      },
      shared: { contributions: [{ id: 'dish-a', quantity: 2, unit: 'portion', mealId: '31-dinner', recipeId: 'kyufte' }], traditions: ['fortune-banitsa'] },
      progress: 2, progressPerson: childId
    };
    assert.equal((await save({ ...draft, attendance: { ...draft.attendance, 'adult-b1': { status: 'no' } } })).status, 403);
    assert.equal((await save({ ...draft, shared: { contributions: [null] } })).status, 400);
    const childAlcohol = structuredClone(draft);
    childAlcohol.people[childId].selected.drink = ['wine-red'];
    assert.equal((await save(childAlcohol)).status, 400);
    assert.equal((await save(draft, -1)).status, 400);
    const saved = await save(draft);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.status.revision, 1);
    assert.equal(saved.data.status.submittedRevision, null);
    assert.equal((await save(draft, 0)).data.status.revision, 1);
    const reopened = await join('household-a', invite);
    assert.deepEqual((await request('v2/guest/state', undefined, reopened)).data.draft, saved.data.draft);
    assert.deepEqual(Object.keys((await request('v2/guest/state', undefined, other)).data.draft.people).sort(), ['adult-b1', 'adult-b2', 'child-b3']);
    current = saved.data;
  });

  await t.test('immutable submitted revisions, possible attendance, allergy alerts and votes', async () => {
    const incomplete = structuredClone(draft);
    incomplete.people[childId].restriction = { status: 'has', categories: ['nuts'] };
    current = (await save(incomplete)).data;
    assert.equal((await confirm()).status, 400);
    assert.equal((await save(draft, 0)).status, 409);
    current = (await save(draft)).data;
    assert.equal((await confirm(1)).status, 409);
    assert.equal((await confirm()).status, 200);
    assert.equal((await confirm()).status, 200);
    const plan = (await request('v2/admin/overview', undefined, admin)).data;
    assert.equal(plan.meals.length, 7);
    const dinner = plan.meals.find(item => item.id === '31-dinner');
    assert.deepEqual([dinner.confirmed, dinner.children, dinner.possible], [2, 1, 1]);
    assert.deepEqual(dinner.votes.kyufte, { confirmed: 1, possible: 0, favourite: 1 });
    assert.equal(dinner.restrictions.find(item => item.restriction?.kind === 'allergy').restriction.crossContact, true);
    const history = (await request('v2/admin/history?id=household-a', undefined, admin)).data.history;
    assert.equal(history.length, 1);
    assert.equal(history[0].revision, current.status.revision);
  });

  await t.test('approved portions reduce shopping, quantities and assignment survive recompute and CSV', async () => {
    const menu = portions => request('v2/admin/menu', { slotId: '31-dinner', recipeId: 'kyufte', portions, reviewed: true }, admin);
    const ingredient = result => result.data.shopping.find(item => item.name === 'Кайма');
    assert.equal(ingredient(await menu(10)).required, 1600);
    const approval = await request('v2/admin/contribution', { householdId: 'household-a', contributionId: 'dish-a', approved: true }, admin);
    assert.equal(approval.status, 200, JSON.stringify(approval.data));
    assert.equal(ingredient(approval).required, 1280);
    const { id } = ingredient(approval);
    const bought = await request('v2/admin/purchase', { id, bought: 800, stock: 480, assignedTo: '=Пример' }, admin);
    assert.equal(ingredient(bought).remaining, 0);
    const recomputed = ingredient(await menu(11));
    assert.equal(recomputed.remaining, 160);
    assert.equal(recomputed.bought, 800);
    assert.equal(recomputed.assignedTo, '=Пример');
    const csv = await request('v2/admin/shopping.csv', undefined, admin);
    assert.match(csv.headers['Content-Type'], /text\/csv/);
    assert.match(csv.data, /"'=Пример"/);
    const edited = structuredClone(draft);
    edited.shared.contributions[0].quantity = 3;
    current = (await save(edited)).data;
    assert.equal(ingredient(await request('v2/admin/overview', undefined, admin)).required, 1440);
    assert.equal((await confirm()).status, 200);
    const changed = await request('v2/admin/overview', undefined, admin);
    assert.equal(ingredient(changed).required, 1760);
    assert.equal(changed.data.menu[0].allergen_reviewed, false);
    assert.equal((await request('v2/admin/history?id=household-a', undefined, admin)).data.history.length, 2);
  });

  await t.test('questionnaire revision publishing and existing survey version stay independent', async () => {
    const before = (await request('v2/admin/overview', undefined, admin)).data;
    const malformed = structuredClone(before.definition);
    malformed.groups[0] = null;
    assert.equal((await request('v2/admin/questionnaire', { definition: malformed, draftRevision: 0 }, admin)).status, 400);
    const definition = structuredClone(before.definition);
    definition.groups[0].title = 'Тестово меню';
    const saved = await request('v2/admin/questionnaire', { definition, draftRevision: 0 }, admin);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal((await request('v2/admin/publish', { draftRevision: 0 }, admin)).status, 409);
    assert.equal((await request('v2/admin/publish', { draftRevision: saved.data.draftRevision }, admin)).data.version, 2);
    assert.equal((await request('v2/guest/state', undefined, guest)).data.questionnaireVersion, 1);
    assert.equal((await request('v2/guest/state', undefined, other)).data.questionnaireVersion, 2);
  });

  await t.test('admin edits preserve participant IDs, invitation rotation and session expiry', async () => {
    assert.equal((await request('v2/admin/member', { id: adultId, householdId: 'household-b', name: 'Проба', child: false }, admin)).status, 404);
    assert.equal((await request('v2/admin/member', { id: adultId, householdId: 'household-a', name: 'Редактиран гост', child: false }, admin)).status, 200);
    const person = (await request('v2/guest/state', undefined, guest)).data.family.members.find(item => item.id === adultId);
    assert.equal(person.name, 'Редактиран гост');
    assert.equal((await request('v2/admin/invite', { householdId: 'household-a' }, admin)).status, 200);
    assert.equal((await request('v2/guest/state', undefined, guest)).status, 401);
    assert.equal((await request('v2/guest/join', { familyId: 'household-a', invite })).status, 401);
    await pg.exec("UPDATE guest_sessions SET expires_at = now() - interval '1 second' WHERE household_id = 'household-b'");
    assert.equal((await request('v2/guest/state', undefined, other)).status, 401);
  });
});

test('every bundled dish has distinct responsive WebP assets', async () => {
  const dishes = RECIPES.filter(recipe => recipe.group !== 'drink');
  assert.equal(dishes.length, 32);
  const images = new Set();
  for (const recipe of dishes) {
    for (const width of [320, 640]) {
      const bytes = await readFile(new URL(`../public/food/${recipe.id}-${width}.webp`, import.meta.url));
      const info = await sharp(bytes).metadata();
      assert.equal(info.format, 'webp');
      assert.equal(info.width, width);
      assert.equal(info.height, width * 0.75);
      images.add(bytes.toString('base64'));
    }
  }
  assert.equal(images.size, 64);
});
