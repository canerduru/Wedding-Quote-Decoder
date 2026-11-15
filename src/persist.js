import { DEFAULT_RATES } from './rates.js';

export const STORAGE_KEY = 'wqd:v1';

const VERSION = 1;
const COVER_KEYS = ['lakeVilla', 'bosphorusPalace', 'tuscanEstate', 'modernAtelier'];
const CATEGORIES = ['tax', 'catering', 'music', 'floral', 'boat', 'photo', 'other'];
const CALC_TYPES = ['fixed', 'per_guest', 'service_pct', 'vat_pct', 'vendor_vat_pct'];
const CURRENCIES = ['EUR', 'TRY', 'USD', 'GBP'];
const PHOTO_URL_PREFIXES = ['https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/'];

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const bool = (v) => v === true;
const biText = (v) => ({ tr: str(v?.tr), en: str(v?.en) });

function sanitizeFlag(raw, index) {
  const calcType = CALC_TYPES.includes(raw?.calcType) ? raw.calcType : 'fixed';
  const flag = {
    id: str(raw?.id) || `flag-${index}`,
    type: raw?.type === 'safe' ? 'safe' : 'risk',
    label: biText(raw?.label),
    detail: biText(raw?.detail),
    calcType,
    amount: num(raw?.amount),
    active: bool(raw?.active),
  };
  if (CATEGORIES.includes(raw?.category)) flag.category = raw.category;
  if (CATEGORIES.includes(raw?.vendorCategory)) {
    flag.vendorCategory = raw.vendorCategory;
    flag.vendorSourceFile = str(raw.vendorSourceFile);
    flag.vendorName = str(raw.vendorName);
    flag.vendorBaseEur = num(raw.vendorBaseEur);
    flag.vendorPerGuestEur = num(raw.vendorPerGuestEur);
  }
  if (CURRENCIES.includes(raw?.sourceCurrency)) flag.sourceCurrency = raw.sourceCurrency;
  if (raw?.replacedBy) flag.replacedBy = str(raw.replacedBy);
  return flag;
}

function sanitizeVenue(raw) {
  const realPhotoUrl = PHOTO_URL_PREFIXES.some((prefix) => str(raw.realPhotoUrl).startsWith(prefix)) ? raw.realPhotoUrl : '';
  return {
    id: raw.id,
    name: str(raw.name),
    nameUnknown: bool(raw.nameUnknown),
    editing: bool(raw.editing),
    showAddFlag: false,
    showUploadedPreview: false,
    uploadedPreviewUrl: '',
    realPhotoUrl,
    realPhotoSourceUrl: realPhotoUrl ? str(raw.realPhotoSourceUrl) : '',
    realPhotoSourceLabel: realPhotoUrl ? str(raw.realPhotoSourceLabel) : '',
    realPhotoError: false,
    photoStatus: realPhotoUrl && raw.photoStatus === 'found' ? 'found' : 'idle',
    photoQueryKey: realPhotoUrl ? str(raw.photoQueryKey) : '',
    coverMode: 'auto',
    coverKey: COVER_KEYS.includes(raw.coverKey) ? raw.coverKey : COVER_KEYS[0],
    coverError: false,
    newFlag: { label: '', calcType: 'fixed', amount: '', category: '' },
    region: biText(raw.region),
    venueType: biText(raw.venueType),
    capacityLabel: biText(raw.capacityLabel),
    sourceLabel: biText(raw.sourceLabel),
    sourceCurrency: CURRENCIES.includes(raw.sourceCurrency) ? raw.sourceCurrency : '',
    baseFeeEur: num(raw.baseFeeEur),
    fbPerPersonEur: num(raw.fbPerPersonEur),
    flags: Array.isArray(raw.flags) ? raw.flags.map(sanitizeFlag) : [],
  };
}

function sanitizeState(raw) {
  const guestCount = num(raw.guestCount, 120);
  const exchangeRate = num(raw.exchangeRate, DEFAULT_RATES.TRY);
  return {
    lang: raw.lang === 'en' ? 'en' : 'tr',
    guestCount: guestCount > 0 ? guestCount : 120,
    currency: raw.currency === 'TRY' ? 'TRY' : 'EUR',
    exchangeRate: exchangeRate > 0 ? exchangeRate : DEFAULT_RATES.TRY,
    venues: raw.venues.filter((v) => v && str(v.id)).map(sanitizeVenue),
  };
}

export function serializeState(state) {
  return JSON.stringify({
    version: VERSION,
    lang: state.lang,
    guestCount: state.guestCount,
    currency: state.currency,
    exchangeRate: state.exchangeRate,
    venues: state.venues.map((v) => ({ ...v, uploadedPreviewUrl: '' })),
  });
}

export function parseState(text) {
  if (typeof text !== 'string') return null;
  try {
    const raw = JSON.parse(text);
    if (!raw || raw.version !== VERSION || !Array.isArray(raw.venues)) return null;
    return sanitizeState(raw);
  } catch {
    return null;
  }
}
