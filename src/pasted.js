export const MIN_TEXT_LENGTH = 20;
export const MAX_TEXT_LENGTH = 30000;

export function validatePastedText(input) {
  if (typeof input !== 'string') return { ok: false, error: 'empty' };
  const text = input.replace(/\r\n?/g, '\n').trim();
  if (text.length === 0) return { ok: false, error: 'empty' };
  if (text.length < MIN_TEXT_LENGTH) return { ok: false, error: 'short' };
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, error: 'long' };
  return { ok: true, text };
}

export function makeTextDocument({ text, nameHint, name }) {
  return {
    isText: true,
    text,
    name,
    nameHint: String(nameHint || '').replace(/"/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
    size: text.length,
  };
}
