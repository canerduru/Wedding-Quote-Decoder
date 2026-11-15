import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeState, parseState } from './persist.js';

const bi = (tr, en = tr) => ({ tr, en });

const venue = (over = {}) => ({
  id: 'uploaded-1',
  name: 'Villa A',
  nameUnknown: false,
  editing: true,
  showAddFlag: true,
  showUploadedPreview: true,
  uploadedPreviewUrl: 'data:image/png;base64,AAAA',
  realPhotoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Villa.jpg',
  realPhotoSourceUrl: 'https://example.org/a',
  realPhotoSourceLabel: 'example.org',
  realPhotoError: false,
  photoStatus: 'found',
  photoQueryKey: 'villa a::bodrum',
  coverMode: 'auto',
  coverKey: 'lakeVilla',
  coverError: false,
  newFlag: { label: '', calcType: 'fixed', amount: '', category: '' },
  region: bi('Bodrum'),
  venueType: bi('Otel'),
  capacityLabel: bi('250 kisi'),
  sourceLabel: bi('Dosya: a.png'),
  baseFeeEur: 10000,
  fbPerPersonEur: 95,
  flags: [
    {
      id: 'f1',
      category: 'tax',
      type: 'risk',
      label: bi('KDV +%20'),
      detail: bi('Hariç'),
      calcType: 'vat_pct',
      amount: 20,
      active: true,
    },
  ],
  ...over,
});

const state = (over = {}) => ({ lang: 'tr', guestCount: 150, currency: 'TRY', exchangeRate: 40, venues: [venue()], ...over });

test('gidis-donus: kartlar, misafir sayisi, para birimi korunur', () => {
  const out = parseState(serializeState(state()));
  assert.equal(out.venues[0].realPhotoUrl, 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Villa.jpg');
  assert.equal(out.guestCount, 150);
  assert.equal(out.currency, 'TRY');
  assert.equal(out.exchangeRate, 40);
  assert.equal(out.venues.length, 1);
  assert.equal(out.venues[0].name, 'Villa A');
  assert.equal(out.venues[0].baseFeeEur, 10000);
  assert.equal(out.venues[0].flags[0].calcType, 'vat_pct');
});

test('teklif gorseli (base64) kaydedilmez', () => {
  const json = serializeState(state());
  assert.ok(!json.includes('base64'));
  assert.equal(parseState(json).venues[0].uploadedPreviewUrl, '');
});

test('gecici arayuz durumu sifirlanir', () => {
  const v = parseState(serializeState(state({ venues: [venue({ photoStatus: 'searching' })] }))).venues[0];
  assert.equal(v.showAddFlag, false);
  assert.equal(v.showUploadedPreview, false);
  assert.equal(v.photoStatus, 'idle');
});

test('bozuk JSON ve yanlis surum null doner', () => {
  assert.equal(parseState('{bozuk'), null);
  assert.equal(parseState(null), null);
  assert.equal(parseState(JSON.stringify({ version: 99, venues: [] })), null);
  assert.equal(parseState(JSON.stringify({ version: 1, venues: 'x' })), null);
});

test('gecersiz alanlar guvenli varsayilanlara doner', () => {
  const raw = JSON.parse(serializeState(state()));
  raw.currency = 'XXX';
  raw.lang = 'fr';
  raw.guestCount = 'abc';
  raw.exchangeRate = -3;
  const out = parseState(JSON.stringify(raw));
  assert.equal(out.currency, 'EUR');
  assert.equal(out.lang, 'tr');
  assert.equal(out.guestCount, 120);
  assert.equal(out.exchangeRate, 55.6667);
});

test('dis kaynakli foto adresi ve bilinmeyen hesap tipi temizlenir', () => {
  const raw = JSON.parse(serializeState(state()));
  raw.venues[0].realPhotoUrl = 'https://evil.example/x.jpg';
  raw.venues[0].flags[0].calcType = 'eval';
  raw.venues[0].flags[0].amount = 'yuz';
  raw.venues[0].coverKey = 'nope';
  const v = parseState(JSON.stringify(raw)).venues[0];
  assert.equal(v.realPhotoUrl, '');
  raw.venues[0].realPhotoUrl = '/api/venue-photo?url=https%3A%2F%2Fexample.org%2Fa.jpg';
  assert.equal(parseState(JSON.stringify(raw)).venues[0].realPhotoUrl, '');
  assert.equal(v.flags[0].calcType, 'fixed');
  assert.equal(v.flags[0].amount, 0);
  assert.equal(v.coverKey, 'lakeVilla');
});

test('thumb.wikimedia.org foto adresi korunur', () => {
  const raw = JSON.parse(serializeState(state()));
  raw.venues[0].realPhotoUrl = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/x.jpg/1200px-x.jpg';
  assert.equal(parseState(JSON.stringify(raw)).venues[0].realPhotoUrl, raw.venues[0].realPhotoUrl);
});

test('kimligi olmayan kart atlanir, eksik alanlar tamamlanir', () => {
  const raw = { version: 1, venues: [{ name: 'idsiz' }, { id: 'x1' }] };
  const out = parseState(JSON.stringify(raw));
  assert.equal(out.venues.length, 1);
  assert.equal(out.venues[0].id, 'x1');
  assert.deepEqual(out.venues[0].flags, []);
  assert.equal(out.venues[0].region.tr, '');
  assert.equal(out.venues[0].newFlag.calcType, 'fixed');
});

test('kaynak para birimi kart ve kalemde korunur, gecersizi temizlenir', () => {
  const st = state();
  st.venues[0].sourceCurrency = 'TRY';
  st.venues[0].flags[0].sourceCurrency = 'USD';
  const ok = parseState(serializeState(st)).venues[0];
  assert.equal(ok.sourceCurrency, 'TRY');
  assert.equal(ok.flags[0].sourceCurrency, 'USD');

  const raw = JSON.parse(serializeState(st));
  raw.venues[0].sourceCurrency = 'DOGE';
  raw.venues[0].flags[0].sourceCurrency = 5;
  const bad = parseState(JSON.stringify(raw)).venues[0];
  assert.equal(bad.sourceCurrency, '');
  assert.equal(bad.flags[0].sourceCurrency, undefined);
});

test('teklif kosullari korunur ve bozuk degerler temizlenir', () => {
  const st = state();
  Object.assign(st.venues[0], {
    minimumSpendEur: 7200,
    depositNote: { tr: '%30 kapora', en: '30% deposit' },
    cancellationNote: { tr: '60 gun', en: '60 days' },
    validUntil: '2026-11-20',
  });
  const ok = parseState(serializeState(st)).venues[0];
  assert.equal(ok.minimumSpendEur, 7200);
  assert.equal(ok.depositNote.en, '30% deposit');
  assert.equal(ok.cancellationNote.tr, '60 gun');
  assert.equal(ok.validUntil, '2026-11-20');

  const raw = JSON.parse(serializeState(st));
  Object.assign(raw.venues[0], { minimumSpendEur: 'x', depositNote: 5, validUntil: '2026-13-45' });
  const bad = parseState(JSON.stringify(raw)).venues[0];
  assert.equal(bad.minimumSpendEur, 0);
  assert.deepEqual(bad.depositNote, { tr: '', en: '' });
  assert.equal(bad.validUntil, '');
  assert.equal(parseState(serializeState(state())).venues[0].minimumSpendEur, 0);
});

test('kalem turu info korunur, bilinmeyen tur risk olur', () => {
  const st = state();
  st.venues[0].flags.push({ id: 'i1', type: 'info', label: { tr: 'Drone izni', en: 'Drone permit' }, detail: { tr: '', en: '' }, calcType: 'fixed', amount: 0, active: false });
  const out = parseState(serializeState(st)).venues[0];
  assert.equal(out.flags[1].type, 'info');
  const raw = JSON.parse(serializeState(st));
  raw.venues[0].flags[1].type = 'evil';
  assert.equal(parseState(JSON.stringify(raw)).venues[0].flags[1].type, 'risk');
});

test('sure, tarih ve davetli notlari yedekte korunur', () => {
  const st = state();
  Object.assign(st.venues[0], {
    durationNote: { tr: '2 saat', en: '2 hours' },
    datesNote: { tr: 'Nisan 2027', en: 'April 2027' },
    guestsNote: { tr: '13 kişi', en: '13 guests' },
  });
  const v = parseState(serializeState(st)).venues[0];
  assert.equal(v.durationNote.tr, '2 saat');
  assert.equal(v.datesNote.en, 'April 2027');
  assert.equal(v.guestsNote.tr, '13 kişi');
  assert.deepEqual(parseState(serializeState(state())).venues[0].durationNote, { tr: '', en: '' });
});

test('teklifteki toplam yedekte korunur, bozuk deger 0 olur', () => {
  const st = state();
  st.venues[0].statedTotalEur = 5500;
  assert.equal(parseState(serializeState(st)).venues[0].statedTotalEur, 5500);
  const raw = JSON.parse(serializeState(st));
  raw.venues[0].statedTotalEur = 'x';
  assert.equal(parseState(JSON.stringify(raw)).venues[0].statedTotalEur, 0);
});

test('ek onizlemeler ve birlestirme cakismalari kaydedilmez', () => {
  const st = state();
  st.venues[0].extraPreviews = ['data:image/png;base64,BBBB'];
  st.venues[0].mergeConflicts = [{ key: 'baseFeeEur', kind: 'money', current: 1, incoming: 2 }];
  const json = serializeState(st);
  assert.ok(!json.includes('base64'));
  assert.ok(!json.includes('mergeConflicts'));
  assert.equal(parseState(json).venues[0].name, 'Villa A');
});
