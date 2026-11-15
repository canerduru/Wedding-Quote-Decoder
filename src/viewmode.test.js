import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_KEY,
  DENSITY_KEY,
  resolveViewMode,
  loadViewMode,
  saveViewMode,
  resolveDensity,
  loadDensity,
  saveDensity,
  densityZoom,
  gridStyle,
} from './viewmode.js';

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

test('kart boyutu: varsayilan buyuk, gecerli degerler korunur', () => {
  assert.equal(resolveDensity(null), 'large');
  assert.equal(resolveDensity('x'), 'large');
  assert.equal(resolveDensity('constructor'), 'large');
  assert.equal(resolveDensity('toString'), 'large');
  for (const d of ['large', 'medium', 'small']) assert.equal(resolveDensity(d), d);
});

test('kart boyutu: yakinlastirma oranlari', () => {
  assert.equal(densityZoom('large'), 1);
  assert.equal(densityZoom('medium'), 0.85);
  assert.equal(densityZoom('small'), 0.7);
  assert.equal(densityZoom('bilinmeyen'), 1);
});

test('kart boyutu: gidis-donus ve bozuk depolama', () => {
  const store = fakeStorage();
  assert.equal(loadDensity(store), 'large');
  saveDensity(store, 'small');
  assert.equal(store.data[DENSITY_KEY], 'small');
  assert.equal(loadDensity(store), 'small');
  saveDensity(store, 'kotu');
  assert.equal(store.data[DENSITY_KEY], 'small');
  const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.equal(loadDensity(broken), 'large');
  assert.doesNotThrow(() => saveDensity(broken, 'medium'));
  assert.equal(loadDensity(null), 'large');
});

test('gridStyle: tek mekanda sutun kurali yok, iki ve fazlada uyarlanabilir sutunlar ve zoom', () => {
  assert.deepEqual(gridStyle(1, 'small'), { zoom: 0.7 });
  const two = gridStyle(2, 'medium');
  assert.equal(two.zoom, 0.85);
  assert.match(two.gridTemplateColumns, /^repeat\(auto-fit, minmax\(min\(100%, \d+px\), 1fr\)\)$/);
  assert.equal(gridStyle(3, 'large').zoom, 1);
});

test('gridStyle: kucuk boyutta minimum kart genisligi daha dar', () => {
  const min = (d) => Number(gridStyle(3, d).gridTemplateColumns.match(/(\d+)px/)[1]);
  assert.ok(min('small') < min('medium') && min('medium') < min('large'));
  assert.equal(min('bilinmeyen'), min('large'));
});
