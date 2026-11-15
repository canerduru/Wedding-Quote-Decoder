import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RATES, toEur, convertDecoded, rescaleSource } from './rates.js';

const near = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);

test('varsayilan kurlar 13 Kasim 2026 ECB referans kurlaridir', () => {
  assert.equal(DEFAULT_RATES.date, '2026-11-13');
  assert.equal(DEFAULT_RATES.source, 'ECB');
  assert.equal(DEFAULT_RATES.TRY, 55.6667);
  assert.equal(DEFAULT_RATES.USD, 1.1052);
  assert.equal(DEFAULT_RATES.GBP, 0.83559);
});

test('toEur: EUR aynen, digerleri kura bolunur', () => {
  assert.equal(toEur(1000, 'EUR', DEFAULT_RATES), 1000);
  near(toEur(556667, 'TRY', DEFAULT_RATES), 10000, 0.01);
  near(toEur(11052, 'USD', DEFAULT_RATES), 10000, 0.01);
  near(toEur(8355.9, 'GBP', DEFAULT_RATES), 10000, 0.01);
});

test('convertDecoded: sabit ve kisi basi tutarlar cevrilir, yuzdeler dokunulmaz, kalemler etiketlenir', () => {
  const raw = {
    currency: 'TRY',
    baseFee: 556667,
    fbPerPerson: 5566.67,
    flags: [
      { calcType: 'fixed', amount: 55666.7, type: 'risk' },
      { calcType: 'per_guest', amount: 556.667, type: 'risk' },
      { calcType: 'vat_pct', amount: 20, type: 'risk' },
      { calcType: 'service_pct', amount: 10, type: 'risk' },
    ],
  };
  const out = convertDecoded(raw, DEFAULT_RATES);
  near(out.baseFeeEur, 10000, 0.01);
  near(out.fbPerPersonEur, 100, 0.001);
  near(out.flags[0].amount, 1000, 0.001);
  near(out.flags[1].amount, 10, 0.0001);
  assert.equal(out.flags[2].amount, 20);
  assert.equal(out.flags[3].amount, 10);
  assert.equal(out.sourceCurrency, 'TRY');
  assert.ok(out.flags.every((f) => f.sourceCurrency === 'TRY'));
  assert.equal(out.currencyUnknown, false);
});

test('convertDecoded: tanimsiz para birimi EUR sayilir ve isaretlenir', () => {
  for (const currency of ['OTHER', undefined, 'CHF']) {
    const out = convertDecoded({ currency, baseFee: 500, fbPerPerson: 10, flags: [] }, DEFAULT_RATES);
    assert.equal(out.baseFeeEur, 500);
    assert.equal(out.currencyUnknown, true);
    assert.equal(out.sourceCurrency, 'EUR');
  }
});

test('rescaleSource: TL rakamlari sabit kalir, EUR karsiligi yeni kura gore degisir', () => {
  const venue = {
    sourceCurrency: 'TRY',
    baseFeeEur: 10000,
    fbPerPersonEur: 100,
    flags: [
      { calcType: 'fixed', amount: 1000, sourceCurrency: 'TRY' },
      { calcType: 'fixed', amount: 500, sourceCurrency: 'EUR' },
      { calcType: 'vat_pct', amount: 20, sourceCurrency: 'TRY' },
      { calcType: 'vendor_vat_pct', amount: 20, vendorBaseEur: 2000, vendorPerGuestEur: 10, sourceCurrency: 'TRY' },
      { calcType: 'fixed', amount: 300 },
    ],
  };
  rescaleSource(venue, 'TRY', 55.6667, 60);
  near(venue.baseFeeEur * 60, 10000 * 55.6667, 0.01);
  near(venue.fbPerPersonEur * 60, 100 * 55.6667, 0.001);
  near(venue.flags[0].amount * 60, 1000 * 55.6667, 0.001);
  assert.equal(venue.flags[1].amount, 500);
  assert.equal(venue.flags[2].amount, 20);
  near(venue.flags[3].vendorBaseEur * 60, 2000 * 55.6667, 0.001);
  near(venue.flags[3].vendorPerGuestEur * 60, 10 * 55.6667, 0.0001);
  assert.equal(venue.flags[3].amount, 20);
  assert.equal(venue.flags[4].amount, 300);
});

test('rescaleSource: EUR kaynakli kart degismez, gecersiz kur yok sayilir', () => {
  const eurVenue = { sourceCurrency: 'EUR', baseFeeEur: 10000, fbPerPersonEur: 100, flags: [] };
  rescaleSource(eurVenue, 'TRY', 55.6667, 60);
  assert.equal(eurVenue.baseFeeEur, 10000);
  const tl = { sourceCurrency: 'TRY', baseFeeEur: 10000, fbPerPersonEur: 100, flags: [] };
  for (const bad of [0, -5, NaN, Infinity]) rescaleSource(tl, 'TRY', 55.6667, bad);
  assert.equal(tl.baseFeeEur, 10000);
});
