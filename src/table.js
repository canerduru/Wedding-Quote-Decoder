import { calculateBreakdown, getFlagAmountEur } from './calc.js';
import { completeness, needsPrice } from './completeness.js';
import { lowestStanding } from './lowest.js';

function cellFor(venue, category, categoryOf, guestCount) {
  const flags = (venue.flags || []).filter((f) => f.type !== 'info' && categoryOf(f) === category);
  const priced = flags.filter((f) => f.type === 'risk' && f.active && !needsPrice(f));
  if (priced.length > 0) {
    return { kind: 'amount', amountEur: priced.reduce((sum, f) => sum + getFlagAmountEur(venue, f, guestCount), 0) };
  }
  if (flags.some((f) => f.type === 'safe')) return { kind: 'included' };
  if (flags.some(needsPrice)) return { kind: 'needs_price' };
  if (flags.length > 0) return { kind: 'excluded' };
  return { kind: 'missing' };
}

export function buildComparison({ venues, guestCount, categories, categoryOf }) {
  const standing = lowestStanding(venues, guestCount);
  const columns = venues.map((venue, i) => {
    const b = calculateBreakdown(venue, guestCount);
    const gaps = completeness(venue);
    return {
      id: venue.id,
      venue,
      rentEur: Number(venue.baseFeeEur) || 0,
      foodEur: b.fbSubtotalEur,
      turnkeyEur: b.turnkeyTotalEur,
      perGuestEur: b.effectivePerGuestEur,
      deltaEur: standing[i].deltaEur,
      best: standing[i].best,
      complete: standing[i].complete,
      hasPrice: b.turnkeyTotalEur > 0,
      ...gaps,
      minimumSpendEur: Number(venue.minimumSpendEur) || 0,
      belowMinimum: (Number(venue.minimumSpendEur) || 0) > 0 && b.turnkeyTotalEur > 0 && b.turnkeyTotalEur < Number(venue.minimumSpendEur),
      depositNote: venue.depositNote || { tr: '', en: '' },
      cancellationNote: venue.cancellationNote || { tr: '', en: '' },
      validUntil: venue.validUntil || '',
      cells: Object.fromEntries(categories.map((cat) => [cat, cellFor(venue, cat, categoryOf, guestCount)])),
    };
  });
  return { columns, categories };
}
