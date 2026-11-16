import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSummary } from './cardsummary.js';

const risk = (calcType, amount) => ({ type: 'risk', active: true, calcType, amount });

test('cardSummary: toplam, kisi basi, dahil ve eksik sayisi', () => {
  const venue = {
    baseFeeEur: 10000,
    fbPerPersonEur: 100,
    flags: [{ type: 'safe' }, { type: 'safe' }, { type: 'info' }, risk('vat_pct', 20), risk('fixed', 0)],
  };
  const s = cardSummary(venue, 100);
  assert.equal(s.totalEur, 24000);
  assert.equal(s.perGuestEur, 240);
  assert.equal(s.included, 2);
  assert.equal(s.gaps, 1);
});

test('cardSummary: sadece safe dahil sayilir', () => {
  const venue = { baseFeeEur: 1, fbPerPersonEur: 1, flags: [{ type: 'info' }, risk('fixed', 5)] };
  assert.equal(cardSummary(venue, 10).included, 0);
});

test('cardSummary: bos mekan 0 toplam, kira ve yemek eksik', () => {
  const s = cardSummary({ baseFeeEur: 0, fbPerPersonEur: 0, flags: [] }, 100);
  assert.equal(s.totalEur, 0);
  assert.equal(s.included, 0);
  assert.equal(s.gaps, 2);
});

test('cardSummary: bayraksiz mekanda hata vermez', () => {
  const s = cardSummary({ baseFeeEur: 5000, fbPerPersonEur: 50 }, 100);
  assert.equal(s.totalEur, 10000);
  assert.equal(s.included, 0);
  assert.equal(s.gaps, 0);
});
