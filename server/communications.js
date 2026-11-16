import { validSubscription, validPushEndpoint, endpointHash, deliverWebPush } from './push.js';
import { RequestError, clean } from './v2-data.js';

const categories = new Set(['messages','announcements','menu','tasks']);
const error = (code,message) => { throw new RequestError(code,message); };
const safeText = (v, max) => clean(v,max);
const validTarget = text => typeof text === 'string' && /^\/(?!\/)[A-Za-z0-9_/#?&=.%+-]{0,180}$/.test(text);
const validHome = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
const safeCategory = cat => categories.has(cat) ? cat : error(400, 'Невалиден тип известие.');
const safeCategories = cat => Array.isArray(cat) && cat.length <= 4 && cat.every(x => categories.has(x))
  ? [...new Set(cat)] : error(400, 'Невалидни настройки за известия.');

function pushOwner(role, householdId) { return role === 'admin' ? 'admin' : householdId; }
function safeSubscription(sub) {
  if (!validSubscription(sub)) error(400, 'Невалиден браузърен push абонамент.');
  return { endpoint:sub.endpoint, hash:endpointHash(sub.endpoint), p256dh:sub.keys.p256dh, auth:sub.keys.auth };
}

async function storeSubscription(db, role, householdId, sub, cats) {
  const data = safeSubscription(sub);
  const chosen = safeCategories(cats);
  const [existing] = await db`SELECT recipient_role, household_id FROM t27_push_subscriptions WHERE endpoint_hash = ${data.hash}`;
  if (existing && (existing.recipient_role !== role || existing.household_id !== householdId)) {
    error(409, 'Това устройство е регистрирано към друг профил. Откажи разрешението в предишния профил.');
  }
  const [limit] = await db`SELECT count(*)::integer AS total FROM t27_push_subscriptions
    WHERE recipient_role = ${role} AND (${role} = 'admin' OR household_id = ${householdId})`;
  if (!existing && limit.total >= 8) error(429, 'Достигнат е лимитът от регистрирани устройства.');
  await db`INSERT INTO t27_push_subscriptions(endpoint_hash,recipient_role,household_id,endpoint,p256dh,auth_secret,categories)
    VALUES (${data.hash},${role},${role === 'guest' ? householdId : null},${data.endpoint},${data.p256dh},${data.auth},${chosen}::text[])
    ON CONFLICT(endpoint_hash) DO UPDATE SET categories=EXCLUDED.categories, updated_at=now()
    WHERE t27_push_subscriptions.recipient_role=EXCLUDED.recipient_role
    AND t27_push_subscriptions.household_id IS NOT DISTINCT FROM EXCLUDED.household_id`;
  return {ok:true,categories:chosen};
}

async function removeSubscription(db, role, householdId, endpoint) {
  if (!validPushEndpoint(endpoint)) error(400,'Невалиден адрес на абонамент.');
  await db`DELETE FROM t27_push_subscriptions
    WHERE endpoint_hash=${endpointHash(endpoint)} AND recipient_role=${role}
      AND (${role}='admin' OR household_id=${householdId})`;
  return {ok:true};
}

async function messageHistory(db, householdId) {
  const rows = await db`SELECT id, sender_role, body, created_at, read_at
    FROM t27_messages WHERE household_id=${householdId}
    ORDER BY created_at DESC, id DESC LIMIT 100`;
  return { messages:rows.reverse() };
}

async function sendMessage(db, householdId, role, body) {
  const text = safeText(body,1200);
  if (!text) error(400,'Напиши съобщение.');
  const [quota] = await db`SELECT count(*)::integer AS total FROM t27_messages
    WHERE household_id=${householdId} AND sender_role=${role} AND created_at > now() - interval '1 minute'`;
  if (quota.total >= (role === 'guest' ? 8 : 20)) error(429,'Изпрати съобщението малко по-късно.');
  const [row] = await db`INSERT INTO t27_messages(household_id,sender_role,body)
    VALUES(${householdId},${role},${text}) RETURNING id,created_at`;
  return {ok:true,message:row};
}

async function pushRecipients(db, role, householdId, category) {
  return role === 'admin'
    ? db`SELECT endpoint_hash,endpoint,p256dh,auth_secret FROM t27_push_subscriptions
      WHERE recipient_role='admin' AND ${category}=ANY(categories) LIMIT 20`
    : db`SELECT endpoint_hash,endpoint,p256dh,auth_secret,household_id FROM t27_push_subscriptions
      WHERE recipient_role='guest' AND (${householdId}::text IS NULL OR household_id=${householdId})
      AND ${category}=ANY(categories) LIMIT 80`;
}

async function notify(db, targets, payload, actor, category) {
  // Fan out concurrently to avoid blocking a serverless request per subscriber.
  const delivered = await Promise.all(targets.map(async subscription => {
    const outcome = await deliverWebPush(subscription,payload);
    await db`INSERT INTO t27_notification_log(household_id,sender_email,endpoint_hash,title,category,status,error_code)
      VALUES(${subscription.household_id ?? null},${actor},${subscription.endpoint_hash},
        ${payload.title},${category},${outcome.status},${outcome.code})`;
    if (outcome.status === 'expired') await db`DELETE FROM t27_push_subscriptions WHERE endpoint_hash=${subscription.endpoint_hash}`;
    return outcome.status;
  }));
  return { accepted:delivered.filter(x=>x==='accepted').length,
    failed:delivered.filter(x=>x==='failed').length,
    expired:delivered.filter(x=>x==='expired').length, subscribers:targets.length };
}

export async function handleCommunications(req, res, path, db, { role, householdId=null, actor='', json }) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const get = req.method === 'GET';
  const guest = role === 'guest';
  const base = guest ? 'guest/' : 'admin/';
  if (!path.startsWith(base)) error(404,'Непознат маршрут.');
  const route = path.slice(base.length);
  const allowed = { messages:'GET', message:'POST', 'messages/read':'POST',
    'push/config':'GET', 'push/subscribe':'POST', 'push/unsubscribe':'POST' };
  if (!guest) Object.assign(allowed,{ notifications:'GET', 'notifications/send':'POST' });
  if (!Object.hasOwn(allowed,route)) error(404,'Непознат маршрут.');
  if (req.method !== allowed[route]) error(405,'Непозволен метод.');
  if(route === 'push/config') return json(res,200,{ enabled:!!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT), publicKey:process.env.VAPID_PUBLIC_KEY || '', categories:[...categories] });
  if(route === 'push/subscribe') return json(res,200,await storeSubscription(db,role,householdId,body.subscription,body.categories));
  if(route === 'push/unsubscribe') return json(res,200,await removeSubscription(db,role,householdId,body.endpoint));
  if(route === 'messages') {
    if (guest) return json(res,200,await messageHistory(db,householdId));
    const id = safeText(req.query?.householdId,64);
    if (id && !validHome(id)) error(400,'Невалидно домакинство.');
    if (id) return json(res,200,await messageHistory(db,id));
    const homes = await db`SELECT h.id,h.title,
      (SELECT count(*)::integer FROM t27_messages m WHERE m.household_id=h.id AND m.sender_role='guest' AND m.read_at IS NULL) AS unread,
      (SELECT max(created_at) FROM t27_messages m WHERE m.household_id=h.id) AS last_message
      FROM households h WHERE h.archived_at IS NULL ORDER BY last_message DESC NULLS LAST,h.title`;
    return json(res,200,{households:homes});
  }
  if(route === 'messages/read') {
    const id=guest?householdId:safeText(body.householdId,64);
    if(!validHome(id)) error(400,'Невалидно домакинство.');
    await db`UPDATE t27_messages SET read_at=now() WHERE household_id=${id}
      AND sender_role=${guest?'admin':'guest'} AND read_at IS NULL`;
    return json(res,200,{ok:true});
  }
  if(route === 'message') {
    const id = guest ? householdId : safeText(body.householdId,64);
    if(!validHome(id)) error(400,'Избери домакинство.');
    const [exists] = await db`SELECT id FROM households WHERE id=${id} AND archived_at IS NULL`;
    if(!exists) error(404,'Няма такова домакинство.');
    return json(res,200,await sendMessage(db,id,role,body.body));
  }
  if(route === 'notifications') {
    const logs=await db`SELECT household_id,title,category,status,error_code,created_at
      FROM t27_notification_log ORDER BY created_at DESC LIMIT 70`;
    return json(res,200,{logs});
  }
  if(route === 'notifications/send') {
    const category=safeCategory(body.category);
    const title=safeText(body.title,100), message=safeText(body.body,250);
    const householdId=body.audience==='all'?null:safeText(body.householdId,64);
    const url=body.url ?? '/#survey';
    if(!title || !message || (householdId!==null && !validHome(householdId)) || !validTarget(url)) error(400,'Провери получателя, текста и адреса на известието.');
    const [rate] = await db`SELECT count(*)::integer AS total FROM t27_notification_log
      WHERE sender_email=${actor} AND created_at > now()-interval '1 hour'`;
    if(rate.total >= 120) error(429,'Лимитът за известия е достигнат.');
    const targets=await pushRecipients(db,'guest',householdId,category);
    const payload={title,body:message,url,category};
    const result=await notify(db,targets,payload,actor,category);
    if(!targets.length) await db`INSERT INTO t27_notification_log(household_id,sender_email,title,category,status)
      VALUES(${householdId},${actor},${title},${category},'not_subscribed')`;
    return json(res,200,{ok:true,...result});
  }
  error(404,'Непознат маршрут.');
}
