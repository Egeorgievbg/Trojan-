import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { SignJWT } from 'jose';

const pg = new PGlite();
await pg.exec(await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
await pg.exec(await readFile(new URL('../sql/seed.sql', import.meta.url), 'utf8'));
let failDatabase = false;
const neon = () => {
  const db = (strings, ...values) => {
    const query = strings.reduce((s, part, i) => s + (i ? '$' + i : '') + part, '');
    const run = async client => {
      if (failDatabase) throw new Error('simulated database failure');
      return (await client.query(query, values)).rows;
    };
    return { run, then(resolve, reject) { return run(pg).then(resolve, reject); } };
  };
  db.transaction = queries => pg.transaction(async tx => {
    const results = [];
    for (const query of queries) results.push(await query.run(tx));
    return results;
  });
  return db;
};
mock.module('@neondatabase/serverless', { namedExports: { neon } });
process.env.DATABASE_URL = 'postgresql://local-test/isolated';
process.env.SESSION_SECRET = randomBytes(48).toString('base64url');
process.env.PUBLIC_BASE_URL = 'https://example.test';
process.env.ADMIN_EMAILS = 'organizer@example.test';
const { default: handler } = await import('../api/index.js');
const key = new TextEncoder().encode(process.env.SESSION_SECRET);
const ticket = email => new SignJWT({ email }).setProtectedHeader({ alg: 'HS256' }).setIssuer('troian-2027').setAudience('troian-admin').setExpirationTime('1h').sign(key);
const admin = { cookie: 'troian_admin=' + await ticket('organizer@example.test') };
async function request(path, body, headers = {}, method = body === undefined ? 'GET' : 'POST') {
  let status = 200, data, responseHeaders = {};
  const res = {
    setHeader(k, v) { responseHeaders[k] = v; }, getHeader(k) { return responseHeaders[k]; },
    status(code) { status = code; return this; }, json(value) { data = value; return this; },
    redirect(code, url) { status = code; data = { url }; }
  };
  await handler({ method, query: { path }, url: '/api/' + path, body, headers: { host: 'example.test', ...headers } }, res);
  return { status, data, headers: responseHeaders };
}

test('API integration against isolated PostgreSQL, never production', async t => {
  await t.test('health fails closed when missing or unreachable', async () => {
    const url = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    assert.equal((await request('health')).status, 503);
    process.env.DATABASE_URL = url;
    failDatabase = true;
    assert.equal((await request('health')).status, 503);
    failDatabase = false;
    assert.equal((await request('health')).status, 200);
  });
  await t.test('four households, fourteen participants, seven meal slots', async () => {
    const publicData = await request('public');
    assert.equal(publicData.status, 200);
    assert.equal(publicData.data.families.length, 4);
    assert.equal(publicData.data.families.flatMap(h => h.members).length, 14);
    assert.equal((await request('admin/overview', undefined, admin)).data.slots.length, 7);
  });
  await t.test('unauthorized admin, wrong allowlist and origin denied', async () => {
    for (const path of ['admin/overview','admin/invite','admin/menu','admin/purchase','admin/import']) {
      assert.equal((await request(path, {})).status, 401);
    }
    const wrong = { cookie: 'troian_admin=' + await ticket('outsider@example.test') };
    assert.equal((await request('admin/overview', undefined, wrong)).status, 401);
    assert.equal((await request('guest/join', {}, { origin: 'https://attacker.test' })).status, 403);
    assert.equal((await request('not-a-route')).status, 404);
    assert.equal((await request('public', {})).status, 405);
  });
  await t.test('OAuth missing credentials and invalid callback are explicit errors', async () => {
    assert.equal((await request('auth/google')).status, 503);
    process.env.GOOGLE_CLIENT_ID = 'test-only';
    process.env.GOOGLE_CLIENT_SECRET = 'test-only';
    assert.equal((await request('auth/callback')).status, 403);
    const login = await request('auth/google');
    assert.equal(login.status, 302);
    assert.equal(new URL(login.data.url).searchParams.get('redirect_uri'), 'https://example.test/api/auth/callback');
    assert.match(login.headers['Set-Cookie'][0], /HttpOnly/);
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
  let token, invite;
  await t.test('private invitation, invalid invitations, scoped state and recovery', async () => {
    assert.equal((await request('guest/join', { familyId: 'family-evgeni', invite: 'invalid' })).status, 401);
    assert.equal((await request('guest/state', { token: 'invalid' })).status, 401);
    const link = await request('admin/invite', { familyId: 'family-evgeni' }, admin);
    assert.equal(link.status, 200);
    invite = new URL(link.data.url).hash.split('.').at(-1);
    const joined = await request('guest/join', { familyId: 'family-evgeni', invite });
    assert.equal(joined.status, 200);
    token = joined.data.token;
    const state = await request('guest/state', { token });
    assert.equal(state.data.family.id, 'family-evgeni');
    assert.equal(state.data.family.members.length, 3);
    assert.deepEqual(Object.keys(state.data.answers).sort(), ['evgeni','iliyana','ivelin']);
    assert.deepEqual((await request('guest/state', { token })).data, state.data);
    assert.equal((await request('guest/save', { token, personId: 'vesko', topic: 'food', value: {} })).status, 403);
    assert.equal((await request('guest/attendance', { token, personId: 'vesko', status: 'yes', days: ['2026-12-31'] })).status, 403);
  });
  await t.test('RSVP, version conflicts, preferences, child drinks and allergies', async () => {
    const attendance = { token, personId: 'evgeni', status: 'yes', days: ['2026-12-31'] };
    assert.equal((await request('guest/attendance', { ...attendance, days: [] })).status, 400);
    assert.equal((await request('guest/attendance', attendance)).status, 200);
    assert.equal((await request('guest/attendance', attendance)).status, 409);
    const preference = { token, personId: 'ivelin', topic: 'drinks', value: { selected: ['Вода','Бира','Ракия','unlisted'] } };
    const saved = await request('guest/save', preference);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.value.selected, ['Вода']);
    assert.equal((await request('guest/save', preference)).status, 409);
    assert.equal((await request('guest/save', { ...preference, version: -1 })).status, 400);
    assert.equal((await request('guest/save', { ...preference, topic: 'restrictions', value: { allergyStatus: 'has' } })).status, 400);
    assert.equal((await request('guest/save', { ...preference, topic: 'restrictions', value: { allergyStatus: 'has', allergens: 'test allergen' } })).status, 200);
    assert.equal((await request('guest/shared', { token, topic: 'table', value: { selected: ['Плодове'], note: 'test' } })).status, 200);
    const recovered = await request('guest/state', { token });
    assert.deepEqual(recovered.data.answers.ivelin.drinks.selected, ['Вода']);
    assert.equal(recovered.data.attendance.evgeni.status, 'yes');
  });
  await t.test('shopping quantities aggregate and preserve bought markers', async () => {
    let result = await request('admin/menu', { slotId: '31-dinner', recipeId: 'grill', portions: 10 }, admin);
    assert.equal(result.status, 200);
    const pork = result.data.shopping.find(x => x.name === 'Свинско месо');
    assert.equal(pork.quantity, 1.9);
    assert.equal(pork.unit, 'кг');
    assert.equal((await request('admin/purchase', { id: pork.id, bought: true, assignedTo: 'test' }, admin)).status, 200);
    result = await request('admin/menu', { slotId: '01-lunch', recipeId: 'grill', portions: 5 }, admin);
    const updated = result.data.shopping.find(x => x.id === pork.id);
    assert.equal(updated.quantity, 2.85);
    assert.equal(updated.bought, true);
    assert.equal(updated.assignedTo, 'test');
    assert.equal((await request('admin/menu', { slotId: 'fake', recipeId: 'grill', portions: 10 }, admin)).status, 400);
  });
  await t.test('authorized migration preview, backup, reconciliation and no overwrite', async () => {
    const payload = { families: [{ id: 'family-evgeni', answers: { ivelin: { drinks: { selected: ['Сок'] } }, evgeni: { food: { selected: ['Пица'] } } }, rsvp: { statuses: { evgeni: 'no', iliyana: 'maybe' } } }] };
    const preview = await request('admin/import-preview', payload, admin);
    assert.equal(preview.status, 200);
    assert.equal(preview.data.summary.existingPreferences, 1);
    assert.equal((await request('admin/import', payload, admin)).status, 409);
    const imported = await request('admin/import', { ...payload, confirm: true, expectedDigest: preview.data.digest }, admin);
    assert.equal(imported.status, 200);
    assert.deepEqual(imported.data.reconciliation, { expected: 2, inserted: 2 });
    const archive = (await pg.query('SELECT payload FROM migration_archives')).rows[0].payload;
    assert.ok(archive.source.families);
    assert.ok(archive.backup.preferences.length);
    const state = (await request('guest/state', { token })).data;
    assert.deepEqual(state.answers.ivelin.drinks.selected, ['Вода']);
    assert.equal(state.attendance.evgeni.status, 'yes');
    const repeated = await request('admin/import', { ...payload, confirm: true, expectedDigest: preview.data.digest }, admin);
    assert.equal(repeated.data.reconciliation.inserted, 0);
  });
  await t.test('rotated invite revokes prior sessions and link', async () => {
    assert.equal((await request('admin/invite', { familyId: 'family-evgeni' }, admin)).status, 200);
    assert.equal((await request('guest/state', { token })).status, 401);
    assert.equal((await request('guest/join', { familyId: 'family-evgeni', invite })).status, 401);
  });
  await pg.close();
});
