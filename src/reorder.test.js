import test from 'node:test';
import assert from 'node:assert/strict';
import { moveIndex } from './reorder.js';

test('moveIndex: bastan sona tasir', () => {
  assert.deepEqual(moveIndex(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
});

test('moveIndex: sondan basa tasir', () => {
  assert.deepEqual(moveIndex(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
});

test('moveIndex: ortaya tasir', () => {
  assert.deepEqual(moveIndex(['a', 'b', 'c', 'd'], 0, 1), ['b', 'a', 'c', 'd']);
});

test('moveIndex: girdiyi degistirmez ve yeni dizi dondurur', () => {
  const input = ['a', 'b', 'c'];
  const out = moveIndex(input, 0, 2);
  assert.deepEqual(input, ['a', 'b', 'c']);
  assert.notEqual(out, input);
});

test('moveIndex: ayni indeks ve aralik disi indeks diziyi oldugu gibi dondurur', () => {
  const input = ['a', 'b', 'c'];
  assert.equal(moveIndex(input, 1, 1), input);
  assert.equal(moveIndex(input, -1, 1), input);
  assert.equal(moveIndex(input, 0, 3), input);
  assert.equal(moveIndex(input, undefined, 1), input);
  assert.equal(moveIndex(input, 0.5, 1), input);
});
