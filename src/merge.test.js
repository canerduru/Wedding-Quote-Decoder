import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, findSameVenue, mergeVenue, resolveConflict } from './merge.js';

const bi = (tr, en = tr) => ({ tr, en });
const venue = (over = {}) => ({
  id: 'v1',
  name: 'Villa Flori',
  sourceCurrency: 'EUR',
  baseFeeEur: 3000,
  fbPerPersonEur: 0,
  minimumSpendEur: 0,
  statedTotalEur: 0,
  depositNote: bi(''),
  cancellationNote: bi(''),
  durationNote: bi(''),
  datesNote: bi(''),
  guestsNote: bi(''),
  validUntil: '',
  uploadedPreviewUrl: '',
  extraPreviews: [],
  realPhotoUrl: '',
  sourceLabel: bi('Dosya: a.png'),
  flags: [],
  ...over,
});
const flag = (id, label, extra = {}) => ({ id, type: 'risk', active: true, calcType: 'fixed', amount: 100, label: bi(label), detail: bi(''), ...extra });

test('normalizeName: buyuk/kucuk harf, aksan ve noktalama', () => {
  assert.equal(normalizeName('  VILLA  Flori! '), 'villa flori');
  assert.equal(normalizeName('Çırağan Sarayı'), 'ciragan sarayi');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeName(undefined), '');
});

test('findSameVenue: ayni isim exact', () => {
  const v = venue();
  const r = findSameVenue([v, venue({ id: 'v2', name: 'Villa Cipressi' })], 'VILLA FLORI');
  assert.equal(r.kind, 'exact');
  assert.equal(r.venue, v);
});

test('findSameVenue: benzer isim similar, farkli mekan none', () => {
  const flori = venue();
  const cip = venue({ id: 'v2', name: 'Villa Cipressi' });
  assert.equal(findSameVenue([flori, cip], 'Villa Flori Suites').kind, 'similar');
  assert.equal(findSameVenue([flori, cip], 'Villa Flori Suites').venue, flori);
  assert.equal(findSameVenue([flori], 'Hotel Villa Flori').kind, 'similar');
  assert.equal(findSameVenue([flori, cip], 'Villa Balbiano').kind, 'none');
  assert.equal(findSameVenue([flori], 'Villa Cipressi').kind, 'none');
});

test('findSameVenue: isimsiz, cok kisa ya da bos liste none', () => {
  assert.equal(findSameVenue([venue()], '').kind, 'none');
  assert.equal(findSameVenue([venue()], 'ab').kind, 'none');
  assert.equal(findSameVenue([], 'Villa Flori').kind, 'none');
  assert.equal(findSameVenue([venue({ name: '' })], 'Villa Flori').kind, 'none');
});

test('mergeVenue: bos alanlar kaynaktan dolar, cakisma yok', () => {
  const target = venue({ baseFeeEur: 0 });
  const source = venue({ id: 's', baseFeeEur: 3000, fbPerPersonEur: 90, minimumSpendEur: 5000, statedTotalEur: 3500, depositNote: bi('%30'), durationNote: bi('1 saat'), datesNote: bi('Nisan'), guestsNote: bi('13 kisi'), validUntil: '2026-12-01', uploadedPreviewUrl: 'data:a' });
  const conflicts = mergeVenue(target, source);
  assert.deepEqual(conflicts, []);
  assert.equal(target.baseFeeEur, 3000);
  assert.equal(target.fbPerPersonEur, 90);
  assert.equal(target.minimumSpendEur, 5000);
  assert.equal(target.statedTotalEur, 3500);
  assert.equal(target.depositNote.tr, '%30');
  assert.equal(target.durationNote.tr, '1 saat');
  assert.equal(target.datesNote.tr, 'Nisan');
  assert.equal(target.guestsNote.tr, '13 kisi');
  assert.equal(target.validUntil, '2026-12-01');
  assert.equal(target.uploadedPreviewUrl, 'data:a');
});

test('mergeVenue: farkli dolu degerler cakisma olarak doner, hedef degeri korunur', () => {
  const target = venue({ baseFeeEur: 3000, depositNote: bi('%30') });
  const source = venue({ id: 's', baseFeeEur: 3200, depositNote: bi('%50') });
  const conflicts = mergeVenue(target, source);
  assert.equal(target.baseFeeEur, 3000);
  assert.equal(target.depositNote.tr, '%30');
  const byKey = Object.fromEntries(conflicts.map((c) => [c.key, c]));
  assert.equal(byKey.baseFeeEur.kind, 'money');
  assert.equal(byKey.baseFeeEur.current, 3000);
  assert.equal(byKey.baseFeeEur.incoming, 3200);
  assert.equal(byKey.depositNote.kind, 'text');
  assert.deepEqual(byKey.depositNote.incoming, bi('%50'));
});

test('mergeVenue: %1 icindeki fark ve esit degerler cakisma sayilmaz', () => {
  const target = venue({ baseFeeEur: 3000, statedTotalEur: 5500 });
  const source = venue({ id: 's', baseFeeEur: 3020, statedTotalEur: 5500 });
  assert.deepEqual(mergeVenue(target, source), []);
});

test('mergeVenue: kalemler adina gore tekrarsiz eklenir, onizlemeler korunur', () => {
  const target = venue({ uploadedPreviewUrl: 'data:1', flags: [flag('a', 'Temizlik')] });
  const source = venue({ id: 's', uploadedPreviewUrl: 'data:2', extraPreviews: ['data:3'], flags: [flag('a', 'TEMİZLİK'), flag('b', 'Tören Ücreti')] });
  mergeVenue(target, source);
  assert.deepEqual(target.flags.map((f) => f.label.tr), ['Temizlik', 'Tören Ücreti']);
  assert.notEqual(target.flags[1].id, 'b');
  assert.equal(target.uploadedPreviewUrl, 'data:1');
  assert.deepEqual(target.extraPreviews, ['data:2', 'data:3']);
  assert.equal(target.sourceLabel.tr, 'Dosya: a.png + Dosya: a.png');
});

test('mergeVenue: isim bos hedefe kaynaktan gelir', () => {
  const target = venue({ name: '' });
  mergeVenue(target, venue({ id: 's', name: 'Villa Flori' }));
  assert.equal(target.name, 'Villa Flori');
});

test('resolveConflict: yeni deger secilince hedefe yazilir', () => {
  const target = venue({ baseFeeEur: 3000, sourceCurrency: 'EUR' });
  const conflict = { key: 'baseFeeEur', kind: 'money', current: 3000, incoming: 3200, incomingCurrency: 'TRY' };
  resolveConflict(target, conflict, 'incoming');
  assert.equal(target.baseFeeEur, 3200);
  assert.equal(target.sourceCurrency, 'TRY');
  const textTarget = venue({ depositNote: bi('%30') });
  resolveConflict(textTarget, { key: 'depositNote', kind: 'text', current: bi('%30'), incoming: bi('%50') }, 'incoming');
  assert.equal(textTarget.depositNote.tr, '%50');
  const keep = venue({ baseFeeEur: 3000 });
  resolveConflict(keep, { key: 'baseFeeEur', kind: 'money', current: 3000, incoming: 3200 }, 'current');
  assert.equal(keep.baseFeeEur, 3000);
});
