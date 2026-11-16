import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign, createHash } from 'node:crypto';

const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const b64 = value => Buffer.from(value).toString('base64url');
const hkdf = (key, value, length) => hmac(key, Buffer.concat([value, Buffer.from([1])])).subarray(0, length);
export const endpointHash = endpoint => createHash('sha256').update(endpoint).digest('hex');

export function validPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com',
      'notify.windows.com', 'wns.windows.com'].some(root => host === root || host.endsWith('.' + root));
  } catch { return false; }
}

export function validSubscription(value) {
  if (!value || !validPushEndpoint(value.endpoint)) return false;
  const ua = typeof value.keys?.p256dh === 'string' ? Buffer.from(value.keys.p256dh, 'base64url') : Buffer.alloc(0);
  const auth = typeof value.keys?.auth === 'string' ? Buffer.from(value.keys.auth, 'base64url') : Buffer.alloc(0);
  return ua.length === 65 && ua[0] === 4 && auth.length === 16;
}

// RFC 8291 single-record aes128gcm encryption. Never log the endpoint or auth keys.
export function encryptPush(payload, p256dh, authSecret, randomSalt = randomBytes(16)) {
  const userPub = Buffer.from(p256dh, 'base64url');
  const auth = Buffer.from(authSecret, 'base64url');
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  if (userPub.length !== 65 || userPub[0] !== 4 || auth.length !== 16 || plaintext.length > 2900) {
    throw new Error('Невалиден или прекалено голям push payload.');
  }
  const ephemeral = createECDH('prime256v1');
  const serverPub = ephemeral.generateKeys();
  const shared = ephemeral.computeSecret(userPub);
  const ikm = hkdf(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), userPub, serverPub]), 32);
  const prk = hmac(randomSalt, ikm);
  const cek = hkdf(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(5);
  header.writeUInt32BE(4096, 0);
  header[4] = 65;
  return Buffer.concat([randomSalt, header, serverPub, ciphertext]);
}

function vapidAuthorization(endpoint) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!privateKey || !publicKey || !/^mailto:.+@.+|^https:\/\/.+/.test(subject || '')) {
    throw new Error('Липсва VAPID конфигурация.');
  }
  const pair = createECDH('prime256v1');
  pair.setPrivateKey(Buffer.from(privateKey, 'base64url'));
  const publicBytes = pair.getPublicKey();
  if (b64(publicBytes) !== publicKey) throw new Error('VAPID ключовете не съвпадат.');
  const x = b64(publicBytes.subarray(1, 33));
  const y = b64(publicBytes.subarray(33, 65));
  const key = createPrivateKey({ key: { kty:'EC', crv:'P-256', x, y, d:privateKey }, format:'jwk' });
  const header = b64(JSON.stringify({typ:'JWT',alg:'ES256'}));
  const body = b64(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:subject}));
  const input = header + '.' + body;
  const signature = b64(sign('sha256', Buffer.from(input), {key,dsaEncoding:'ieee-p1363'}));
  return 'vapid t=' + input + '.' + signature + ', k=' + publicKey;
}

export async function deliverWebPush(subscription, payload) {
  if (!validSubscription({endpoint: subscription.endpoint, keys:{p256dh:subscription.p256dh,auth:subscription.auth_secret}})) {
    return {status:'failed', code:400};
  }
  try {
    const body = encryptPush(payload, subscription.p256dh, subscription.auth_secret);
    const response = await fetch(subscription.endpoint, {
      method:'POST', redirect:'error', signal: AbortSignal.timeout(6500),
      headers: {
        'Authorization': vapidAuthorization(subscription.endpoint),
        'Content-Type':'application/octet-stream', 'Content-Encoding':'aes128gcm',
        'TTL':'3600', 'Urgency':'normal'
      },
      body
    });
    const code = response.status;
    return {status: [404,410].includes(code) ? 'expired' : response.ok ? 'accepted' : 'failed', code};
  } catch { return {status:'failed', code:0}; }
}
