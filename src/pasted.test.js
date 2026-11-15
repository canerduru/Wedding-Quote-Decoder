import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePastedText, makeTextDocument, MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from './pasted.js';

test('validatePastedText: bos ve cok kisa metin reddedilir', () => {
  assert.deepEqual(validatePastedText('   '), { ok: false, error: 'empty' });
  assert.deepEqual(validatePastedText(null), { ok: false, error: 'empty' });
  assert.deepEqual(validatePastedText('kisa'), { ok: false, error: 'short' });
  assert.equal(MIN_TEXT_LENGTH, 20);
});

test('validatePastedText: cok uzun metin reddedilir', () => {
  assert.deepEqual(validatePastedText('a'.repeat(MAX_TEXT_LENGTH + 1)), { ok: false, error: 'long' });
  assert.equal(validatePastedText('a'.repeat(MAX_TEXT_LENGTH)).ok, true);
});

test('validatePastedText: gecerli metin kirpilir, satir sonlari normallesir', () => {
  const out = validatePastedText('  Villa Flori\r\nKira: 3.000 EUR, KDV dahil.  \r\n');
  assert.equal(out.ok, true);
  assert.equal(out.text, 'Villa Flori\nKira: 3.000 EUR, KDV dahil.');
});

test('makeTextDocument: yukleme hattinin bekledigi sahte dosya', () => {
  const doc = makeTextDocument({ text: 'metin', nameHint: '  Villa  Flori "X" ', name: 'Yapıştırılan metin 1' });
  assert.equal(doc.isText, true);
  assert.equal(doc.text, 'metin');
  assert.equal(doc.name, 'Yapıştırılan metin 1');
  assert.equal(doc.nameHint, 'Villa Flori X');
  assert.equal(doc.size, 5);
  assert.equal(makeTextDocument({ text: 'metin', nameHint: undefined, name: 'a' }).nameHint, '');
});
