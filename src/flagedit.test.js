import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, displayAmount, applyAmount, flagUnit } from './flagedit.js';
import { calculateBreakdown } from './calc.js';

const RATE = 55.6667;
const flag = (calcType, amount, extra = {}) => ({ id: 'f', type: 'risk', active: true, calcType, amount, ...extra });
const venue = (flags, base = 1000) => ({ baseFeeEur: base, fbPerPersonEur: 0, flags });

test('parseAmount: nokta, virgul ve binlik ayiraclar', () => {
  assert.equal(parseAmount('400'), 400);
  assert.equal(parseAmount(' 1250.5 '), 1250.5);
  assert.equal(parseAmount('1250,5'), 1250.5);
  assert.equal(parseAmount('1.250,5'), 1250.5);
  assert.equal(parseAmount('1,250.5'), 1250.5);
  assert.equal(parseAmount('0'), 0);
  for (const bad of ['', '  ', 'abc', '-5', '1e999', null, undefined]) assert.equal(parseAmount(bad), null, String(bad));
});

test('displayAmount: EUR aynen, TRY kurla carpilir, yuzde degismez', () => {
  assert.equal(displayAmount(flag('fixed', 400), 'EUR', RATE), 400);
  assert.equal(displayAmount(flag('fixed', 1000), 'TRY', RATE), 55666.7);
  assert.equal(displayAmount(flag('per_guest', 10), 'TRY', RATE), 556.67);
  assert.equal(displayAmount(flag('vat_pct', 22), 'TRY', RATE), 22);
  assert.equal(displayAmount(flag('service_pct', 10), 'EUR', RATE), 10);
});

test('applyAmount: EUR gorunumunde tutar ve kaynak para birimi yazilir', () => {
  const f = flag('fixed', 400);
  assert.equal(applyAmount(venue([f]), f, '300', 'EUR', RATE), true);
  assert.equal(f.amount, 300);
  assert.equal(f.sourceCurrency, 'EUR');
});

test('applyAmount: TRY gorunumunde girilen TL euroya cevrilir ve TRY olarak etiketlenir', () => {
  const f = flag('fixed', 400);
  assert.equal(applyAmount(venue([f]), f, '55666,7', 'TRY', RATE), true);
  assert.ok(Math.abs(f.amount - 1000) < 1e-6);
  assert.equal(f.sourceCurrency, 'TRY');
});

test('applyAmount: yuzde kalemlerinde para birimi cevrilmez', () => {
  const f = flag('vat_pct', 20);
  assert.equal(applyAmount(venue([f]), f, '22', 'TRY', RATE), true);
  assert.equal(f.amount, 22);
  assert.equal(f.sourceCurrency, undefined);
  assert.equal(applyAmount(venue([f]), f, '150', 'EUR', RATE), false);
  assert.equal(f.amount, 22);
});

test('applyAmount: gecersiz girdi reddedilir ve kalem degismez', () => {
  const f = flag('fixed', 400);
  for (const bad of ['', 'abc', '-1', null]) {
    assert.equal(applyAmount(venue([f]), f, bad, 'EUR', RATE), false);
  }
  assert.equal(f.amount, 400);
});

test('toplam duzenlenen tutarla guncellenir', () => {
  const f = flag('fixed', 400);
  const v = venue([f]);
  assert.equal(calculateBreakdown(v, 100).turnkeyTotalEur, 1400);
  applyAmount(v, f, '300', 'EUR', RATE);
  assert.equal(calculateBreakdown(v, 100).turnkeyTotalEur, 1300);
});

test('dis hizmet tutari degisince ayni dosyanin KDV matrahi yeniden hesaplanir', () => {
  const service = flag('fixed', 1000, { vendorCategory: 'floral', vendorSourceFile: 'cicek.pdf' });
  const perGuest = flag('per_guest', 5, { vendorCategory: 'floral', vendorSourceFile: 'cicek.pdf' });
  const vat = flag('vendor_vat_pct', 20, { vendorCategory: 'floral', vendorSourceFile: 'cicek.pdf', vendorBaseEur: 1000, vendorPerGuestEur: 5 });
  const other = flag('vendor_vat_pct', 20, { vendorCategory: 'music', vendorSourceFile: 'dj.pdf', vendorBaseEur: 700, vendorPerGuestEur: 0 });
  const v = venue([service, perGuest, vat, other]);
  applyAmount(v, service, '1500', 'EUR', RATE);
  assert.equal(vat.vendorBaseEur, 1500);
  assert.equal(vat.vendorPerGuestEur, 5);
  assert.equal(other.vendorBaseEur, 700);
  applyAmount(v, perGuest, '8', 'EUR', RATE);
  assert.equal(vat.vendorPerGuestEur, 8);
});

test('flagUnit: birim etiketleri', () => {
  assert.equal(flagUnit(flag('fixed', 1), 'EUR'), '€');
  assert.equal(flagUnit(flag('fixed', 1), 'TRY'), '₺');
  assert.equal(flagUnit(flag('per_guest', 1), 'EUR'), '€ / kişi');
  assert.equal(flagUnit(flag('vat_pct', 1), 'EUR'), '%');
  assert.equal(flagUnit(flag('service_pct', 1), 'TRY'), '%');
  assert.equal(flagUnit(flag('vendor_vat_pct', 1), 'TRY'), '%');
});
