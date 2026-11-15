export const GUEST_MIN = 10;
export const GUEST_MAX = 1000;
export const GUEST_STEP = 5;

export function clampGuests(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(GUEST_MAX, Math.max(GUEST_MIN, n)) : null;
}

export function sliderPercent(count) {
  const pct = ((Number(count) - GUEST_MIN) / (GUEST_MAX - GUEST_MIN)) * 100;
  return Math.min(100, Math.max(0, pct));
}
