export const SHARE_WARN_LENGTH = 6000;

const MAX_PAYLOAD_CHARS = 2_000_000;
const MAX_JSON_BYTES = 5_000_000;
const HASH_PATTERN = /^#?s=([zr])\.([A-Za-z0-9_-]+)$/;

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipeThrough(bytes, transform) {
  const writer = transform.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = transform.readable.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new Error('payload too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function encodeShare(json, { compress = typeof CompressionStream === 'function' } = {}) {
  const bytes = new TextEncoder().encode(json);
  if (!compress) return `r.${toBase64Url(bytes)}`;
  return `z.${toBase64Url(await pipeThrough(bytes, new CompressionStream('deflate-raw')))}`;
}

export async function decodeShare(hash) {
  const match = HASH_PATTERN.exec(typeof hash === 'string' ? hash : '');
  if (!match || match[2].length > MAX_PAYLOAD_CHARS) return null;
  try {
    let bytes = fromBase64Url(match[2]);
    if (match[1] === 'z') {
      if (typeof DecompressionStream !== 'function') return null;
      bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    } else if (bytes.length > MAX_JSON_BYTES) {
      return null;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export const buildShareUrl = (base, payload) => `${base}#s=${payload}`;
