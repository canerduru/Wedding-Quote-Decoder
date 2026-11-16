import { calculateBreakdown } from './calc.js';
import { completeness } from './completeness.js';

export function cardSummary(venue, guestCount) {
  const breakdown = calculateBreakdown(venue, guestCount);
  const missing = completeness(venue);
  return {
    totalEur: breakdown.turnkeyTotalEur,
    perGuestEur: breakdown.effectivePerGuestEur,
    included: (venue.flags || []).filter((flag) => flag.type === 'safe').length,
    gaps: (missing.rentMissing ? 1 : 0) + (missing.foodMissing ? 1 : 0) + missing.needsPriceCount,
  };
}
