import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBreakdown,
  getFlagAmountEur,
  getLowestTotalEur,
  getDeltaFromLowest,
  isBestValue,
} from './calc.js';

const GUESTS = 100;

const risk = (calcType, amount, extra = {}) => ({ type: 'risk', active: true, calcType, amount, ...extra });
const venue = (baseFeeEur, fbPerPersonEur, flags = []) => ({ baseFeeEur, fbPerPersonEur, flags });

test('baseline: kira + yemek + KDV', () => {
  const b = calculateBreakdown(venue(10000, 100, [risk('vat_pct', 20)]), GUESTS);
  assert.equal(b.turnkeyTotalEur, 24000);
  assert.equal(b.vatAmountEur, 4000);
});

test('H1: dis hizmet kalemleri mekan KDV matrahina girmez, kendi KDV si ayri hesaplanir', () => {
  const v = venue(10000, 0, [
    risk('vat_pct', 20),
    risk('fixed', 1000, { vendorCategory: 'floral' }),
    risk('vendor_vat_pct', 20, { vendorCategory: 'floral', vendorBaseEur: 1000, vendorPerGuestEur: 0 }),
  ]);
  const b = calculateBreakdown(v, GUESTS);
  assert.equal(b.vatAmountEur, 2000);
  assert.equal(b.turnkeyTotalEur, 10000 + 2000 + 1000 + 200);
});

test('H1: pasif mekan KDV si dis hizmete uygulanmaz', () => {
  const v = venue(10000, 0, [
    risk('vat_pct', 20, { active: false }),
    risk('fixed', 1000, { vendorCategory: 'floral' }),
  ]);
  assert.equal(calculateBreakdown(v, GUESTS).turnkeyTotalEur, 11000);
});

test('H2: servis bedeli KDV den once uygulanir, KDV servis dahil tutar uzerinden hesaplanir', () => {
  const v = venue(10000, 0, [risk('service_pct', 10), risk('vat_pct', 20)]);
  const b = calculateBreakdown(v, GUESTS);
  assert.equal(b.serviceAmountEur, 1000);
  assert.equal(b.vatAmountEur, 2200);
  assert.equal(b.turnkeyTotalEur, 13200);
});

test('H2: servis bedeli sabit mekan ekstralarini kapsar, dis hizmetleri kapsamaz', () => {
  const v = venue(10000, 0, [
    risk('fixed', 500),
    risk('fixed', 1000, { vendorCategory: 'boat' }),
    risk('service_pct', 10),
    risk('vat_pct', 20),
  ]);
  const b = calculateBreakdown(v, GUESTS);
  assert.equal(b.serviceAmountEur, 1050);
  assert.equal(b.vatAmountEur, 2310);
  assert.equal(b.turnkeyTotalEur, 10000 + 500 + 1050 + 2310 + 1000);
});

test('H2: kalem tutari gosterimi toplamla tutarli', () => {
  const v = venue(10000, 0, [risk('service_pct', 10), risk('vat_pct', 20)]);
  const [service, vat] = v.flags;
  assert.equal(getFlagAmountEur(v, service, GUESTS), 1000);
  assert.equal(getFlagAmountEur(v, vat, GUESTS), 2200);
});

test('pasif servis bedeli toplama girmez', () => {
  const v = venue(10000, 0, [risk('service_pct', 10, { active: false }), risk('vat_pct', 20)]);
  assert.equal(calculateBreakdown(v, GUESTS).turnkeyTotalEur, 12000);
});

test('H3: toplami 0 olan kart en avantajli sayilmaz ve en dusuk toplami bozmaz', () => {
  const real1 = venue(5000, 0);
  const empty = venue(0, 0);
  const real2 = venue(6000, 0);
  const all = [real1, empty, real2];
  assert.equal(getLowestTotalEur(all, GUESTS), 5000);
  assert.equal(isBestValue(real1, all, GUESTS), true);
  assert.equal(isBestValue(empty, all, GUESTS), false);
  assert.equal(isBestValue(real2, all, GUESTS), false);
  assert.equal(getDeltaFromLowest(empty, all, GUESTS), 0);
  assert.equal(getDeltaFromLowest(real2, all, GUESTS), 1000);
});

test('H3: fiyatli tek kart varsa kimse en avantajli degil', () => {
  const real = venue(5000, 0);
  const empty = venue(0, 0);
  assert.equal(isBestValue(real, [real, empty], GUESTS), false);
  assert.equal(getDeltaFromLowest(real, [real, empty], GUESTS), 0);
});

test('hic kart yokken en dusuk toplam 0', () => {
  assert.equal(getLowestTotalEur([], GUESTS), 0);
});
