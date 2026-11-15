import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidKeyFormat, classifyGeminiError } from './apikey.js';

test('gecerli bicimli anahtar kabul edilir, bosluklar kirpilir', () => {
  assert.equal(isValidKeyFormat('AIzaSyA1234567890abcdefghijklmnopqrstuv'), true);
  assert.equal(isValidKeyFormat('  AIzaSyA1234567890abcdefghijklmnopqrstuv  '), true);
});

test('bicimi bozuk anahtar reddedilir', () => {
  for (const bad of ['', 'kisa', 'bosluk iceren anahtar 1234567890', 'x'.repeat(300), 'abc\r\ndef1234567890abcdefg', undefined, null, ['a', 'b']]) {
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
