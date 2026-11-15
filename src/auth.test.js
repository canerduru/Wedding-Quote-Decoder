import test from 'node:test';
import assert from 'node:assert/strict';
import { createBasicAuth } from './auth.js';

const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

function run(middleware, { path = '/', authorization, ip = '1.2.3.4' } = {}) {
  const out = { status: null, headers: {}, nextCalled: false };
  const res = {
    status(code) {
      out.status = code;
      return this;
    },
    set(key, value) {
      out.headers[key] = value;
      return this;
    },
    send() {
      return this;
    },
  };
  const req = { path, ip, headers: authorization ? { authorization } : {} };
  middleware(req, res, () => {
    out.nextCalled = true;
  });
  return out;
}

test('sifre tanimli degilken her ortamda acik (herkese acik mod)', () => {
  assert.equal(run(createBasicAuth({ password: undefined })).nextCalled, true);
  assert.equal(run(createBasicAuth({ password: '' })).nextCalled, true);
});

test('dogru sifre gecer, kullanici adi onemsiz', () => {
  const mw = createBasicAuth({ password: 'gizli' });
  assert.equal(run(mw, { authorization: basic('herhangi', 'gizli') }).nextCalled, true);
});

test('yanlis veya eksik sifre 401 ve giris penceresi tetikler', () => {
  const mw = createBasicAuth({ password: 'gizli' });
  for (const authorization of [undefined, basic('x', 'yanlis'), 'Bearer abc', 'Basic %%%']) {
    const out = run(mw, { authorization });
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 401);
    assert.match(out.headers['WWW-Authenticate'], /^Basic /);
  }
});

test('sifresinde iki nokta ust uste olan parola calisir', () => {
  const mw = createBasicAuth({ password: 'a:b:c' });
  assert.equal(run(mw, { authorization: basic('x', 'a:b:c') }).nextCalled, true);
});

test('/health sifresiz acik', () => {
  const mw = createBasicAuth({ password: 'gizli' });
  assert.equal(run(mw, { path: '/health' }).nextCalled, true);
});

test('ayni IP den cok sayida yanlis deneme 429 alir, dogru sifre de gecici engellenir', () => {
  let now = 1_000_000;
  const mw = createBasicAuth({ password: 'gizli', maxFailures: 3, windowMs: 60_000, now: () => now });
  for (let i = 0; i < 3; i++) assert.equal(run(mw, { authorization: basic('x', 'yanlis') }).status, 401);
  assert.equal(run(mw, { authorization: basic('x', 'yanlis') }).status, 429);
  assert.equal(run(mw, { authorization: basic('x', 'gizli') }).status, 429);
  assert.equal(run(mw, { authorization: basic('x', 'yanlis'), ip: '9.9.9.9' }).status, 401);
  now += 61_000;
  assert.equal(run(mw, { authorization: basic('x', 'gizli') }).nextCalled, true);
});
