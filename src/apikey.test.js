import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiKey, isKeyRequired, classifyGeminiError } from './apikey.js';

const USER_KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const SERVER_KEY = 'AIzaSyServerKey1234567890abcdefghijklmn';

test('kullanici anahtari her modda onceliklidir', () => {
  assert.equal(resolveApiKey({ headerKey: USER_KEY, serverKey: SERVER_KEY, privateMode: true }), USER_KEY);
  assert.equal(resolveApiKey({ headerKey: USER_KEY, serverKey: SERVER_KEY, privateMode: false }), USER_KEY);
});

test('acik modda sunucu anahtari asla kullanilmaz', () => {
  assert.equal(resolveApiKey({ headerKey: undefined, serverKey: SERVER_KEY, privateMode: false }), null);
});

test('ozel modda (sifreli) anahtar yoksa sunucu anahtarina duser', () => {
  assert.equal(resolveApiKey({ headerKey: '', serverKey: SERVER_KEY, privateMode: true }), SERVER_KEY);
  assert.equal(resolveApiKey({ headerKey: undefined, serverKey: undefined, privateMode: true }), null);
});

test('bicimi bozuk kullanici anahtari yok sayilir', () => {
  for (const bad of ['kisa', 'bosluk iceren anahtar 1234567890', 'x'.repeat(300), 'abc\r\ndef1234567890abcdefg', ['a', 'b']]) {
    assert.equal(resolveApiKey({ headerKey: bad, serverKey: undefined, privateMode: false }), null);
  }
});

test('anahtar kutusu sadece sunucu anahtari ile korunan ozel modda gizlenir', () => {
  assert.equal(isKeyRequired({ privateMode: true, serverKey: SERVER_KEY }), false);
  assert.equal(isKeyRequired({ privateMode: true, serverKey: '' }), true);
  assert.equal(isKeyRequired({ privateMode: false, serverKey: SERVER_KEY }), true);
});

test('Gemini hata siniflandirmasi', () => {
  assert.equal(classifyGeminiError('API key not valid. Please pass a valid API key.'), 'key_invalid');
  assert.equal(classifyGeminiError('{"error":{"status":"API_KEY_INVALID"}}'), 'key_invalid');
  assert.equal(classifyGeminiError('UNAUTHENTICATED'), 'key_invalid');
  assert.equal(classifyGeminiError('503 UNAVAILABLE high demand'), 'transient');
  assert.equal(classifyGeminiError('429 RESOURCE_EXHAUSTED'), 'transient');
  assert.equal(classifyGeminiError('something else'), 'other');
});
