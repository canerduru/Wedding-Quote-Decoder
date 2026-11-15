const PCT_TYPES = ['vat_pct', 'service_pct', 'vendor_vat_pct'];
const isPct = (flag) => PCT_TYPES.includes(flag.calcType);
const round2 = (n) => Math.round(n * 100) / 100;

export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;
  if (typeof input !== 'string') return null;
  const text = input.replace(/\s+/g, '');
  let normalized;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) normalized = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) normalized = text.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(text)) normalized = text.replace(',', '.');
  else if (/^\d+(\.\d+)?$/.test(text)) normalized = text;
  else return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function displayAmount(flag, currency, rate) {
  const amount = Number(flag.amount) || 0;
  if (isPct(flag)) return amount;
  return round2(currency === 'TRY' ? amount * rate : amount);
}

export function flagUnit(flag, currency) {
  if (isPct(flag)) return '%';
  const symbol = currency === 'TRY' ? '₺' : '€';
  return flag.calcType === 'per_guest' ? `${symbol} / kişi` : symbol;
}

function recomputeVendorBases(venue, file) {
  const group = venue.flags.filter((f) => f.vendorSourceFile === file);
  const sum = (type) =>
    group.filter((f) => f.type === 'risk' && f.calcType === type).reduce((total, f) => total + (Number(f.amount) || 0), 0);
  const fixed = sum('fixed');
  const perGuest = sum('per_guest');
  group
    .filter((f) => f.calcType === 'vendor_vat_pct')
    .forEach((f) => {
      f.vendorBaseEur = fixed;
      f.vendorPerGuestEur = perGuest;
    });
}

export function applyAmount(venue, flag, input, currency, rate) {
  const value = parseAmount(input);
  if (value === null) return false;
  if (isPct(flag)) {
    if (value > 100) return false;
    flag.amount = value;
    return true;
  }
  const inTry = currency === 'TRY';
  flag.amount = inTry ? value / rate : value;
  flag.sourceCurrency = inTry ? 'TRY' : 'EUR';
  if (flag.vendorSourceFile) recomputeVendorBases(venue, flag.vendorSourceFile);
  return true;
}
