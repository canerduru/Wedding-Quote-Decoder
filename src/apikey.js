const KEY_FORMAT = /^[A-Za-z0-9_-]{20,128}$/;

export function isValidKeyFormat(key) {
  return typeof key === 'string' && KEY_FORMAT.test(key.trim());
}

export function classifyGeminiError(message) {
  const text = String(message || '');
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(text)) return 'key_invalid';
  if (/NOT_FOUND|is not found|not supported for generateContent/i.test(text)) return 'model_unavailable';
  if (/503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|high demand/i.test(text)) return 'transient';
  return 'other';
}
