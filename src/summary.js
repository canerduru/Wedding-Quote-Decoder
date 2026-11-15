import { calculateBreakdown } from './calc.js';
import { completeness, statedTotalCheck, stripPriceNote } from './completeness.js';
import { formatValidity } from './terms.js';

export function formatMoney(eur, currency, rate, lang) {
  const amount = Number.isFinite(Number(eur)) ? Number(eur) : 0;
  const value = currency === 'EUR' ? amount : amount * rate;
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  return (currency === 'EUR' ? '€' : '₺') + Math.round(value).toLocaleString(locale);
}

const WORDS = {
  tr: {
    title: 'WEDDING QUOTE DECODER — KARŞILAŞTIRMA ÖZETİ',
    meta: (guests, currency, rate) => `Misafir Sayısı: ${guests} Kişi | Para Birimi: ${currency} (1 € = ${rate} ₺)`,
    unnamed: 'İsimsiz Mekan',
    rent: 'Mekan Kirası',
    food: 'Yemek & İçecek',
    foodPerGuest: (guests) => `Kişi Başı Yemek & İçecek (${guests} kişi)`,
    extras: 'Seçili Ek Hizmetler, Gizli Ekler & KDV',
    total: 'Gerçek Toplam',
    perGuest: 'kişi',
    notStated: 'belirtilmedi',
    included: 'Dahil Edilen Kalemler',
    dates: 'Tarih / Müsaitlik',
    duration: 'Kullanım Süresi',
    guests: 'Davetli',
    stated: 'Teklifteki Toplam',
    minSpend: 'Minimum Harcama',
    deposit: 'Depozito & Ödeme',
    cancellation: 'İptal Koşulları',
    valid: 'Geçerlilik',
    missing: 'Eksik',
    missingRent: 'mekan kirası',
    missingFood: 'yemek & içecek',
    needsPrice: (n) => `${n} kalem için ayrı fiyat gerekli`,
    mismatch: (a, b) => `hesaplanan toplam teklifteki toplamdan farklı (${a} / ${b})`,
    ask: 'Teklifte yazmayanlar (mekana sorulacak)',
    askMin: 'minimum harcama',
    askDeposit: 'depozito & ödeme',
    askCancel: 'iptal koşulları',
    askValid: 'geçerlilik',
  },
  en: {
    title: 'WEDDING QUOTE DECODER — COMPARISON SUMMARY',
    meta: (guests, currency, rate) => `Guest Count: ${guests} Guests | Currency: ${currency} (1 € = ${rate} ₺)`,
    unnamed: 'Unnamed Venue',
    rent: 'Venue Rental',
    food: 'Food & Drink',
    foodPerGuest: (guests) => `Per-Guest Food & Drink (${guests} guests)`,
    extras: 'Selected Add-Ons, Hidden Costs & VAT',
    total: 'True Total',
    perGuest: 'guest',
    notStated: 'not stated',
    included: 'Included Line Items',
    dates: 'Dates / Availability',
    duration: 'Duration',
    guests: 'Guests',
    stated: 'Total Stated in Quote',
    minSpend: 'Minimum Spend',
    deposit: 'Deposit & Payment',
    cancellation: 'Cancellation',
    valid: 'Valid Until',
    missing: 'Missing',
    missingRent: 'venue rental',
    missingFood: 'food & drink',
    needsPrice: (n) => `${n} item(s) need a separate price`,
    mismatch: (a, b) => `calculated total differs from the total in the quote (${a} / ${b})`,
    ask: 'Not stated in the quote (ask the venue)',
    askMin: 'minimum spend',
    askDeposit: 'deposit & payment',
    askCancel: 'cancellation terms',
    askValid: 'validity',
  },
};

const noteOf = (value, lang) => (value?.[lang] || value?.tr || value?.en || '').trim();

export function termRows(venue, { lang = 'tr', money, today = new Date() }) {
  const w = WORDS[lang] || WORDS.tr;
  return [
    [w.dates, noteOf(venue.datesNote, lang)],
    [w.duration, noteOf(venue.durationNote, lang)],
    [w.guests, noteOf(venue.guestsNote, lang)],
    [w.stated, venue.statedTotalEur > 0 ? money(venue.statedTotalEur) : ''],
    [w.minSpend, venue.minimumSpendEur > 0 ? money(venue.minimumSpendEur) : ''],
    [w.deposit, noteOf(venue.depositNote, lang)],
    [w.cancellation, noteOf(venue.cancellationNote, lang)],
    [w.valid, formatValidity(venue.validUntil, lang, today)],
  ].filter(([, value]) => value);
}

export function gapLines(venue, guestCount, { lang = 'tr', money }) {
  const w = WORDS[lang] || WORDS.tr;
  const gaps = completeness(venue);
  const missing = [];
  if (gaps.rentMissing) missing.push(w.missingRent);
  if (gaps.foodMissing) missing.push(w.missingFood);
  if (gaps.needsPriceCount > 0) missing.push(w.needsPrice(gaps.needsPriceCount));
  const check = statedTotalCheck(venue, guestCount);
  if (check.kind === 'mismatch') missing.push(w.mismatch(money(check.computedEur), money(check.statedEur)));

  const asks = [];
  if (!(venue.minimumSpendEur > 0)) asks.push(w.askMin);
  if (!noteOf(venue.depositNote, lang)) asks.push(w.askDeposit);
  if (!noteOf(venue.cancellationNote, lang)) asks.push(w.askCancel);
  if (!venue.validUntil) asks.push(w.askValid);
  return { missing, asks, gaps };
}

export function buildSummary({ venues, guestCount, currency, exchangeRate, lang = 'tr', today = new Date() }) {
  const w = WORDS[lang] || WORDS.tr;
  const money = (eur) => formatMoney(eur, currency, exchangeRate, lang);
  const rate = exchangeRate.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 });

  const lines = [w.title, w.meta(guestCount, currency, rate), '------------------------------------------------------------'];

  venues.forEach((venue, index) => {
    const b = calculateBreakdown(venue, guestCount);
    const { missing, asks, gaps } = gapLines(venue, guestCount, { lang, money });
    const name = (venue.name || '').trim() || w.unnamed;
    const region = noteOf(venue.region, lang);
    lines.push(`${index + 1}. ${name}${region ? ` (${region})` : ''}`);

    lines.push(`   • ${w.rent}: ${gaps.rentMissing ? w.notStated : money(venue.baseFeeEur)}`);
    lines.push(
      gaps.foodMissing
        ? `   • ${w.food}: ${w.notStated}`
        : `   • ${w.foodPerGuest(guestCount)}: ${money(venue.fbPerPersonEur)} -> ${money(b.fbSubtotalEur)}`
    );
    lines.push(`   • ${w.extras}: ${money(b.hiddenExtrasTotalEur)}`);
    lines.push(`   • ${w.total}: ${money(b.turnkeyTotalEur)} (${money(b.effectivePerGuestEur)} / ${w.perGuest})`);

    termRows(venue, { lang, money, today }).forEach(([label, value]) => lines.push(`   • ${label}: ${value}`));

    const included = venue.flags
      .filter((f) => f.type === 'risk' && f.active && !(Number(f.amount) === 0 && f.calcType !== 'vat_pct' && f.calcType !== 'service_pct'))
      .map((f) => stripPriceNote(f.label?.[lang] || f.label?.tr || ''));
    if (included.length) lines.push(`   • ${w.included}: ${included.join('; ')}`);

    if (missing.length) lines.push(`   ⚠ ${w.missing}: ${missing.join('; ')}`);
    if (asks.length) lines.push(`   ? ${w.ask}: ${asks.join(', ')}`);

    lines.push('');
  });

  return lines.join('\n');
}
