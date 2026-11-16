import { calculateBreakdown } from './calc.js';
import { completeness } from './completeness.js';

const isComplete = (c) => !c.rentMissing && !c.foodMissing && c.needsPriceCount === 0;

export function lowestStanding(venues, guestCount) {
  const rows = venues.map((venue) => ({
    id: venue.id,
    total: calculateBreakdown(venue, guestCount).turnkeyTotalEur,
    complete: isComplete(completeness(venue)),
  }));
  const priced = rows.filter((r) => r.total > 0);
  const completePriced = priced.filter((r) => r.complete);
  const floor = priced.length >= 2 ? Math.round(Math.min(...priced.map((r) => r.total))) : null;
  const baseline = completePriced.length ? Math.min(...completePriced.map((r) => r.total)) : null;

  return rows.map((r) => {
    const counts = r.total > 0 && r.complete;
    return {
      ...r,
      best: counts && floor !== null && Math.round(r.total) === floor,
      deltaEur: counts && baseline !== null ? r.total - baseline : 0,
    };
  });
}
