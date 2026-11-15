import { calculateBreakdown, getDeltaFromLowest, getFlagAmountEur, isBestValue } from './calc.js';

function cellFor(venue, category, categoryOf, guestCount) {
  const flags = (venue.flags || []).filter((f) => categoryOf(f) === category);
  const active = flags.filter((f) => f.type === 'risk' && f.active);
  if (active.length > 0) {
    return { kind: 'amount', amountEur: active.reduce((sum, f) => sum + getFlagAmountEur(venue, f, guestCount), 0) };
  }
  if (flags.some((f) => f.type === 'safe')) return { kind: 'included' };
  if (flags.length > 0) return { kind: 'excluded' };
  return { kind: 'missing' };
}

export function buildComparison({ venues, guestCount, categories, categoryOf }) {
  const columns = venues.map((venue) => {
    const b = calculateBreakdown(venue, guestCount);
    return {
      id: venue.id,
      venue,
      rentEur: Number(venue.baseFeeEur) || 0,
      foodEur: b.fbSubtotalEur,
      turnkeyEur: b.turnkeyTotalEur,
      perGuestEur: b.effectivePerGuestEur,
      deltaEur: getDeltaFromLowest(venue, venues, guestCount),
      best: isBestValue(venue, venues, guestCount),
      hasPrice: b.turnkeyTotalEur > 0,
      cells: Object.fromEntries(categories.map((cat) => [cat, cellFor(venue, cat, categoryOf, guestCount)])),
    };
  });
  return { columns, categories };
}
