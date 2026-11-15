import { createHash, timingSafeEqual } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest();

function readPassword(header) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  return colon === -1 ? null : decoded.slice(colon + 1);
}

export function createBasicAuth({ password, maxFailures = 10, windowMs = 60_000, now = Date.now }) {
  const failures = new Map();
  const expected = password ? sha256(password) : null;

  return function basicAuth(req, res, next) {
    if (req.path === '/health') return next();

    if (!expected) return next();

    const ip = req.ip || 'unknown';
    const entry = failures.get(ip);
    if (entry && entry.resetAt <= now()) failures.delete(ip);
    const current = failures.get(ip);

    if (current && current.count >= maxFailures) {
      return res.status(429).set('Retry-After', String(Math.ceil((current.resetAt - now()) / 1000))).send('Too many attempts.');
    }

    const given = readPassword(req.headers.authorization);
    if (given !== null && timingSafeEqual(sha256(given), expected)) {
      failures.delete(ip);
      return next();
    }

    if (given !== null) {
      const count = (current?.count ?? 0) + 1;
      failures.set(ip, { count, resetAt: current?.resetAt ?? now() + windowMs });
    }
    return res.status(401).set('WWW-Authenticate', 'Basic realm="Wedding Quote Decoder", charset="UTF-8"').send('Authentication required.');
  };
}
