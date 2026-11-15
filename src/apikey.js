const KEY_FORMAT = /^[A-Za-z0-9._~+/=-]{20,256}$/;
const SURROUNDING_QUOTES = /^["'“”‘’]+|["'“”‘’]+$/g;

export function normalizeKey(key) {
  return typeof key === 'string' ? key.trim().replace(SURROUNDING_QUOTES, '').trim() : '';
}

export function isValidKeyFormat(key) {
  return KEY_FORMAT.test(normalizeKey(key));
}

export function classifyGeminiError(message) {
  const text = String(message || '');
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(text)) return 'key_invalid';
  if (/NOT_FOUND|is not found|not supported for generateContent/i.test(text)) return 'model_unavailable';
  if (/503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|high demand/i.test(text)) return 'transient';
  return 'other';
}
