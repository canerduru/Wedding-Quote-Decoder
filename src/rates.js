// ECB reference rates (EUR base). 15 Nov 2026 is a Sunday, so this is the latest fixing: Fri 13 Nov 2026.
export const DEFAULT_RATES = { date: '2026-11-13', source: 'ECB', TRY: 55.6667, USD: 1.1052, GBP: 0.83559 };

const SUPPORTED = ['EUR', 'TRY', 'USD', 'GBP'];
const isFlat = (flag) => flag.calcType === 'fixed' || flag.calcType === 'per_guest';

export function toEur(amount, currency, rates) {
  const value = Number(amount) || 0;
  return currency === 'EUR' || !rates[currency] ? value : value / rates[currency];
}

export function convertDecoded(raw, rates) {
  const known = SUPPORTED.includes(raw.currency);
  const currency = known ? raw.currency : 'EUR';
  return {
    ...raw,
    baseFeeEur: toEur(raw.baseFee, currency, rates),
    fbPerPersonEur: toEur(raw.fbPerPerson, currency, rates),
    flags: (raw.flags || []).map((flag) => ({
      ...flag,
      amount: isFlat(flag) ? toEur(flag.amount, currency, rates) : flag.amount,
      sourceCurrency: currency,
    })),
    sourceCurrency: currency,
    currencyUnknown: !known,
  };
}

export function rescaleSource(venue, currency, oldRate, newRate) {
  if (!(newRate > 0) || !Number.isFinite(newRate) || !(oldRate > 0)) return;
  const factor = oldRate / newRate;
  if (venue.sourceCurrency === currency) {
    venue.baseFeeEur = (Number(venue.baseFeeEur) || 0) * factor;
    venue.fbPerPersonEur = (Number(venue.fbPerPersonEur) || 0) * factor;
  }
  for (const flag of venue.flags || []) {
    if (flag.sourceCurrency !== currency) continue;
    if (isFlat(flag)) flag.amount = (Number(flag.amount) || 0) * factor;
    if (flag.calcType === 'vendor_vat_pct') {
      flag.vendorBaseEur = (Number(flag.vendorBaseEur) || 0) * factor;
      flag.vendorPerGuestEur = (Number(flag.vendorPerGuestEur) || 0) * factor;
    }
  }
}
