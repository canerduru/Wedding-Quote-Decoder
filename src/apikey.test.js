import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidKeyFormat, normalizeKey, classifyGeminiError } from './apikey.js';

test('farkli anahtar turleri kabul edilir (AIza, noktali AQ., altcizgili)', () => {
  for (const key of [
    'AIzaSyA1234567890abcdefghijklmnopqrstuv',
    'AQ.Ab8RN6Kexample_KEY-1234567890abcdefgh',
    'abc_DEF-ghi.jkl~mno+pqr/stu=1234567890',
  ]) {
    assert.equal(isValidKeyFormat(key), true, key);
  }
});

test('normalizeKey: bosluk, satir sonu ve cevreleyen tirnaklari temizler', () => {
  const raw = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
  assert.equal(normalizeKey(`  ${raw}\n`), raw);
  assert.equal(normalizeKey(`"${raw}"`), raw);
  assert.equal(normalizeKey(`'${raw}'`), raw);
  assert.equal(normalizeKey(`\u201c${raw}\u201d`), raw);
  assert.equal(normalizeKey(undefined), '');
  assert.equal(normalizeKey(null), '');
});

test('tirnakli yapistirilan anahtar normalize edilince gecerli sayilir', () => {
  assert.equal(isValidKeyFormat('"AIzaSyA1234567890abcdefghijklmnopqrstuv"'), true);
});

test('bicimi bozuk anahtar reddedilir', () => {
  for (const bad of [
    '',
    'kisa',
    'bosluk iceren anahtar 1234567890',
    'x'.repeat(300),
    'abc\r\ndef1234567890abcdefg',
    'turkce-karakter-\u00e7\u011f\u0131-1234567890',
    undefined,
    null,
    ['a', 'b'],
  ]) {
    assert.equal(isValidKeyFormat(bad), false);
  }
});

test('Gemini hata siniflandirmasi', () => {
  assert.equal(classifyGeminiError('API key not valid. Please pass a valid API key.'), 'key_invalid');
  assert.equal(classifyGeminiError('{"error":{"status":"API_KEY_INVALID"}}'), 'key_invalid');
  assert.equal(classifyGeminiError('403 PERMISSION_DENIED'), 'key_invalid');
  assert.equal(classifyGeminiError('404 NOT_FOUND models/x is not found for API version v1beta'), 'model_unavailable');
  assert.equal(classifyGeminiError('503 UNAVAILABLE high demand'), 'transient');
  assert.equal(classifyGeminiError('429 RESOURCE_EXHAUSTED'), 'transient');
  assert.equal(classifyGeminiError('something else'), 'other');
});
