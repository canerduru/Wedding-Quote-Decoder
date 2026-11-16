import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBreakdown, getFlagAmountEur } from './calc.js';

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
