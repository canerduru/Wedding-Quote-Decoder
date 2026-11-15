const str = (v) => (typeof v === 'string' ? v : '');
const biText = (v) => ({ tr: str(v?.tr), en: str(v?.en) });

export const emptyTerms = () => ({
  minimumSpendEur: 0,
  depositNote: { tr: '', en: '' },
  cancellationNote: { tr: '', en: '' },
  validUntil: '',
});

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? '' : value;
}

export function termsFromDecoded(raw) {
  const minimum = Number(raw?.minimumSpendEur);
  return {
    minimumSpendEur: Number.isFinite(minimum) && minimum > 0 ? minimum : 0,
    depositNote: biText(raw?.depositNote),
    cancellationNote: biText(raw?.cancellationNote),
    validUntil: validIsoDate(raw?.validUntil),
  };
}

export function validityStatus(validUntil, today = new Date()) {
  const valid = validIsoDate(validUntil);
  if (!valid) return { state: 'none', days: null };
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((Date.parse(`${valid}T00:00:00Z`) - todayUtc) / 86400000);
  return { state: days < 0 ? 'expired' : 'valid', days };
}
