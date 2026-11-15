import test from 'node:test';
import assert from 'node:assert/strict';
import { needsPrice, completeness } from './completeness.js';

const risk = (calcType, amount, extra = {}) => ({ type: 'risk', active: false, calcType, amount, ...extra });

test('needsPrice: fiyatsiz sabit veya kisi basi risk kalemi', () => {
  assert.equal(needsPrice(risk('fixed', 0)), true);
  assert.equal(needsPrice(risk('per_guest', 0)), true);
  assert.equal(needsPrice(risk('fixed', 500)), false);
  assert.equal(needsPrice(risk('vat_pct', 0)), false);
  assert.equal(needsPrice({ type: 'safe', calcType: 'fixed', amount: 0 }), false);
  assert.equal(needsPrice({ type: 'info', calcType: 'fixed', amount: 0 }), false);
  assert.equal(needsPrice(risk('fixed', '')), true);
});

test('completeness: kira ve yemek eksik, fiyatsiz kalemler sayilir', () => {
  const v = { baseFeeEur: 0, fbPerPersonEur: 0, flags: [risk('fixed', 0), risk('fixed', 0), risk('fixed', 300), { type: 'info', amount: 0 }] };
  assert.deepEqual(completeness(v), { rentMissing: true, foodMissing: true, needsPriceCount: 2 });
});

test('completeness: tam teklifte eksik yok', () => {
  const v = { baseFeeEur: 3000, fbPerPersonEur: 90, flags: [risk('fixed', 300, { active: true })] };
  assert.deepEqual(completeness(v), { rentMissing: false, foodMissing: false, needsPriceCount: 0 });
});

test('completeness: dis catering teklifi eklenmisse yemek eksik sayilmaz', () => {
  const v = { baseFeeEur: 3000, fbPerPersonEur: 0, flags: [risk('per_guest', 80, { active: true, vendorCategory: 'catering', category: 'catering' })] };
  assert.equal(completeness(v).foodMissing, false);
  const pasif = { ...v, flags: [risk('per_guest', 80, { active: false, vendorCategory: 'catering' })] };
  assert.equal(completeness(pasif).foodMissing, true);
});
