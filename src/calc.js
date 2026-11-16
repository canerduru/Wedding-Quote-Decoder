const num = (v) => Number(v) || 0;

const isActiveRisk = (flag) => flag.type === 'risk' && flag.active;
const isVendorFlag = (flag) => Boolean(flag.vendorCategory);

function flatAmountEur(flag, guestCount) {
  return flag.calcType === 'per_guest' ? num(flag.amount) * guestCount : num(flag.amount);
}

function vendorPctAmountEur(flag, guestCount) {
  const base = num(flag.vendorBaseEur) + num(flag.vendorPerGuestEur) * guestCount;
  return (base * num(flag.amount)) / 100;
}

function computeParts(venue, guestCount) {
  const baseFeeEur = num(venue.baseFeeEur);
  const fbSubtotalEur = num(venue.fbPerPersonEur) * guestCount;
  const flags = (venue.flags || []).filter(isActiveRisk);

  let venueExtrasEur = 0;
  let vendorExtrasEur = 0;
  let vendorPctEur = 0;
  let servicePct = 0;
  let vatPct = 0;

  for (const flag of flags) {
    if (flag.calcType === 'fixed' || flag.calcType === 'per_guest') {
      if (isVendorFlag(flag)) vendorExtrasEur += flatAmountEur(flag, guestCount);
      else venueExtrasEur += flatAmountEur(flag, guestCount);
    } else if (flag.calcType === 'vendor_vat_pct') {
      vendorPctEur += vendorPctAmountEur(flag, guestCount);
    } else if (flag.calcType === 'service_pct') {
      servicePct += num(flag.amount);
    } else if (flag.calcType === 'vat_pct') {
      vatPct += num(flag.amount);
    }
  }

  const serviceBaseEur = baseFeeEur + fbSubtotalEur + venueExtrasEur;
  const serviceAmountEur = (serviceBaseEur * servicePct) / 100;
  const vatBaseEur = serviceBaseEur + serviceAmountEur;

  return {
    baseFeeEur,
    fbSubtotalEur,
    venueExtrasEur,
    vendorExtrasEur,
    vendorPctEur,
    serviceBaseEur,
    vatBaseEur,
    servicePct,
    vatPct,
    serviceAmountEur,
    vatAmountEur: (vatBaseEur * vatPct) / 100,
  };
}

export function calculateBreakdown(venue, guestCount) {
  const p = computeParts(venue, guestCount);
  const fixedAndGuestExtrasEur = p.venueExtrasEur + p.vendorExtrasEur;
  const hiddenExtrasTotalEur = fixedAndGuestExtrasEur + p.vendorPctEur + p.serviceAmountEur + p.vatAmountEur;
  const turnkeyTotalEur = p.baseFeeEur + p.fbSubtotalEur + hiddenExtrasTotalEur;

  return {
    fbSubtotalEur: p.fbSubtotalEur,
    fixedAndGuestExtrasEur,
    serviceAmountEur: p.serviceAmountEur,
    vatAmountEur: p.vatAmountEur,
    hiddenExtrasTotalEur,
    turnkeyTotalEur,
    effectivePerGuestEur: turnkeyTotalEur / Math.max(1, guestCount),
  };
}

export function getFlagAmountEur(venue, flag, guestCount) {
  if (flag.type !== 'risk') return 0;
  if (flag.calcType === 'fixed' || flag.calcType === 'per_guest') return flatAmountEur(flag, guestCount);
  if (flag.calcType === 'vendor_vat_pct') return vendorPctAmountEur(flag, guestCount);

  const p = computeParts(venue, guestCount);
  if (flag.calcType === 'service_pct') return (p.serviceBaseEur * num(flag.amount)) / 100;
  if (flag.calcType === 'vat_pct') return (p.vatBaseEur * num(flag.amount)) / 100;
  return 0;
}
