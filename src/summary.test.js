import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, buildSummary } from './summary.js';

const bi = (tr, en = tr) => ({ tr, en });
const TODAY = new Date('2026-11-15T12:00:00');
const venue = (over = {}) => ({
  id: 'v',
  name: 'Villa Flori',
  region: bi('Como Gölü, İtalya', 'Lake Como, Italy'),
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
  flags: [],
  ...over,
});
const risk = (label, amount, extra = {}) => ({ type: 'risk', active: true, calcType: 'fixed', amount, label: bi(label), detail: bi(''), ...extra });
const build = (venues, over = {}) => buildSummary({ venues, guestCount: 120, currency: 'EUR', exchangeRate: 55.6667, lang: 'tr', today: TODAY, ...over });

test('formatMoney: EUR ve TRY, TR ve EN bicimleri', () => {
  assert.equal(formatMoney(3000, 'EUR', 55.6667, 'tr'), '€3.000');
  assert.equal(formatMoney(3000, 'EUR', 55.6667, 'en'), '€3,000');
  assert.equal(formatMoney(1000, 'TRY', 55.6667, 'tr'), '₺55.667');
  assert.equal(formatMoney('x', 'EUR', 55.6667, 'tr'), '€0');
});

test('ozet: baslik, kur ve mekan satirlari', () => {
  const text = build([venue({ flags: [risk('Temizlik', 400)] })]);
  assert.match(text, /KARŞILAŞTIRMA ÖZETİ/);
  assert.match(text, /120 Kişi/);
  assert.match(text, /55,6667/);
  assert.match(text, /1\. Villa Flori \(Como Gölü, İtalya\)/);
  assert.match(text, /Mekan Kirası: €3\.000/);
  assert.match(text, /Gerçek Toplam: €3\.400/);
  assert.match(text, /Dahil Edilen Kalemler: Temizlik/);
});

test('ozet: yeni alanlar yalnizca dolu olanlar icin satir olur', () => {
  const text = build([
    venue({
      datesNote: bi('29 Nisan 2027'),
      durationNote: bi('1 saat'),
      guestsNote: bi('13 kişi'),
      minimumSpendEur: 5000,
      depositNote: bi('%30 kapora'),
      statedTotalEur: 3400,
      validUntil: '2026-11-20',
    }),
  ]);
  assert.match(text, /Tarih \/ Müsaitlik: 29 Nisan 2027/);
  assert.match(text, /Kullanım Süresi: 1 saat/);
  assert.match(text, /Davetli: 13 kişi/);
  assert.match(text, /Minimum Harcama: €5\.000/);
  assert.match(text, /Depozito & Ödeme: %30 kapora/);
  assert.match(text, /Teklifteki Toplam: €3\.400/);
  assert.match(text, /Geçerlilik: 20 Kas 2026 · 5 gün kaldı/);
  assert.ok(!/İptal Koşulları:/.test(text));
});

test('ozet: eksik bilgiler ve sorulacaklar listelenir', () => {
  const text = build([venue({ flags: [{ type: 'risk', active: false, calcType: 'fixed', amount: 0, label: bi('Müzik Hariç'), detail: bi('') }] })]);
  assert.match(text, /Yemek & İçecek: belirtilmedi/);
  assert.match(text, /⚠ Eksik: yemek & içecek; 1 kalem için ayrı fiyat gerekli/);
  assert.match(text, /\? Teklifte yazmayanlar \(mekana sorulacak\): minimum harcama, depozito & ödeme, iptal koşulları, geçerlilik/);
});

test('ozet: tam teklifte uyari ve sorulacak satiri yok', () => {
  const text = build([
    venue({
      fbPerPersonEur: 90,
      minimumSpendEur: 1000,
      depositNote: bi('%30'),
      cancellationNote: bi('60 gün'),
      validUntil: '2026-12-01',
    }),
  ]);
  assert.ok(!text.includes('⚠'));
  assert.ok(!text.includes('Teklifte yazmayanlar'));
});

test('ozet: Ingilizce etiketler', () => {
  const text = build([venue({ datesNote: bi('Nisan', 'April') })], { lang: 'en' });
  assert.match(text, /COMPARISON SUMMARY/);
  assert.match(text, /Venue Rental: €3,000/);
  assert.match(text, /Dates \/ Availability: April/);
  assert.match(text, /Food & Drink: not stated/);
});

test('ozet: isimsiz mekan ve TRY goruntusu', () => {
  const text = build([venue({ name: '' })], { currency: 'TRY' });
  assert.match(text, /1\. İsimsiz Mekan/);
  assert.match(text, /₺/);
});
