import { calculateBreakdown } from './calc.js';

const num = (v) => Number(v) || 0;
const isFlat = (flag) => flag.calcType === 'fixed' || flag.calcType === 'per_guest';

export function needsPrice(flag) {
  return flag.type === 'risk' && isFlat(flag) && !(num(flag.amount) > 0);
}

export function completeness(venue) {
  const flags = venue.flags || [];
  const hasCateringCost = flags.some(
    (f) => f.type === 'risk' && f.active && num(f.amount) > 0 && (f.category === 'catering' || f.vendorCategory === 'catering')
  );
  return {
    rentMissing: !(num(venue.baseFeeEur) > 0),
    foodMissing: !(num(venue.fbPerPersonEur) > 0) && !hasCateringCost,
    needsPriceCount: flags.filter(needsPrice).length,
  };
}

export function statedTotalCheck(venue, guestCount, tolerance = 0.03) {
  const statedEur = num(venue.statedTotalEur);
  const computedEur = calculateBreakdown(venue, guestCount).turnkeyTotalEur;
  if (!(statedEur > 0) || !(computedEur > 0)) return { kind: 'none', statedEur, computedEur };
  const kind = Math.abs(computedEur - statedEur) / statedEur > tolerance ? 'mismatch' : 'ok';
  return { kind, statedEur, computedEur };
}

const PRICE_NOTE = /\s*\((?:fiyat\s+belirtilme[^)]*|price\s+not\s+(?:stated|specified|given))\)\s*$/i;

export function stripPriceNote(label) {
  return typeof label === 'string' ? label.replace(PRICE_NOTE, '').trim() : '';
}
