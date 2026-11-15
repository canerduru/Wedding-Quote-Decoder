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
