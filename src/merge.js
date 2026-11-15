const GENERIC = new Set(['villa', 'hotel', 'otel', 'palace', 'estate', 'resort', 'saray', 'sarayi', 'the', 'and', 'di', 'del', 'della', 'de']);
const MONEY_KEYS = ['baseFeeEur', 'fbPerPersonEur', 'minimumSpendEur', 'statedTotalEur'];
const NOTE_KEYS = ['depositNote', 'cancellationNote', 'durationNote', 'datesNote', 'guestsNote'];
const TOLERANCE = 0.01;

export function normalizeName(value) {
  return (typeof value === 'string' ? value : '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const distinctiveTokens = (normalized) => new Set(normalized.split(' ').filter((t) => t && !GENERIC.has(t)));

const isSubset = (a, b) => [...a].every((t) => b.has(t));

export function findSameVenue(venues, name) {
  const wanted = normalizeName(name);
  if (wanted.length < 3) return { kind: 'none' };

  const named = venues.filter((v) => normalizeName(v.name).length >= 3);
  const exact = named.find((v) => normalizeName(v.name) === wanted);
  if (exact) return { kind: 'exact', venue: exact };

  const wantedTokens = distinctiveTokens(wanted);
  if (wantedTokens.size === 0) return { kind: 'none' };
  const candidates = named.filter((v) => {
    const tokens = distinctiveTokens(normalizeName(v.name));
    return tokens.size > 0 && (isSubset(wantedTokens, tokens) || isSubset(tokens, wantedTokens));
  });
  return candidates.length ? { kind: 'similar', venue: candidates[0], candidates } : { kind: 'none' };
}

const noteEmpty = (note) => !note?.tr && !note?.en;
const noteKey = (note) => `${note?.tr || ''}|${note?.en || ''}`;

export function mergeVenue(target, source) {
  const conflicts = [];

  if (!(target.name || '').trim() && (source.name || '').trim()) {
    target.name = source.name;
    target.nameUnknown = false;
  }
  if (!target.sourceCurrency) target.sourceCurrency = source.sourceCurrency || '';

  for (const key of MONEY_KEYS) {
    const current = Number(target[key]) || 0;
    const incoming = Number(source[key]) || 0;
    if (!(incoming > 0)) continue;
    if (current === 0) target[key] = incoming;
    else if (Math.abs(current - incoming) / Math.max(current, incoming) > TOLERANCE) {
      conflicts.push({ key, kind: 'money', current, incoming, incomingCurrency: source.sourceCurrency || '' });
    }
  }

  for (const key of NOTE_KEYS) {
    if (noteEmpty(source[key])) continue;
    if (noteEmpty(target[key])) target[key] = { ...source[key] };
    else if (noteKey(target[key]) !== noteKey(source[key])) {
      conflicts.push({ key, kind: 'text', current: { ...target[key] }, incoming: { ...source[key] } });
    }
  }

  if (source.validUntil) {
    if (!target.validUntil) target.validUntil = source.validUntil;
    else if (target.validUntil !== source.validUntil) {
      conflicts.push({ key: 'validUntil', kind: 'date', current: target.validUntil, incoming: source.validUntil });
    }
  }

  target.extraPreviews = [...(target.extraPreviews || [])];
  if (source.uploadedPreviewUrl) {
    if (!target.uploadedPreviewUrl) target.uploadedPreviewUrl = source.uploadedPreviewUrl;
    else target.extraPreviews.push(source.uploadedPreviewUrl);
  }
  target.extraPreviews.push(...(source.extraPreviews || []));

  if (!target.realPhotoUrl && source.realPhotoUrl) {
    target.realPhotoUrl = source.realPhotoUrl;
    target.realPhotoSourceUrl = source.realPhotoSourceUrl || '';
    target.realPhotoSourceLabel = source.realPhotoSourceLabel || '';
    target.realPhotoError = Boolean(source.realPhotoError);
    target.photoStatus = source.photoStatus || 'found';
    target.photoQueryKey = source.photoQueryKey || '';
  }

  target.sourceLabel = {
    tr: `${target.sourceLabel?.tr || ''} + ${source.sourceLabel?.tr || ''}`,
    en: `${target.sourceLabel?.en || ''} + ${source.sourceLabel?.en || ''}`,
  };

  const seen = new Set(target.flags.map((f) => normalizeName(f.label?.tr)));
  for (const f of source.flags || []) {
    const label = normalizeName(f.label?.tr);
    if (seen.has(label)) continue;
    seen.add(label);
    target.flags.push({ ...f, id: `${f.id}-m${Math.random().toString(36).slice(2, 6)}` });
  }

  return conflicts;
}

export function resolveConflict(target, conflict, choice) {
  if (choice !== 'incoming') return;
  if (conflict.kind === 'money') {
    target[conflict.key] = conflict.incoming;
    if (conflict.incomingCurrency) target.sourceCurrency = conflict.incomingCurrency;
  } else if (conflict.kind === 'text') {
    target[conflict.key] = { ...conflict.incoming };
  } else {
    target[conflict.key] = conflict.incoming;
  }
}
