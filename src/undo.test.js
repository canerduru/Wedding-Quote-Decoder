import test from 'node:test';
import assert from 'node:assert/strict';
import { removeWithUndo, restoreRemoved } from './undo.js';

const items = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('removeWithUndo: ogeyi cikarir, sirasini ve kendisini saklar', () => {
  const original = items();
  const out = removeWithUndo(original, 'b');
  assert.deepEqual(out.list.map((x) => x.id), ['a', 'c']);
  assert.equal(out.undo.index, 1);
  assert.equal(out.undo.item, original[1]);
  assert.equal(original.length, 3);
});

test('removeWithUndo: bulunamayan kimlikte null', () => {
  assert.equal(removeWithUndo(items(), 'x'), null);
});

test('restoreRemoved: ogeyi eski sirasina geri koyar', () => {
  const { list, undo } = removeWithUndo(items(), 'b');
  assert.deepEqual(restoreRemoved(list, undo).map((x) => x.id), ['a', 'b', 'c']);
});

test('restoreRemoved: liste kisaldiysa sona ekler, ayni oge iki kez eklenmez', () => {
  const { undo } = removeWithUndo(items(), 'c');
  assert.deepEqual(restoreRemoved([{ id: 'a' }], undo).map((x) => x.id), ['a', 'c']);
  assert.deepEqual(restoreRemoved([{ id: 'a' }, { id: 'c' }], undo).map((x) => x.id), ['a', 'c']);
  assert.deepEqual(restoreRemoved([], undo).map((x) => x.id), ['c']);
});
