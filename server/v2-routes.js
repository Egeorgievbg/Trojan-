import { randomUUID } from 'node:crypto';
import { handleCommunications } from './communications.js';
import { isDeepStrictEqual } from 'node:util';
import {
  DEFAULT_DEFINITION, DAYS, MEALS, RECIPES, TASKS, appliesToMeal
} from '../public/event-catalog.js';
import {
  RequestError, array, clean, csvFor, dateTime, legacyDraft, normalizeDefinition,
  normalizeSurvey, object, revision, shoppingList, summarizeMeals, validId
} from './v2-data.js';

const SESSION_AGE = 60 * 60 * 24 * 70;
const conflict = message => { throw new RequestError(409, message || 'Има по-нов запис. Зареди го, за да сравниш промените.'); };
const missing = message => { throw new RequestError(404, message); };
const invalid = message => { throw new RequestError(400, message); };

export async function releaseSettings(db) {
  const [table] = await db`SELECT to_regclass('public.t27_settings') IS NOT NULL AS present`;
  if (!table?.present) return null;
  const [settings] = await db`
    SELECT enabled, fixture_only, active_version, draft, draft_revision FROM t27_settings WHERE id = 1
  `;
  return settings || null;
}

async function definitionFor(db, version) {
  if (version === 1) return DEFAULT_DEFINITION;
  const [row] = await db`SELECT definition FROM t27_questionnaire_versions WHERE version = ${version}`;
  if (!row) throw new RequestError(503, 'Версията на анкетата временно е недостъпна.');
  return row.definition;
}

async function families(db, householdId = null, includeArchived = false) {
  const [households, members] = await Promise.all([
    db`SELECT h.id, h.title, h.archived_at, (p.household_id IS NOT NULL) AS "hasPhoto",
        i.issued_at AS "inviteIssuedAt", i.expires_at AS "inviteExpiresAt"
        FROM households h LEFT JOIN t27_household_photos p ON p.household_id = h.id
        LEFT JOIN invitations i ON i.household_id = h.id
        WHERE (${householdId}::text IS NULL OR h.id = ${householdId}::text)
          AND (${includeArchived} OR h.archived_at IS NULL) ORDER BY h.title, h.id`,
    db`SELECT id, household_id, name, child, ordinal, archived_at FROM members
        WHERE (${householdId}::text IS NULL OR household_id = ${householdId}::text)
          AND (${includeArchived} OR archived_at IS NULL) ORDER BY ordinal, name, id`
  ]);
  return households.map(family => ({ ...family, members: members.filter(member => member.household_id === family.id) }));
}

async function recordFor(db, id) {
  const [row] = await db`SELECT * FROM t27_surveys WHERE household_id = ${id}`;
  return row ?? null;
}

async function eventSettings(db) {
  const [row] = await db`SELECT value FROM event_settings WHERE id = 1`;
  return row?.value ?? {};
}

function forMembers(draft, family) {
  const ids = new Set(family.members.map(member => member.id));
  const trim = data => Object.fromEntries(Object.entries(object(data)).filter(([id]) => ids.has(id)));
  return { ...draft, attendance: trim(draft?.attendance), people: trim(draft?.people) };
}

async function guestBundle(db, id, settings, legacyState) {
  const [[family], record, event, photoRows, contributions] = await Promise.all([
    families(db, id), recordFor(db, id), eventSettings(db),
    db`SELECT recipe_id FROM t27_dish_photos`,
    db`SELECT h.title AS household, s.submitted->'shared'->'contributions' AS items
      FROM t27_surveys s JOIN households h ON h.id = s.household_id
      WHERE h.archived_at IS NULL AND s.submitted_revision IS NOT NULL`
  ]);
  if (!family) throw new RequestError(401, 'Поканата вече не е активна.');
  const questionnaireVersion = record?.questionnaire_version ?? settings.active_version;
  const definition = await definitionFor(db, questionnaireVersion);
  const historic = record ? null : legacyDraft({ ...await legacyState(db, id), family }, definition);
  const status = {
    revision: record?.revision ?? 0,
    submittedRevision: record?.submitted_revision ?? null,
    submittedAt: record?.submitted_at ?? null
  };
  return {
    family: { id: family.id, title: family.title, hasPhoto: family.hasPhoto, members: family.members },
    questionnaireVersion, definition, status,
    draft: record ? forMembers(record.draft, family) : historic.profile,
    legacyChoices: historic?.ambiguous ?? {},
    dishPhotos: photoRows.map(row => row.recipe_id),
    // Само изрично заявени общи приноси. Личните хранителни предпочитания остават поверителни.
    sharedContributions: contributions.flatMap(row => array(row.items).map(item => ({
      household: row.household, label: clean(item.label, 100),
      recipeId: clean(item.recipeId, 64), quantity: item.quantity, unit: item.unit,
      mealId: clean(item.mealId, 64)
    }))).filter(item => item.label || item.recipeId).slice(0, 120),
    event: Object.fromEntries(['address', 'navigation', 'arrival', 'departure', 'bring', 'notes', 'mealTimes']
      .filter(key => event[key] !== undefined).map(key => [key, event[key]]))
  };
}

async function guestSession(db, tokenHash) {
  if (!tokenHash) return null;
  const [row] = await db`
    SELECT s.household_id FROM guest_sessions s
      JOIN households h ON h.id = s.household_id
      JOIN invitations i ON i.household_id = s.household_id AND i.token_hash = s.invitation_hash
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now() AND h.archived_at IS NULL
      AND (i.expires_at IS NULL OR i.expires_at > now())
  `;
  return row?.household_id ?? null;
}

async function saveSurvey(db, id, body, settings, legacyState, submitting) {
  const expected = revision(body.revision);
  const version = revision(body.questionnaireVersion);
  const [[family], current] = await Promise.all([families(db, id), recordFor(db, id)]);
  if (!family) throw new RequestError(401, 'Поканата вече не е активна.');
  if (version !== (current?.questionnaire_version ?? settings.active_version)) {
    conflict('Въпросникът е обновен. Зареди текущата версия.');
  }
  if (submitting) {
    if (!current || current.revision !== expected) conflict();
    await normalizeSurvey(forMembers(current.draft, family), family, await definitionFor(db, version), true);
    if (current.submitted_revision !== expected) {
      const rows = await db`
        WITH saved AS (
          UPDATE t27_surveys SET submitted = draft, submitted_revision = revision, submitted_at = now()
          WHERE household_id = ${id} AND revision = ${expected} AND submitted_revision IS DISTINCT FROM revision
          RETURNING household_id, revision, questionnaire_version, submitted, submitted_at
        ), history AS (
          INSERT INTO t27_submissions(household_id, revision, questionnaire_version, snapshot, submitted_at)
          SELECT household_id, revision, questionnaire_version, submitted, submitted_at FROM saved
        ), reset_review AS (
          UPDATE menu_items SET allergen_reviewed = false WHERE allergen_reviewed AND EXISTS (SELECT 1 FROM saved)
        )
        SELECT revision FROM saved
      `;
      if (!rows.length && (await recordFor(db, id))?.submitted_revision !== expected) conflict();
    }
  } else {
    const draft = normalizeSurvey(body.draft, family, await definitionFor(db, version));
    if (current?.revision !== expected && !(expected === 0 && !current)) {
      if (!(current?.revision === expected + 1 && isDeepStrictEqual(forMembers(current.draft, family), draft))) conflict();
    } else if (!current || !isDeepStrictEqual(forMembers(current.draft, family), draft)) {
      const rows = expected === 0
        ? await db`INSERT INTO t27_surveys(household_id, questionnaire_version, revision, draft)
            SELECT ${id}, ${version}, 1, ${JSON.stringify(draft)}::jsonb
            FROM t27_settings WHERE id = 1 AND active_version = ${version}
            ON CONFLICT DO NOTHING RETURNING revision`
        : await db`UPDATE t27_surveys SET draft = ${JSON.stringify(draft)}::jsonb, revision = revision + 1, updated_at = now()
            WHERE household_id = ${id} AND revision = ${expected} AND questionnaire_version = ${version}
            RETURNING revision`;
      if (!rows.length) conflict();
    }
  }
  return guestBundle(db, id, settings, legacyState);
}

export async function optimizedPhoto(input) {
  const buffer = Buffer.isBuffer(input) ? input : (() => {
    if (typeof input !== 'string' || input.length > 4_000_000 || input.length % 4 !== 0 || !/^[\w+/]+={0,2}$/.test(input)) {
      invalid('Избери JPEG, PNG или WebP до 3 MB.');
    }
    return Buffer.from(input, 'base64');
  })();
  if (buffer.length > 3_000_000) invalid('Избери изображение до 3 MB.');
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!(jpeg || png || webp)) invalid('Избери JPEG, PNG или WebP.');
  const { default: sharp } = await import('sharp');
  try {
    const image = sharp(buffer, { limitInputPixels: 20_000_000 });
    const info = await image.metadata();
    if ((info.pages ?? 1) !== 1 || info.width < 24 || info.height < 24) invalid('Нужно е неподвижно изображение.');
    return await image.rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#f7f4ed' }).jpeg({ quality: 84 }).toBuffer();
  } catch (error) {
    if (error instanceof RequestError) throw error;
    invalid('Изображението е повредено или твърде голямо.');
  }
}

async function servePhoto(db, response, id, kind) {
  const [row] = kind === 'household'
    ? await db`SELECT encode(photo, 'base64') AS photo FROM t27_household_photos WHERE household_id = ${id}`
    : await db`SELECT encode(photo, 'base64') AS photo FROM t27_dish_photos WHERE recipe_id = ${id}`;
  if (!row) missing('Все още няма снимка.');
  const buffer = Buffer.from(row.photo, 'base64');
  response.setHeader('Content-Type', 'image/jpeg');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Content-Length', String(buffer.length));
  response.status(200).end(buffer);
}

async function planner(db, settings, legacyRecipes) {
  const [homes, rows, menu, purchases, accepted, definition, photoRows, event, olderDefinitions] = await Promise.all([
    families(db, null, true), db`SELECT * FROM t27_surveys`,
    db`SELECT slot_id, recipe_id, portions, allergen_reviewed FROM menu_items`,
    db`SELECT item_id, bought, assigned_to, purchased_qty, stock_qty FROM purchases`,
    db`SELECT household_id, contribution_id, proposal FROM t27_contribution_acceptances`,
    definitionFor(db, settings.active_version), db`SELECT recipe_id FROM t27_dish_photos`,
    eventSettings(db), db`SELECT definition FROM t27_questionnaire_versions ORDER BY version DESC`
  ]);
  const groups = homes.map(family => ({ family, survey: rows.find(row => row.household_id === family.id) || null }));
  const summary = summarizeMeals(groups.filter(group => !group.family.archived_at), definition, accepted);
  const recipes = [...definition.recipes];
  for (const recipe of [...RECIPES, ...olderDefinitions.flatMap(row => row.definition.recipes), ...legacyRecipes]) {
    if (!recipes.some(item => item.id === recipe.id)) recipes.push({ ...recipe, archived: true });
  }
  return {
    families: groups, definition, recipes, menu, meals: summary,
    shopping: shoppingList(menu, recipes, purchases, summary), event,
    dishPhotos: photoRows.map(row => row.recipe_id),
    questionnaire: { version: settings.active_version, draft: settings.draft, draftRevision: settings.draft_revision }
  };
}

function validNavigation(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch {}
  invalid('Навигацията трябва да е валиден HTTPS адрес.');
}

async function saveEvent(db, body) {
  const previous = await eventSettings(db);
  const program = object(body.mealTimes);
  const chores = object(body.chores);
  const event = {
    ...previous, dates: DAYS.map(day => day.id), nights: DAYS.length - 1,
    address: clean(body.address), navigation: validNavigation(clean(body.navigation, 390)),
    arrival: clean(body.arrival, 90), departure: clean(body.departure, 90),
    bring: clean(body.bring, 650), notes: clean(body.notes, 650),
    mealTimes: Object.fromEntries(MEALS.map(meal => [meal.id, dateTime(program[meal.id])])),
    chores: Object.fromEntries(Object.keys(TASKS).map(id => {
      const task = object(chores[id]);
      return [id, {
        owner: clean(task.owner, 80), when: clean(task.when, 70), note: clean(task.note, 220),
        status: ['open', 'assigned', 'done'].includes(task.status) ? task.status : 'open'
      }];
    }))
  };
  await db`INSERT INTO event_settings(id, value) VALUES (1, ${JSON.stringify(event)}::jsonb)
    ON CONFLICT(id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return event;
}

const communicationPaths = new Set(['messages','message','messages/read','push/config','push/subscribe','push/unsubscribe']);
const adminCommunicationPaths = new Set([...communicationPaths,'notifications','notifications/send']);

const methods = {
  'guest/join': 'POST', 'guest/state': 'GET', 'guest/draft': 'POST', 'guest/confirm': 'POST',
  'guest/leave': 'POST', 'guest/photo': 'GET', 'dish-photo': 'GET',
  'guest/messages': 'GET', 'guest/message': 'POST', 'guest/messages/read': 'POST',
  'guest/push/config': 'GET', 'guest/push/subscribe': 'POST', 'guest/push/unsubscribe': 'POST',
  'admin/messages': 'GET', 'admin/message': 'POST', 'admin/messages/read': 'POST',
  'admin/push/config': 'GET', 'admin/push/subscribe': 'POST', 'admin/push/unsubscribe': 'POST',
  'admin/notifications': 'GET', 'admin/notifications/send': 'POST',
  'admin/overview': 'GET', 'admin/history': 'GET', 'admin/family': 'POST', 'admin/member': 'POST',
  'admin/invite': 'POST', 'admin/photo': 'GET', 'admin/family-photo': 'POST', 'admin/dish-photo': 'POST',
  'admin/questionnaire': 'POST', 'admin/publish': 'POST', 'admin/menu': 'POST',
  'admin/contribution': 'POST', 'admin/purchase': 'POST', 'admin/event': 'POST', 'admin/shopping.csv': 'GET'
};

export async function handleV2(req, res, path, db, dependencies) {
  const { json, cookie, setCookie, hash, random, auth, legacyState, legacyRecipes, baseUrl } = dependencies;
  const settings = await releaseSettings(db);
  if (path === 'status' && req.method === 'GET') return json(res, 200, { available: settings?.enabled === true });
  if (!settings?.enabled) return json(res, 503, { message: 'Новият въпросник временно е недостъпен.' });
  if (!Object.hasOwn(methods, path)) return json(res, 404, { message: 'Няма такъв маршрут.' });
  if (req.method !== methods[path]) return json(res, 405, { message: 'Непозволен метод.' });

  const body = object(req.body);
  const session = cookie(req, 'troian_guest');
  const tokenHash = session ? hash(session) : '';
  if (path === 'guest/join') {
    const { familyId, invite } = body;
    if (!validId(familyId) || typeof invite !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(invite)) {
      return json(res, 401, { message: 'Отвори личния семеен линк от Viber.' });
    }
    const nextToken = random();
    const [joined] = await db`
      INSERT INTO guest_sessions(token_hash, household_id, invitation_hash, expires_at)
      SELECT ${hash(nextToken)}, h.id, i.token_hash, now() + interval '70 days'
      FROM households h JOIN invitations i ON i.household_id = h.id
      WHERE h.id = ${familyId} AND h.archived_at IS NULL AND i.token_hash = ${hash(invite)}
        AND (i.expires_at IS NULL OR i.expires_at > now())
      RETURNING household_id
    `;
    if (!joined) return json(res, 401, { message: 'Поканата е сменена, изтекла или невалидна. Поискай нов линк от организатора.' });
    setCookie(res, 'troian_guest', nextToken, SESSION_AGE);
    return json(res, 200, { ok: true });
  }
  if (path === 'guest/leave') {
    if (tokenHash) await db`DELETE FROM guest_sessions WHERE token_hash = ${tokenHash}`;
    setCookie(res, 'troian_guest', '', 0);
    return json(res, 200, { ok: true });
  }
  if (path.startsWith('guest/')) {
    const id = await guestSession(db, tokenHash);
    if (!id) return json(res, 401, { message: 'Отвори отново личния семеен линк от Viber.' });
    if (path === 'guest/photo') return servePhoto(db, res, id, 'household');
    if (communicationPaths.has(path.slice('guest/'.length))) return handleCommunications(req,res,path,db,{role:'guest',householdId:id,json});
    if (path === 'guest/state') return json(res, 200, await guestBundle(db, id, settings, legacyState));
    return json(res, 200, await saveSurvey(db, id, body, settings, legacyState, path === 'guest/confirm'));
  }
  const organizer = await auth(req);
  if (path === 'dish-photo') {
    if (!organizer && !await guestSession(db, tokenHash)) return json(res, 401, { message: 'Нужна е покана.' });
    return servePhoto(db, res, clean(req.query?.id, 64), 'dish');
  }
  if (!organizer) return json(res, 401, { message: 'Само организаторът има достъп.' });
  if (adminCommunicationPaths.has(path.slice('admin/'.length))) return handleCommunications(req,res,path,db,{role:'admin',actor:String(organizer.email||''),json});

  if (path === 'admin/overview') return json(res, 200, await planner(db, settings, legacyRecipes));
  if (path === 'admin/history') {
    const id = clean(req.query?.id, 64);
    const history = await db`SELECT revision, questionnaire_version, snapshot, submitted_at
      FROM t27_submissions WHERE household_id = ${id} ORDER BY revision DESC LIMIT 30`;
    const [family] = await families(db, id, true);
    if (!family) missing('Няма такова домакинство.');
    const legacy = await legacyState(db, id);
    const definitions = {};
    for (const version of new Set(history.map(row => row.questionnaire_version))) definitions[version] = await definitionFor(db, version);
    return json(res, 200, { history, legacy, definitions });
  }
  if (path === 'admin/photo') return servePhoto(db, res, clean(req.query?.id, 64), 'household');
  if (path === 'admin/family' || path === 'admin/member') {
    const table = path === 'admin/family' ? 'household' : 'member';
    const archived = body.archived === true;
    if (table === 'household') {
      const title = clean(body.title, 100);
      if (!title) invalid('Въведи име на домакинството.');
      if (!body.id) {
        const id = 'family-' + randomUUID();
        await db`INSERT INTO households(id, title) VALUES (${id}, ${title})`;
        return json(res, 200, { id });
      }
      const [updated] = await db`UPDATE households SET title = ${title},
        archived_at = CASE WHEN ${archived} THEN coalesce(archived_at, now()) ELSE null END
        WHERE id = ${clean(body.id, 64)} RETURNING id`;
      if (!updated) missing('Няма такова домакинство.');
      return json(res, 200, updated);
    }
    const home = clean(body.householdId, 64);
    const name = clean(body.name, 70);
    const ordinal = body.ordinal ?? 0;
    if (!name || !Number.isInteger(ordinal) || ordinal < 0 || ordinal > 999 || typeof body.child !== 'boolean') {
      invalid('Въведи име, ред и тип участник.');
    }
    if (!body.id) {
      const id = 'person-' + randomUUID();
      const [added] = await db`INSERT INTO members(id, household_id, name, child, ordinal)
        SELECT ${id}, id, ${name}, ${body.child}, ${ordinal} FROM households WHERE id = ${home} AND archived_at IS NULL
        RETURNING id`;
      if (!added) missing('Няма такова активно домакинство.');
      return json(res, 200, added);
    }
    const [updated] = await db`UPDATE members SET name = ${name}, child = ${body.child}, ordinal = ${ordinal},
      archived_at = CASE WHEN ${archived} THEN coalesce(archived_at, now()) ELSE null END
      WHERE id = ${clean(body.id, 64)} AND household_id = ${home} RETURNING id`;
    if (!updated) missing('Участникът не е в това домакинство.');
    return json(res, 200, updated);
  }
  if (path === 'admin/invite') {
    const id = clean(body.householdId, 64);
    const origin = baseUrl(req);
    if (!origin) throw new RequestError(503, 'Липсва адрес на приложението.');
    const expiry = clean(body.expires, 10);
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) invalid('Въведи валидна дата на изтичане.');
    const expiryDate = expiry ? new Date(expiry + 'T23:59:59+02:00') : null;
    if (expiryDate && (!Number.isFinite(+expiryDate) || +expiryDate <= Date.now()
      || expiryDate.toISOString().slice(0, 10) !== expiry)) invalid('Датата на изтичане трябва да е в бъдеще.');
    const invitation = random();
    const [changed] = await db`
      WITH updated AS (
        INSERT INTO invitations(household_id, token_hash, expires_at)
        SELECT id, ${hash(invitation)}, ${expiryDate?.toISOString() ?? null}::timestamptz
        FROM households WHERE id = ${id} AND archived_at IS NULL
        ON CONFLICT (household_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, issued_at = now()
        RETURNING household_id
      ), revoked AS (
        DELETE FROM guest_sessions WHERE household_id IN (SELECT household_id FROM updated)
      )
      SELECT household_id FROM updated
    `;
    if (!changed) missing('Няма такова активно домакинство.');
    return json(res, 200, { url: origin + '/#invite=' + encodeURIComponent(id + '.' + invitation) });
  }
  if (path === 'admin/family-photo' || path === 'admin/dish-photo') {
    const id = clean(body.id, 64);
    const familyPhoto = path === 'admin/family-photo';
    if (familyPhoto) {
      const [family] = await db`SELECT id FROM households WHERE id = ${id}`;
      if (!family) missing('Няма такова домакинство.');
    } else {
      const draft = settings.draft ?? await definitionFor(db, settings.active_version);
      if (!draft.recipes.some(recipe => recipe.id === id && recipe.group !== 'drink')) missing('Ястието липсва в каталога.');
    }
    const photo = (await optimizedPhoto(body.image)).toString('base64');
    if (familyPhoto) {
      await db`INSERT INTO t27_household_photos(household_id, photo) VALUES (${id}, decode(${photo}, 'base64'))
        ON CONFLICT(household_id) DO UPDATE SET photo = EXCLUDED.photo, updated_at = now()`;
    } else {
      await db`INSERT INTO t27_dish_photos(recipe_id, photo) VALUES (${id}, decode(${photo}, 'base64'))
        ON CONFLICT(recipe_id) DO UPDATE SET photo = EXCLUDED.photo, updated_at = now()`;
    }
    return json(res, 200, { ok: true });
  }
  if (path === 'admin/questionnaire') {
    const expected = revision(body.draftRevision);
    const definition = normalizeDefinition(body.definition, await definitionFor(db, settings.active_version));
    const [row] = await db`UPDATE t27_settings SET draft = ${JSON.stringify(definition)}::jsonb, draft_revision = draft_revision + 1
      WHERE id = 1 AND draft_revision = ${expected} RETURNING draft, draft_revision`;
    if (!row) conflict('Черновата е променена. Зареди я отново.');
    return json(res, 200, { definition: row.draft, draftRevision: row.draft_revision });
  }
  if (path === 'admin/publish') {
    const expected = revision(body.draftRevision);
    if (!settings.draft || expected !== settings.draft_revision) conflict('Запази актуалната чернова преди публикуване.');
    const uploaded = new Set((await db`SELECT recipe_id FROM t27_dish_photos`).map(row => row.recipe_id));
    if (settings.draft.recipes.some(recipe => !recipe.archived && recipe.group !== 'drink'
        && !RECIPES.some(initial => initial.id === recipe.id) && !uploaded.has(recipe.id))) {
      invalid('Добави снимка на всяко ново активно ястие преди публикуване.');
    }
    const [row] = await db`
      WITH locked AS (SELECT draft FROM t27_settings WHERE id = 1 AND draft_revision = ${expected} AND draft IS NOT NULL FOR UPDATE),
      published AS (INSERT INTO t27_questionnaire_versions(definition) SELECT draft FROM locked RETURNING version),
      cleared AS (UPDATE menu_items SET allergen_reviewed = false WHERE allergen_reviewed AND EXISTS (SELECT 1 FROM published))
      UPDATE t27_settings SET active_version = published.version, draft = null, draft_revision = draft_revision + 1
      FROM published WHERE id = 1 RETURNING active_version, draft_revision
    `;
    if (!row) conflict('Черновата е променена. Зареди я отново.');
    return json(res, 200, { version: row.active_version, draftRevision: row.draft_revision });
  }
  if (path === 'admin/event') return json(res, 200, { event: await saveEvent(db, body) });

  const plan = await planner(db, settings, legacyRecipes);
  if (path === 'admin/shopping.csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trojan-2027-shopping.csv"');
    return res.status(200).end(csvFor(plan.shopping));
  }
  if (path === 'admin/menu') {
    const { slotId, recipeId, portions } = body;
    const meal = MEALS.find(item => item.id === slotId);
    const recipe = plan.recipes.find(item => item.id === recipeId);
    const existing = plan.menu.find(line => line.slot_id === slotId && line.recipe_id === recipeId);
    if (!meal || !recipe || (!existing && (recipe.archived || !appliesToMeal(recipe, meal)))
      || !Number.isInteger(portions) || portions < 0 || portions > 120) invalid('Провери ястието и броя порции.');
    if (portions === 0) {
      await db`DELETE FROM menu_items WHERE slot_id = ${slotId} AND recipe_id = ${recipeId}`;
    } else {
      await db`INSERT INTO menu_items(slot_id, recipe_id, portions, allergen_reviewed)
        VALUES (${slotId}, ${recipeId}, ${portions}, ${body.reviewed === true})
        ON CONFLICT(slot_id, recipe_id) DO UPDATE SET portions = EXCLUDED.portions, allergen_reviewed = EXCLUDED.allergen_reviewed`;
    }
  }
  if (path === 'admin/contribution') {
    const { householdId, contributionId, approved } = body;
    const proposal = plan.meals.flatMap(meal => meal.contributions)
      .find(item => item.householdId === householdId && item.id === contributionId);
    if (!proposal || typeof approved !== 'boolean') invalid('Предложението вече не е налично.');
    const { householdId: home, household, approved: previous, ...snapshot } = proposal;
    if (approved) {
      await db`INSERT INTO t27_contribution_acceptances(household_id, contribution_id, proposal)
        VALUES (${home}, ${contributionId}, ${JSON.stringify(snapshot)}::jsonb)
        ON CONFLICT(household_id, contribution_id) DO UPDATE SET proposal = EXCLUDED.proposal`;
    } else {
      await db`DELETE FROM t27_contribution_acceptances WHERE household_id = ${home} AND contribution_id = ${contributionId}`;
    }
  }
  if (path === 'admin/purchase') {
    const { id, bought, stock } = body;
    const item = plan.shopping.find(row => row.id === id);
    const quantity = number => Number.isFinite(number) && number >= 0 && number <= 9_000_000;
    if (!item || !quantity(bought) || !quantity(stock)) invalid('Провери наличността и купеното количество.');
    await db`INSERT INTO purchases(item_id, purchased_qty, stock_qty, bought, assigned_to)
      VALUES (${id}, ${bought}, ${stock}, ${bought + stock >= item.required}, ${clean(body.assignedTo, 80)})
      ON CONFLICT(item_id) DO UPDATE SET purchased_qty = EXCLUDED.purchased_qty, stock_qty = EXCLUDED.stock_qty,
      bought = EXCLUDED.bought, assigned_to = EXCLUDED.assigned_to, updated_at = now()`;
  }
  return json(res, 200, await planner(db, settings, legacyRecipes));
}
