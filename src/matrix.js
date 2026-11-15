import { statedTotalCheck } from './completeness.js';
import { validityStatus } from './terms.js';

export const LONG_TEXT = 60;

const NOTE_ROWS = ['datesNote', 'durationNote', 'guestsNote'];
const TAIL_NOTE_ROWS = ['depositNote', 'cancellationNote'];

const noteText = (value, lang) => (value?.[lang] || value?.tr || value?.en || '').trim();
const MISSING = { kind: 'missing' };
const DASH = { kind: 'dash' };

function markLowest(cells, values) {
  const priced = values.filter((v) => v > 0);
  if (priced.length < 2) return cells;
  const lowest = Math.min(...priced);
  return cells.map((cell, i) => (values[i] === lowest ? { ...cell, best: true } : cell));
}

export function buildMatrix({ columns, categories, lang, money, t, categoryTitle, validityText, venues, guestCount }) {
  const textCell = (text) => (text ? { kind: 'text', text, long: text.length > LONG_TEXT } : MISSING);

  const headers = columns.map((col) => {
    const reasons = [];
    if (col.rentMissing) reasons.push(t('gapRent'));
    if (col.foodMissing) reasons.push(t('gapFood'));
    if (col.needsPriceCount > 0) reasons.push(`${col.needsPriceCount} ${t('gapNeedsPrice')}`);
    const check = statedTotalCheck(col.venue, guestCount);
    const mismatch = check.kind === 'mismatch';
    if (mismatch) reasons.push(t('gapMismatch'));
    const gapCount = (col.rentMissing ? 1 : 0) + (col.foodMissing ? 1 : 0) + col.needsPriceCount + (mismatch ? 1 : 0);
    return { id: col.id, venue: col.venue, best: col.best, hasPrice: col.hasPrice, turnkeyEur: col.turnkeyEur, perGuestEur: col.perGuestEur, gapCount, gapReasons: reasons };
  });

  const rentValues = columns.map((c) => (c.rentMissing ? 0 : c.rentEur));
  const foodValues = columns.map((c) => (c.foodMissing ? 0 : c.foodEur));

  const priceRows = [
    {
      key: 'delta',
      label: t('rowDelta'),
      cells: columns.map((c) => (c.hasPrice && c.deltaEur > 0 ? { kind: 'amount', text: `+${money(c.deltaEur)}` } : DASH)),
    },
    {
      key: 'stated',
      label: t('termsStatedTotal'),
      cells: columns.map((c) => (c.venue.statedTotalEur > 0 ? { kind: 'amount', text: money(c.venue.statedTotalEur) } : DASH)),
    },
    {
      key: 'rent',
      label: t('baseFeeLabel'),
      cells: markLowest(columns.map((c) => (c.rentMissing ? MISSING : { kind: 'amount', text: money(c.rentEur) })), rentValues),
    },
    {
      key: 'food',
      label: t('rowFood'),
      cells: markLowest(columns.map((c) => (c.foodMissing ? MISSING : { kind: 'amount', text: money(c.foodEur) })), foodValues),
    },
  ];

  const noteRow = (key) => ({ key, label: t(NOTE_LABELS[key]), cells: columns.map((c) => textCell(noteText(c.venue[key], lang))) });

  const termsRows = [
    ...NOTE_ROWS.map(noteRow),
    {
      key: 'minSpend',
      label: t('termsMinSpend'),
      cells: columns.map((c) =>
        c.minimumSpendEur > 0 ? { kind: 'amount', text: money(c.minimumSpendEur), warn: c.belowMinimum } : MISSING
      ),
    },
    ...TAIL_NOTE_ROWS.map(noteRow),
    {
      key: 'validUntil',
      label: t('termsValid'),
      cells: columns.map((c) => {
        const text = c.validUntil ? validityText(c.validUntil) : '';
        if (!text) return MISSING;
        return { kind: 'text', text, long: false, expired: validityStatus(c.validUntil).state === 'expired' };
      }),
    },
  ];

  const kindCell = {
    amount: (cell) => ({ kind: 'amount', text: `+${money(cell.amountEur)}` }),
    included: () => ({ kind: 'included', text: t('includedLabel') }),
    excluded: () => ({ kind: 'excluded', text: t('excludedLabel') }),
    needs_price: () => ({ kind: 'needs_price', text: t('noPriceShort') }),
    missing: () => MISSING,
  };
  const extraRows = categories.map((cat) => ({
    key: `cat:${cat}`,
    label: categoryTitle(cat),
    cells: columns.map((c) => kindCell[c.cells[cat].kind](c.cells[cat])),
  }));

  const groups = [
    { key: 'price', label: t('tableGroupPrice'), rows: priceRows },
    { key: 'terms', label: t('tableGroupTerms'), rows: termsRows },
  ];
  if (extraRows.length) groups.push({ key: 'extras', label: t('tableGroupExtras'), rows: extraRows });

  groups.forEach((group) =>
    group.rows.forEach((row) => {
      row.cells = row.cells.map((cell, i) => ({ ...cell, colId: headers[i].id, colBest: headers[i].best }));
    })
  );

  return { columns: headers, groups };
}

const NOTE_LABELS = {
  datesNote: 'termsDates',
  durationNote: 'termsDuration',
  guestsNote: 'termsGuests',
  depositNote: 'termsDeposit',
  cancellationNote: 'termsCancel',
};
