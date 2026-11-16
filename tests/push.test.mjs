import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes, createHmac, createDecipheriv } from 'node:crypto';
import { encryptPush, validPushEndpoint, validSubscription } from '../server/push.js';

const mac=(key,data)=>createHmac('sha256',key).update(data).digest();
const expand=(key,data,n)=>mac(key,Buffer.concat([data,Buffer.from([1])])).subarray(0,n);

test('push endpoints allow major browser services and reject SSRF targets',()=>{
  for(const endpoint of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/Q123',
    'https://wns2-bl2p.notify.windows.com/w/?token=xyz'
  ]) assert.equal(validPushEndpoint(endpoint),true,endpoint);
  for(const endpoint of [
    'http://localhost:3000', 'https://127.0.0.1/push',
    'https://fcm.googleapis.com.evil.com/send', 'https://evil.com/',
    'https://fcm.googleapis.com:8080/send', 'file:///etc/passwd'
  ]) assert.equal(validPushEndpoint(endpoint),false,endpoint);
});

test('RFC 8291 AES128GCM payload roundtrips through a real browser-style key pair',()=>{
  const ua=createECDH('prime256v1'); const uaPub=ua.generateKeys();
  const auth=randomBytes(16);
  const payload={title:'Троян 2027',body:'Ново съобщение',url:'/#survey',category:'messages'};
  const content=encryptPush(payload,uaPub.toString('base64url'),auth.toString('base64url'));
  assert.equal(content.subarray(16,20).readUInt32BE(0),4096);
  assert.equal(content[20],65);
  const serverPub=content.subarray(21,86);
  const shared=ua.computeSecret(serverPub);
  const ikm=expand(mac(auth,shared),Buffer.concat([Buffer.from('WebPush: info\0'),uaPub,serverPub]),32);
  const prk=mac(content.subarray(0,16),ikm);
  const cek=expand(prk,Buffer.from('Content-Encoding: aes128gcm\0'),16);
  const nonce=expand(prk,Buffer.from('Content-Encoding: nonce\0'),12);
  const ciphertext=content.subarray(86);
  const decipher=createDecipheriv('aes-128-gcm',cek,nonce);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const decrypted=Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]);
  assert.equal(decrypted.at(-1),2);
  assert.deepEqual(JSON.parse(decrypted.subarray(0,-1).toString('utf8')),payload);
});

test('subscriber keys must be browser-generated and nonempty',()=>{
  const ua=createECDH('prime256v1');
  const sub={endpoint:'https://fcm.googleapis.com/fcm/send/abc',
    keys:{p256dh:ua.generateKeys().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
  assert.equal(validSubscription(sub),true);
  assert.equal(validSubscription({...sub,keys:{...sub.keys,auth:'not-valid'}}),false);
});
