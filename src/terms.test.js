import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyTerms, termsFromDecoded, validityStatus } from './terms.js';

const day = (iso) => new Date(`${iso}T12:00:00`);

test('emptyTerms: bos varsayilanlar', () => {
  assert.deepEqual(emptyTerms(), {
    minimumSpendEur: 0,
    depositNote: { tr: '', en: '' },
    cancellationNote: { tr: '', en: '' },
    validUntil: '',
  });
  assert.notEqual(emptyTerms().depositNote, emptyTerms().depositNote);
});

test('termsFromDecoded: gecerli alanlari alir', () => {
  const t = termsFromDecoded({
    minimumSpendEur: 7200.5,
    depositNote: { tr: '%30 kapora', en: '30% deposit' },
    cancellationNote: { tr: '60 gun once ucretsiz', en: 'free until 60 days' },
    validUntil: '2026-11-20',
  });
  assert.equal(t.minimumSpendEur, 7200.5);
  assert.equal(t.depositNote.tr, '%30 kapora');
  assert.equal(t.cancellationNote.en, 'free until 60 days');
  assert.equal(t.validUntil, '2026-11-20');
});

test('termsFromDecoded: bozuk veya eksik veri guvenli bos degere doner', () => {
  const t = termsFromDecoded({ minimumSpendEur: -5, depositNote: 'duz metin', validUntil: '2026-02-30' });
  assert.equal(t.minimumSpendEur, 0);
  assert.deepEqual(t.depositNote, { tr: '', en: '' });
  assert.deepEqual(t.cancellationNote, { tr: '', en: '' });
  assert.equal(t.validUntil, '');
  assert.equal(termsFromDecoded({ validUntil: '20 Kasim' }).validUntil, '');
  assert.deepEqual(termsFromDecoded({}), emptyTerms());
});

test('validityStatus: kalan gun, son gun, dolmus, belirtilmemis', () => {
  const today = day('2026-11-15');
  assert.deepEqual(validityStatus('2026-11-20', today), { state: 'valid', days: 5 });
  assert.deepEqual(validityStatus('2026-11-15', today), { state: 'valid', days: 0 });
  assert.deepEqual(validityStatus('2026-11-14', today), { state: 'expired', days: -1 });
  assert.deepEqual(validityStatus('', today), { state: 'none', days: null });
  assert.deepEqual(validityStatus('gecersiz', today), { state: 'none', days: null });
});
