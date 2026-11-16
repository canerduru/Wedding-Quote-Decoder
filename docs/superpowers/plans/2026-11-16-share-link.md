# Share Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One button creates a link that carries the whole comparison; whoever opens it is asked whether to import it, with no file and no re-upload.

**Architecture:** A new pure module `src/share.js` turns the existing `serializeState` JSON into a URL fragment (`#s=z.<base64url of deflate-raw>`) and back, with size caps. Import reuses `parseState`, which already sanitises untrusted data. The Alpine app adds a menu item (copy link), an on-load and `hashchange` check, and a confirmation modal. The fragment never reaches a server.

**Tech Stack:** Web `CompressionStream` / `DecompressionStream` (also in Node 18+ for tests), Alpine.js 3.14.8, `node --test`.

**Working directory:** `/Users/caner/Developer/Wedding-Quote-Decoder`, branch `feat/share-link` (from `main`).

**Conventions:** TDD for `src/`. Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No emoji, no code comments unless the reason is non-obvious, no raw apostrophes in single-quoted i18n strings. Never put an API key in the repo or in a link.

## Design (approved in chat)

- **What travels:** `serializeState(app)` output: venues, guest count, currency, rate, language. Not the Gemini key (stored separately), not quote screenshots or PDF previews (already stripped by `serializeState`).
- **Format:** `<site url>#s=<mode>.<payload>`. `mode` `z` is deflate-raw, `r` is raw UTF-8 (fallback when `CompressionStream` is missing). Payload is base64url.
- **Privacy:** the fragment is not sent to servers or in `Referer`. Anyone with the link sees the prices; the user sends it directly.
- **Opening a link:** on load and on `hashchange`, decode, run `parseState`, clear the fragment (`history.replaceState`) so a reload does not re-prompt, then show a modal: "N venues will be imported", with a warning if the visitor already has cards ("M saved cards will be replaced"). Buttons: import / cancel. Invalid links give a toast.
- **Limits:** payload over 2,000,000 chars or decompressed data over 5 MB is rejected (decompression-bomb guard). Links longer than 6,000 characters still copy but the toast warns that some apps truncate and points to the backup file.
- **Copy:** `navigator.clipboard.writeText`; if it fails, `window.prompt` with the link so the user can copy manually.
- **Out of scope:** merging into existing cards, expiring links, short URLs, a server.

## File structure

| File | Responsibility |
|---|---|
| `src/share.js` (new) | `encodeShare`, `decodeShare`, `buildShareUrl`, `SHARE_WARN_LENGTH` |
| `src/share.test.js` (new) | tests |
| `index.html` (modify) | module expose, state/methods, i18n, menu item, import modal, init hook |

---

### Task 1: `share.js` (TDD)

**Files:**
- Create: `src/share.test.js`
- Create: `src/share.js`

- [ ] **Step 1: Write the failing test**

`src/share.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/share.test.js`
Expected: FAIL, `Cannot find module './share.js'`.

- [ ] **Step 3: Write minimal implementation**

`src/share.js`:

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/share.test.js`
Expected: PASS, 10 tests. If the "bozuk sikistirilmis veri" test does not return null, the garbage happened to inflate; replace its payload with another invalid deflate stream such as `#s=z.__________________` and keep the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/share.js src/share.test.js
git commit -m "feat: encode and decode the comparison as a shareable URL fragment

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wire it into the app

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Expose the module**

In the module script add after `import * as lowest from '/src/lowest.js';`:

```js
      import * as share from '/src/share.js';
```

and after `window.__LOWEST__ = lowest;`:

```js
      window.__SHARE__ = share;
```

- [ ] **Step 2: State**

Next to `drag: null,` add:

```js
          pendingShare: null,
```

- [ ] **Step 3: Methods**

Add directly after the `importBackup` method:

```js
          async checkShareLink() {
            const hash = window.location.hash;
            if (!/^#?s=/.test(hash)) return;
            history.replaceState(null, '', window.location.pathname + window.location.search);
            const json = await window.__SHARE__.decodeShare(hash);
            const restored = json && window.__PERSIST__.parseState(json);
            if (!restored || restored.venues.length === 0) {
              this.showToast(this.t('toastShareInvalid'));
              return;
            }
            this.pendingShare = restored;
          },

          acceptShare() {
            Object.assign(this, this.pendingShare);
            this.pendingShare = null;
            document.documentElement.lang = this.lang;
            document.title = this.t('pageTitle');
            this.refreshIcons();
            this.showToast(this.t('toastShareImported'));
          },

          dismissShare() {
            this.pendingShare = null;
          },

          async shareLink() {
            if (this.venues.length === 0) return;
            const payload = await window.__SHARE__.encodeShare(window.__PERSIST__.serializeState(this));
            const url = window.__SHARE__.buildShareUrl(window.location.origin + window.location.pathname, payload);
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              window.prompt(this.t('shareCopyPrompt'), url);
              return;
            }
            this.showToast(this.t(url.length > window.__SHARE__.SHARE_WARN_LENGTH ? 'toastLinkCopiedLong' : 'toastLinkCopied'));
          },
```

- [ ] **Step 4: Run the check on load and on hash change**

At the end of `init()`, after the final `this.$nextTick(() => { if (window.lucide) window.lucide.createIcons(); });`, add:

```js
            window.addEventListener('hashchange', () => this.checkShareLink());
            this.checkShareLink();
```

- [ ] **Step 5: i18n**

After the TR line `btnBackupImport: 'Yedeği Yükle',` add:

```js
          btnShareLink: 'Link ile paylaş',
          shareCopyPrompt: 'Linki kopyala:',
          toastLinkCopied: 'Link kopyalandı. Açan kişide kartlar kendiliğinden gelir.',
          toastLinkCopiedLong: 'Link kopyalandı ama çok uzun; bazı uygulamalar keser. Gerekirse yedek dosyasını kullan.',
          toastShareInvalid: 'Paylaşım linki geçerli değil ya da bozulmuş.',
          toastShareImported: 'Paylaşılan karşılaştırma yüklendi. Teklif görselleri linke dahil değildir.',
          shareModalTitle: 'Paylaşılan karşılaştırma',
          shareModalBody: 'mekan içe aktarılsın mı?',
          shareModalReplace: 'kayıtlı kart silinip yerine bunlar gelecek.',
          shareAccept: 'İçe aktar',
          shareCancel: 'Vazgeç',
```

After the EN line `btnBackupImport: 'Restore Backup',` add:

```js
          btnShareLink: 'Share link',
          shareCopyPrompt: 'Copy the link:',
          toastLinkCopied: 'Link copied. Whoever opens it gets the cards automatically.',
          toastLinkCopiedLong: 'Link copied but it is very long; some apps truncate it. Use the backup file if needed.',
          toastShareInvalid: 'This share link is not valid or is damaged.',
          toastShareImported: 'Shared comparison loaded. Quote screenshots are not part of links.',
          shareModalTitle: 'Shared comparison',
          shareModalBody: 'venues will be imported. Continue?',
          shareModalReplace: 'saved cards will be removed and replaced by these.',
          shareAccept: 'Import',
          shareCancel: 'Cancel',
```

- [ ] **Step 6: Menu item**

Find (unique):

```html
                  <button type="button" @click="exportBackup(); moreMenuOpen = false" class="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-obsidian hover:bg-blush" x-text="t('btnBackupExport')"></button>
```

Add directly after it:

```html
                  <button type="button" x-show="venues.length > 0" @click="shareLink(); moreMenuOpen = false" class="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-obsidian hover:bg-blush" x-text="t('btnShareLink')"></button>
```

- [ ] **Step 7: Import modal**

Find the closing of the page body: locate the toast element (search `showToast` markup, e.g. the element bound to `toast`) and insert this block as a sibling directly before it (still inside `<body>`):

```html
    <div
      x-show="pendingShare"
      x-cloak
      x-transition.opacity
      @keydown.escape.window="dismissShare()"
      class="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 px-5"
      role="dialog"
      aria-modal="true"
      :aria-label="t('shareModalTitle')"
    >
      <div class="w-full max-w-sm rounded-[24px] border border-champagne-soft bg-white p-6 shadow-card">
        <h2 class="font-serif text-xl font-semibold text-obsidian" x-text="t('shareModalTitle')"></h2>
        <p class="mt-2 text-sm text-stone" x-text="`${pendingShare ? pendingShare.venues.length : 0} ${t('shareModalBody')}`"></p>
        <p x-show="venues.length > 0" class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800" x-text="`${venues.length} ${t('shareModalReplace')}`"></p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" @click="dismissShare()" class="rounded-full border border-champagne-line bg-white px-4 py-2 text-xs font-semibold text-obsidian hover:border-champagne" x-text="t('shareCancel')"></button>
          <button type="button" @click="acceptShare()" class="rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-pearl hover:bg-obsidian/90" x-text="t('shareAccept')"></button>
        </div>
      </div>
    </div>
```

- [ ] **Step 8: Check, build, commit**

```bash
node --input-type=module -e "import fs from 'node:fs'; const s = fs.readFileSync('index.html','utf8'); for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]); console.log('inline ok')"
npm test
npm run build
git add index.html
git commit -m "feat: share the comparison as a link and import it with a confirmation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: `inline ok`, all tests pass, build succeeds.

---

### Task 3: Verify in the browser

**Files:** none (fix anything found, then re-run)

- [ ] **Step 1:** `npm run build && npx vite preview --port 4191 --strictPort` in the background; open `http://localhost:4191/?v=30` in the built-in browser (never `mcp__claude-in-chrome__*`). The origin already holds the 10-venue demo state. Never read or print `wqd:gemini-key`.
- [ ] **Step 2 (link size):** in the page, measure real payload length for all 10 venues and for the first 3:

```js
const a = Alpine.$data(document.body); const S = window.__SHARE__, P = window.__PERSIST__;
const size = async (venues) => (await S.encodeShare(P.serializeState({ ...a.$data ?? a, lang: a.lang, guestCount: a.guestCount, currency: a.currency, exchangeRate: a.exchangeRate, venues }))).length;
({ all: await size(a.venues), three: await size(a.venues.slice(0, 3)), jsonAll: P.serializeState(a).length })
```

Record the numbers; if 5 realistic venues exceed 6,000 characters, report it.
- [ ] **Step 3 (round trip as the recipient):** copy the link (`await window.__SHARE__.buildShareUrl(location.origin + location.pathname, await window.__SHARE__.encodeShare(P.serializeState(a)))`), then `localStorage.removeItem('wqd:v1')` and navigate to the link. Expect: the modal "N mekan içe aktarılsın mı?" with no replace warning, URL fragment already cleared; "İçe aktar" loads all venues with the same names, totals and guest count; reload does not re-prompt; "Vazgeç" leaves the page empty.
- [ ] **Step 4 (existing cards):** with cards present, set `location.hash` to the link's fragment: the modal shows the replace warning; Escape cancels and keeps the cards.
- [ ] **Step 5 (invalid):** navigate to `#s=z.abc` and `#s=r.AAAA`: a toast says the link is invalid, nothing changes, console has no errors.
- [ ] **Step 6 (menu):** the "Link ile paylaş" item shows only with cards; clicking copies a link (toast); at 375 px the modal fits and buttons are reachable.
- [ ] **Step 7:** restore the demo state if changed, reset the viewport (`resize_window` preset `desktop`), stop the server, `npm test`, commit any fixes:

```bash
git add -A
git commit -m "fix: address issues found while verifying the share link

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ship (only after the user says go)

- [ ] Report results and size numbers, ask before pushing. Then `git push -u origin feat/share-link`, `gh pr create --base main`, bind the PR with `mcp__ccd_pr__get_status` / `bind_pr`, merge on the user's yes, watch the Pages run and test a real link on the live site.
