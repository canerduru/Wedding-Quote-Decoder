import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison } from './table.js';
import { calculateBreakdown } from './calc.js';

const GUESTS = 100;
const risk = (category, calcType, amount, extra = {}) => ({ type: 'risk', active: true, category, calcType, amount, ...extra });
const safe = (category) => ({ type: 'safe', active: false, category, calcType: 'fixed', amount: 0 });
const venue = (id, base, fb, flags = []) => ({ id, name: id, region: { tr: 'x', en: 'x' }, baseFeeEur: base, fbPerPersonEur: fb, flags });
const categoryOf = (flag) => flag.category || 'other';
const build = (venues) => buildComparison({ venues, guestCount: GUESTS, categories: ['tax', 'music', 'other'], categoryOf });

test('kira, yemek ve toplamlar kart hesabiyla ayni', () => {
  const v = venue('A', 10000, 50, [risk('other', 'service_pct', 10), risk('tax', 'vat_pct', 20)]);
  const [col] = build([v]).columns;
  const b = calculateBreakdown(v, GUESTS);
  assert.equal(col.rentEur, 10000);
  assert.equal(col.foodEur, b.fbSubtotalEur);
  assert.equal(col.turnkeyEur, b.turnkeyTotalEur);
  assert.equal(col.perGuestEur, b.effectivePerGuestEur);
});

test('kategori hucreleri: tutar, dahil, hariç, belirtilmedi', () => {
  const a = venue('A', 1000, 0, [risk('tax', 'vat_pct', 20), risk('music', 'fixed', 500)]);
  const b = venue('B', 1000, 0, [safe('tax'), risk('music', 'fixed', 400, { active: false })]);
  const { columns } = build([a, b]);
  assert.deepEqual(columns[0].cells.tax, { kind: 'amount', amountEur: 300 });
  assert.deepEqual(columns[0].cells.music, { kind: 'amount', amountEur: 500 });
  assert.deepEqual(columns[1].cells.tax, { kind: 'included' });
  assert.deepEqual(columns[1].cells.music, { kind: 'excluded' });
  assert.deepEqual(columns[0].cells.other, { kind: 'missing' });
});

test('kira + yemek + kategori hucreleri = toplam', () => {
  const v = venue('A', 10000, 50, [
    risk('other', 'service_pct', 10),
    risk('tax', 'vat_pct', 20),
    risk('music', 'fixed', 1500),
    risk('music', 'vendor_vat_pct', 20, { vendorCategory: 'music', vendorBaseEur: 1500, vendorPerGuestEur: 0 }),
  ]);
  const [col] = build([v]).columns;
  const sum = Object.values(col.cells).reduce((acc, c) => acc + (c.kind === 'amount' ? c.amountEur : 0), 0);
  assert.ok(Math.abs(col.rentEur + col.foodEur + sum - col.turnkeyEur) < 1e-6);
});

test('en avantajli ve fark: bos kart sayilmaz', () => {
  const { columns } = build([venue('A', 5000, 0), venue('B', 0, 0), venue('C', 6000, 0)]);
  assert.deepEqual(columns.map((c) => c.best), [true, false, false]);
  assert.deepEqual(columns.map((c) => c.deltaEur), [0, 0, 1000]);
  assert.equal(columns[1].hasPrice, false);
});

test('kolon kimligi ve bos liste', () => {
  assert.deepEqual(build([venue('A', 1, 0)]).columns.map((c) => c.id), ['A']);
  assert.deepEqual(build([]).columns, []);
});

test('minimum harcama ve gecerlilik alanlari tabloya tasinir, toplam altindaysa uyarilir', () => {
  const a = { ...venue('A', 1000, 0), minimumSpendEur: 5000, depositNote: { tr: '%30', en: '30%' }, cancellationNote: { tr: '', en: '' }, validUntil: '2026-11-20' };
  const b = { ...venue('B', 9000, 0), minimumSpendEur: 5000 };
  const c = venue('C', 2000, 0);
  const { columns } = build([a, b, c]);
  assert.equal(columns[0].minimumSpendEur, 5000);
  assert.equal(columns[0].belowMinimum, true);
  assert.equal(columns[1].belowMinimum, false);
  assert.equal(columns[2].minimumSpendEur, 0);
  assert.equal(columns[2].belowMinimum, false);
  assert.equal(columns[0].depositNote.tr, '%30');
  assert.equal(columns[0].validUntil, '2026-11-20');
  assert.equal(columns[2].validUntil, '');
});
