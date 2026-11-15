import test from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_MIN, GUEST_MAX, GUEST_STEP, clampGuests, sliderPercent } from './guests.js';
import { serializeState, parseState } from './persist.js';

test('davetli araligi 10-1000, adim 5', () => {
  assert.equal(GUEST_MIN, 10);
  assert.equal(GUEST_MAX, 1000);
  assert.equal(GUEST_STEP, 5);
});

test('clampGuests: aralik disini sinirlar, sayiya cevirir, gecersizde null doner', () => {
  assert.equal(clampGuests(3), 10);
  assert.equal(clampGuests(5000), 1000);
  assert.equal(clampGuests('250'), 250);
  assert.equal(clampGuests(249.6), 250);
  assert.equal(clampGuests(''), null);
  assert.equal(clampGuests('abc'), null);
  assert.equal(clampGuests(NaN), null);
});

test('sliderPercent: uclarda 0 ve 100, ortada oransal, aralik disinda sinirlanir', () => {
  assert.equal(sliderPercent(GUEST_MIN), 0);
  assert.equal(sliderPercent(GUEST_MAX), 100);
  assert.ok(Math.abs(sliderPercent(505) - 50) < 1e-9);
  assert.equal(sliderPercent(1), 0);
  assert.equal(sliderPercent(5000), 100);
});

test('kayitli davetli sayisi araliga sikistirilir', () => {
  const base = { lang: 'tr', currency: 'EUR', exchangeRate: 55.6667, venues: [] };
  assert.equal(parseState(serializeState({ ...base, guestCount: 5000 })).guestCount, 1000);
  assert.equal(parseState(serializeState({ ...base, guestCount: 3 })).guestCount, 10);
  assert.equal(parseState(serializeState({ ...base, guestCount: 400 })).guestCount, 400);
});
