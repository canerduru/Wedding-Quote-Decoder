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
  realPhotoUrl: '/api/venue-photo?url=https%3A%2F%2Fexample.org%2Fa.jpg',
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
  assert.equal(out.exchangeRate, 38.5);
});

test('dis kaynakli foto adresi ve bilinmeyen hesap tipi temizlenir', () => {
  const raw = JSON.parse(serializeState(state()));
  raw.venues[0].realPhotoUrl = 'https://evil.example/x.jpg';
  raw.venues[0].flags[0].calcType = 'eval';
  raw.venues[0].flags[0].amount = 'yuz';
  raw.venues[0].coverKey = 'nope';
  const v = parseState(JSON.stringify(raw)).venues[0];
  assert.equal(v.realPhotoUrl, '');
  assert.equal(v.flags[0].calcType, 'fixed');
  assert.equal(v.flags[0].amount, 0);
  assert.equal(v.coverKey, 'lakeVilla');
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
