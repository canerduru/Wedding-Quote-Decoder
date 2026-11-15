import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrix, LONG_TEXT } from './matrix.js';
import { buildComparison } from './table.js';

const bi = (tr, en = tr) => ({ tr, en });
const venue = (id, over = {}) => ({
  id,
  name: id,
  region: bi('Como'),
  baseFeeEur: 3000,
  fbPerPersonEur: 90,
  minimumSpendEur: 0,
  statedTotalEur: 0,
  depositNote: bi(''),
  cancellationNote: bi(''),
  durationNote: bi(''),
  datesNote: bi(''),
  guestsNote: bi(''),
  validUntil: '',
  flags: [],
  ...over,
});
const flag = (category, type, calcType, amount, active, label = 'x') => ({ id: label, category, type, calcType, amount, active, label: bi(label), detail: bi('') });
const T = (key) => key;
const money = (eur) => `€${Math.round(eur)}`;
const categoryOf = (f) => f.category || 'other';

function matrix(venues, over = {}) {
  const categories = over.categories || ['tax', 'music'];
  const { columns } = buildComparison({ venues, guestCount: 100, categories, categoryOf });
  return buildMatrix({ columns, categories, lang: 'tr', money, t: T, categoryTitle: (c) => `cat:${c}`, validityText: (d) => (d ? `V:${d}` : ''), venues, guestCount: 100 });
}
const row = (m, key) => m.groups.flatMap((g) => g.rows).find((r) => r.key === key);

test('gruplar ve satir sirasi', () => {
  const m = matrix([venue('a')]);
  assert.deepEqual(m.groups.map((g) => g.key), ['price', 'terms', 'extras']);
  assert.deepEqual(m.groups[0].rows.map((r) => r.key), ['delta', 'stated', 'rent', 'food']);
  assert.deepEqual(m.groups[1].rows.map((r) => r.key), ['datesNote', 'durationNote', 'guestsNote', 'minSpend', 'depositNote', 'cancellationNote', 'validUntil']);
  assert.deepEqual(m.groups[2].rows.map((r) => r.key), ['cat:tax', 'cat:music']);
});

test('ekstra kategori yoksa ek kalemler grubu olmaz', () => {
  const m = matrix([venue('a')], { categories: [] });
  assert.deepEqual(m.groups.map((g) => g.key), ['price', 'terms']);
});

test('her satirda sutun sayisi kadar hucre var', () => {
  const m = matrix([venue('a'), venue('b'), venue('c')]);
  for (const g of m.groups) for (const r of g.rows) assert.equal(r.cells.length, 3, r.key);
});

test('kira ve yemek: eksikse missing, doluysa tutar, en dusuk isaretlenir', () => {
  const m = matrix([venue('a', { baseFeeEur: 3000 }), venue('b', { baseFeeEur: 2000 }), venue('c', { baseFeeEur: 0, fbPerPersonEur: 0 })]);
  const rent = row(m, 'rent').cells;
  assert.deepEqual(rent.map((c) => c.kind), ['amount', 'amount', 'missing']);
  assert.deepEqual(rent.map((c) => Boolean(c.best)), [false, true, false]);
  assert.equal(rent[0].text, '€3000');
  const food = row(m, 'food').cells;
  assert.equal(food[2].kind, 'missing');
});

test('metin satirlari: dolu metin, bos olan missing, uzun olan long', () => {
  const long = 'u'.repeat(LONG_TEXT + 1);
  const m = matrix([venue('a', { datesNote: bi('29 Nisan'), durationNote: bi(long) }), venue('b')]);
  const dates = row(m, 'datesNote').cells;
  assert.deepEqual(dates.map((c) => c.kind), ['text', 'missing']);
  assert.equal(dates[0].text, '29 Nisan');
  assert.equal(dates[0].long, false);
  assert.equal(row(m, 'durationNote').cells[0].long, true);
});

test('minimum harcama: tutar ve toplam altindaysa uyari', () => {
  const m = matrix([venue('a', { baseFeeEur: 1000, fbPerPersonEur: 0, minimumSpendEur: 5000 }), venue('b')]);
  const cells = row(m, 'minSpend').cells;
  assert.equal(cells[0].kind, 'amount');
  assert.equal(cells[0].warn, true);
  assert.equal(cells[1].kind, 'missing');
});

test('gecerlilik ve teklifteki toplam', () => {
  const m = matrix([venue('a', { validUntil: '2026-12-01', statedTotalEur: 5500 }), venue('b')]);
  assert.equal(row(m, 'validUntil').cells[0].text, 'V:2026-12-01');
  assert.equal(row(m, 'validUntil').cells[1].kind, 'missing');
  assert.equal(row(m, 'stated').cells[0].text, '€5500');
  assert.equal(row(m, 'stated').cells[1].kind, 'dash');
});

test('fark satiri: en ucuzdan pahali olana artis, en ucuz ve bos kart dash', () => {
  const m = matrix([venue('a', { baseFeeEur: 3000 }), venue('b', { baseFeeEur: 2000 }), venue('c', { baseFeeEur: 0, fbPerPersonEur: 0 })]);
  const delta = row(m, 'delta').cells;
  assert.equal(delta[0].kind, 'amount');
  assert.equal(delta[0].text, '+€1000');
  assert.equal(delta[1].kind, 'dash');
  assert.equal(delta[2].kind, 'dash');
});

test('kategori hucreleri: tutar, dahil, haric, fiyat yok, missing', () => {
  const a = venue('a', { flags: [flag('tax', 'safe', 'fixed', 0, false, 'kdv'), flag('music', 'risk', 'fixed', 500, true, 'dj')] });
  const b = venue('b', { flags: [flag('music', 'risk', 'fixed', 0, false, 'muzik')] });
  const c = venue('c', { flags: [flag('music', 'risk', 'fixed', 400, false, 'dj2')] });
  const m = matrix([a, b, c]);
  assert.deepEqual(row(m, 'cat:tax').cells.map((x) => x.kind), ['included', 'missing', 'missing']);
  assert.deepEqual(row(m, 'cat:music').cells.map((x) => x.kind), ['amount', 'needs_price', 'excluded']);
  assert.equal(row(m, 'cat:music').cells[0].text, '+€500');
});

test('sutun basligi: eksik sayisi ve nedenleri', () => {
  const a = venue('a', { baseFeeEur: 0, fbPerPersonEur: 0, flags: [flag('music', 'risk', 'fixed', 0, false, 'm')] });
  const b = venue('b');
  const m = matrix([a, b]);
  assert.equal(m.columns[0].gapCount, 3);
  assert.equal(m.columns[0].gapReasons.length, 3);
  assert.equal(m.columns[1].gapCount, 0);
  assert.equal(m.columns[0].id, 'a');
});
