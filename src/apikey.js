const KEY_FORMAT = /^[A-Za-z0-9_-]{20,128}$/;

export function resolveApiKey({ headerKey, serverKey, privateMode }) {
  if (typeof headerKey === 'string' && KEY_FORMAT.test(headerKey.trim())) return headerKey.trim();
  if (privateMode && serverKey) return serverKey;
  return null;
}

export function isKeyRequired({ privateMode, serverKey }) {
  return !(privateMode && serverKey);
}

export function classifyGeminiError(message) {
  const text = String(message || '');
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(text)) return 'key_invalid';
  if (/503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|high demand/i.test(text)) return 'transient';
  return 'other';
}
