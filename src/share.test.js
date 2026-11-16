import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare, buildShareUrl, SHARE_WARN_LENGTH } from './share.js';
import { serializeState, parseState } from './persist.js';

const sample = JSON.stringify({ name: 'Villa Çiçek İstanbul ✓', notes: 'ğüşıöç', n: [1, 2, 3] });

test('sikistirilmis gidis-donus: Turkce karakterler ve semboller korunur', async () => {
  const payload = await encodeShare(sample);
  assert.match(payload, /^z\.[A-Za-z0-9_-]+$/);
  assert.equal(await decodeShare(`#s=${payload}`), sample);
});

test('ham mod gidis-donus', async () => {
  const payload = await encodeShare(sample, { compress: false });
  assert.match(payload, /^r\.[A-Za-z0-9_-]+$/);
  assert.equal(await decodeShare(`s=${payload}`), sample);
});

test('sikistirma tekrarli veriyi kucultur', async () => {
  const big = JSON.stringify({ rows: Array.from({ length: 200 }, (_, i) => ({ i, text: 'Villa Flori kira KDV dahil degil' })) });
  const payload = await encodeShare(big);
  assert.ok(payload.length < big.length / 3);
});

test('hash # ile ya da # olmadan kabul edilir', async () => {
  const payload = await encodeShare(sample);
  assert.equal(await decodeShare(`#s=${payload}`), sample);
  assert.equal(await decodeShare(`s=${payload}`), sample);
});

test('gecersiz girdiler null doner', async () => {
  for (const bad of ['', '#', '#s=', '#s=z.', '#s=x.abc', '#other=z.abc', '#s=z.!!!', '#s=z.abc', '#s=r.a', undefined, null, 42]) {
    assert.equal(await decodeShare(bad), null, String(bad));
  }
});

test('bozuk sikistirilmis veri null doner', async () => {
  assert.equal(await decodeShare('#s=z.AAAAAAAAAAAAAAAA'), null);
});

test('cok buyuk acilim reddedilir (zip bombasi korumasi)', async () => {
  const bomb = await encodeShare('0'.repeat(6_000_000));
  assert.ok(bomb.length < 100_000);
  assert.equal(await decodeShare(`#s=${bomb}`), null);
});

test('cok uzun yuk reddedilir', async () => {
  assert.equal(await decodeShare(`#s=r.${'A'.repeat(2_000_001)}`), null);
});

test('buildShareUrl ve uyari siniri', () => {
  assert.equal(buildShareUrl('https://x.test/app/', 'z.abc'), 'https://x.test/app/#s=z.abc');
  assert.equal(SHARE_WARN_LENGTH, 6000);
});

test('durum gidis-donus: serializeState -> link -> parseState', async () => {
  const state = {
    lang: 'tr',
    guestCount: 80,
    currency: 'EUR',
    exchangeRate: 55.6667,
    venues: [{ id: 'v1', name: 'Villa Flori', baseFeeEur: 3000, fbPerPersonEur: 50, flags: [] }],
  };
  const payload = await encodeShare(serializeState(state));
  const restored = parseState(await decodeShare(`#s=${payload}`));
  assert.equal(restored.guestCount, 80);
  assert.equal(restored.venues.length, 1);
  assert.equal(restored.venues[0].name, 'Villa Flori');
  assert.equal(restored.venues[0].baseFeeEur, 3000);
});
