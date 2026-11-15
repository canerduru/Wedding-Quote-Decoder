import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_KEY, resolveViewMode, loadViewMode, saveViewMode } from './viewmode.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
};

test('kayitli tercih yoksa varsayilan Tablo', () => {
  assert.equal(resolveViewMode(null), 'table');
  assert.equal(resolveViewMode(undefined), 'table');
  assert.equal(resolveViewMode(''), 'table');
  assert.equal(resolveViewMode('baska'), 'table');
});

test('gecerli kayitli tercih korunur', () => {
  assert.equal(resolveViewMode('cards'), 'cards');
  assert.equal(resolveViewMode('table'), 'table');
});

test('loadViewMode ve saveViewMode: gidis-donus', () => {
  const store = fakeStorage();
  assert.equal(loadViewMode(store), 'table');
  saveViewMode(store, 'cards');
  assert.equal(store.data[VIEW_KEY], 'cards');
  assert.equal(loadViewMode(store), 'cards');
});

test('bozuk deger ve calismayan depolama guvenli sekilde Tablo olur, hata firlatmaz', () => {
  assert.equal(loadViewMode(fakeStorage({ [VIEW_KEY]: 'x' })), 'table');
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(loadViewMode(broken), 'table');
  assert.doesNotThrow(() => saveViewMode(broken, 'cards'));
  assert.equal(loadViewMode(null), 'table');
});

test('saveViewMode gecersiz modu yazmaz', () => {
  const store = fakeStorage();
  saveViewMode(store, 'kotu');
  assert.deepEqual(store.data, {});
});
