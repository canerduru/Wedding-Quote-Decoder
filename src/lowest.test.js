import test from 'node:test';
import assert from 'node:assert/strict';
import { lowestStanding } from './lowest.js';

const GUESTS = 100;
const venue = (id, base, fb, flags = []) => ({ id, baseFeeEur: base, fbPerPersonEur: fb, flags });
const needsPriceFlag = { type: 'risk', active: true, calcType: 'fixed', amount: 0 };

const complete = (id, total) => venue(id, total - 5000, 50);
const incomplete = (id, total) => venue(id, total, 0);

const standing = (venues) => lowestStanding(venues, GUESTS);
const bests = (venues) => standing(venues).map((s) => s.best);
const deltas = (venues) => standing(venues).map((s) => s.deltaEur);

test('eksikli ucuz rakip rozeti engeller', () => {
  const vs = [complete('A', 5500), incomplete('B', 2000)];
  assert.deepEqual(bests(vs), [false, false]);
  assert.deepEqual(deltas(vs), [0, 0]);
});

test('eksikli rakibin alt siniri daha yuksekse eksiksiz mekan en dusuk olur', () => {
  const vs = [complete('A', 5500), incomplete('B', 6000)];
  assert.deepEqual(bests(vs), [true, false]);
});

test('iki eksiksiz mekan: en dusuk rozet alir, digeri fark gorur', () => {
  const vs = [complete('A', 5500), complete('B', 6500)];
  assert.deepEqual(bests(vs), [true, false]);
  assert.deepEqual(deltas(vs), [0, 1000]);
});

test('hepsi eksikliyse rozet ve fark yok', () => {
  const vs = [incomplete('A', 2000), incomplete('B', 3000)];
  assert.deepEqual(bests(vs), [false, false]);
  assert.deepEqual(deltas(vs), [0, 0]);
});

test('tek fiyatli mekan varsa rozet yok', () => {
  const vs = [complete('A', 5500), venue('B', 0, 0)];
  assert.deepEqual(bests(vs), [false, false]);
});

test('esitlik: iki eksiksiz mekan da en dusuk', () => {
  const vs = [complete('A', 5500), complete('B', 5500)];
  assert.deepEqual(bests(vs), [true, true]);
  assert.deepEqual(deltas(vs), [0, 0]);
});

test('toplami 0 olan mekan rozet almaz ve digerlerini etkilemez', () => {
  const vs = [complete('A', 5500), venue('B', 0, 0), complete('C', 6500)];
  assert.deepEqual(bests(vs), [true, false, false]);
  assert.deepEqual(deltas(vs), [0, 0, 1000]);
  assert.equal(standing(vs)[1].total, 0);
});

test('fark tabani eksiksiz mekanlar arasindaki en dusuk toplamdir', () => {
  const vs = [incomplete('A', 1000), complete('B', 5500), complete('C', 6000)];
  assert.deepEqual(deltas(vs), [0, 0, 500]);
});

test('eksik sayilan haller: kira, yemek ve fiyati bekleyen kalem', () => {
  const noRent = venue('R', 0, 50);
  const noFood = venue('F', 1000, 0);
  const pending = venue('P', 1000, 50, [needsPriceFlag]);
  const ok = venue('OK', 1000, 50);
  assert.deepEqual(standing([noRent, noFood, pending, ok]).map((s) => s.complete), [false, false, false, true]);
});

test('girdi sirasi korunur, bos dizi ve tek mekan hata vermez', () => {
  const vs = [complete('B', 6500), complete('A', 5500)];
  assert.deepEqual(standing(vs).map((s) => s.id), ['B', 'A']);
  assert.deepEqual(standing([]), []);
  assert.deepEqual(bests([complete('A', 5500)]), [false]);
});
