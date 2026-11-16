# Compact Cards, Expand Toggle and Drag Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cards in card view default to a short summary (name, turnkey total, included-feature count), open downward on demand via one global button or a per-card arrow, and can be reordered by drag and drop while all cards are closed.

**Architecture:** Pure logic lives in three small ES modules under `src/` (`reorder.js`, `cardsummary.js`, additions to `viewmode.js`), each with `node --test` tests, exposed to the Alpine app through `window.__X__` globals like every other module. `index.html` gets a compact block inside each `<article>`, the existing card body is wrapped in `x-show="isCardOpen(venue)"`, and SortableJS (bundled by Vite) is attached to the card grid; Alpine's `venues` array stays the single source of truth for order.

**Tech Stack:** Alpine.js 3.14.8, Vite 8, SortableJS 1.15.7 (new, pinned), Tailwind CDN, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-16-compact-cards-reorder-design.md`

> **Deviation recorded during execution:** Tasks 4 and 5 describe SortableJS. It was implemented, then dropped: its fallback drag appends a clone of the card outside the `x-for` scope and Alpine threw ~270 `venue is not defined` errors per drag. The final code uses a pointer-capture drag driven by Alpine state (`startDrag`, `dragCardStyle`, `dragCardClass`) plus a tested `indexAtPoint` in `src/reorder.js`; there is no SortableJS dependency and no `initSortable`. Commit `0403b05`.

**Working directory:** `/Users/caner/Developer/Wedding-Quote-Decoder`, branch `feat/comparison-redesign` (the redesign commit `96009e8` is not pushed yet; this work ships in the same PR).

**Conventions:** TDD for every `src/` module. Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No emoji in code or UI strings. No code comments unless the reason is non-obvious. Never put an API key anywhere in the repo.

---

## File structure

| File | Responsibility |
|---|---|
| `src/reorder.js` (new) | `moveIndex(list, from, to)`: pure array move, returns a new array |
| `src/reorder.test.js` (new) | tests for the above |
| `src/cardsummary.js` (new) | `cardSummary(venue, guestCount)`: total, per guest, included count, gap count for the closed card |
| `src/cardsummary.test.js` (new) | tests for the above |
| `src/viewmode.js` (modify) | `CARDS_OPEN_KEY`, `loadCardsOpen`, `saveCardsOpen`, `compactGridStyle` |
| `src/viewmode.test.js` (modify) | tests for the new exports |
| `package.json`, `package-lock.json` (modify) | add `sortablejs` 1.15.7 |
| `index.html` (modify) | module imports, state/methods, i18n, toolbar button, compact block, open-card collapse button, Sortable init |
| `docs/superpowers/specs/2026-11-16-compact-cards-reorder-design.md` (modify) | align spec with the decisions below |

## Decisions made while planning (spec is updated in Task 0)

1. **One grid, not two sections.** Splitting open and closed cards into two grids would need the 800-line card markup twice. Instead the grid keeps `venues` order, and its column width depends on state: all cards closed gives the narrow compact grid, anything open gives the existing wide grid. Compact cards in the wide grid simply take one column.
2. **Open card = today's card unchanged.** The compact block shows only while a card is closed; when open, the existing cover and body show exactly as today, plus a collapse arrow in the cover controls. No refactor of the existing markup.
3. **Per-card override wins.** `isCardOpen(venue) = openCards[id] ?? cardsOpen` (single venue: always open). This lets the user close one card while the global state is "open".
4. **Module split.** `includedCount` moves out of `reorder.js` into `cardsummary.js` next to the other summary numbers. `moveIndex` works on indexes (what SortableJS reports), not ids.
5. **Gap count in the closed card** = missing rent + missing food + items needing a price. The stated-total mismatch check stays table-only.

---

### Task 0: Align the spec with the decisions

**Files:**
- Modify: `docs/superpowers/specs/2026-11-16-compact-cards-reorder-design.md`

- [ ] **Step 1: Replace the "Açık kart" section**

Replace the whole `### Açık kart` section (from that heading up to the next `###` heading) with:

```markdown
### Açık kart

- Açık kart bugünkü kartın aynısıdır: kapak, başlık, kira, yemek, ek ücretler, koşullar,
  bayraklar, düzenleme, birleştirme, çakışmalar. Kapağın sağ üstüne bir "kapat" oku eklenir.
- Kapalıyken özet blok görünür, açılınca yerini bugünkü kart alır; kart aşağı doğru uzar.
- Izgara tek parçadır ve `venues` sırasını korur. Tüm kartlar kapalıyken dar ızgara
  (`minmax(230px, 1fr)`, `auto-fill`) kullanılır; en az bir kart açıksa mevcut geniş ızgara
  (`density` ayarına uyar) kullanılır ve kapalı kartlar o ızgarada tek sütun kaplar.
- Kart boyutu (density) düğmeleri sadece en az bir kart açıkken görünür.
```

- [ ] **Step 2: Replace the open/closed rule in "Genel buton"**

Replace the bullet starting with `- \`cardsOpen\` (genel) ve \`openCards\`` and the following bullet that starts with `Bir kart açıksa:` (if it is a separate line) with:

```markdown
- `cardsOpen` (genel) ve `openCards` (kart başına istisna, id -> boolean) iki durum.
  Bir kart açık mı: `openCards[id] ?? cardsOpen`. Tek mekan varken kart her zaman açıktır.
```

- [ ] **Step 3: Replace the code-structure table rows**

In the `## Kod yapısı` table, replace the `src/reorder.js` and `src/reorder.test.js` rows and add `cardsummary` rows:

```markdown
| `src/reorder.js` (yeni) | `moveIndex(list, from, to)` (yeni dizi döner, aralık dışı ya da aynı indekste aynı diziyi döner) |
| `src/reorder.test.js` (yeni) | birim testler |
| `src/cardsummary.js` (yeni) | `cardSummary(venue, guestCount)` -> `{ totalEur, perGuestEur, included, gaps }` |
| `src/cardsummary.test.js` (yeni) | birim testler |
```

Also change the `viewmode.js` row to: `loadCardsOpen/saveCardsOpen`, `CARDS_OPEN_KEY`, `compactGridStyle()`. In the test plan replace the `includedCount` bullet with `cardSummary: sadece safe sayılır, info ve risk sayılmaz; toplam, kişi başı, eksik sayısı doğru; boş mekan 0 toplam ve 2 eksik`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-11-16-compact-cards-reorder-design.md
git commit -m "docs: align card spec with single-grid and override decisions

The two-section layout would duplicate the card markup; one grid with a
state-dependent column width gives the same result without a refactor.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: `moveIndex` (reorder logic)

**Files:**
- Create: `src/reorder.test.js`
- Create: `src/reorder.js`

- [ ] **Step 1: Write the failing test**

`src/reorder.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveIndex } from './reorder.js';

test('moveIndex: bastan sona tasir', () => {
  assert.deepEqual(moveIndex(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
});

test('moveIndex: sondan basa tasir', () => {
  assert.deepEqual(moveIndex(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
});

test('moveIndex: ortaya tasir', () => {
  assert.deepEqual(moveIndex(['a', 'b', 'c', 'd'], 0, 1), ['b', 'a', 'c', 'd']);
});

test('moveIndex: girdiyi degistirmez ve yeni dizi dondurur', () => {
  const input = ['a', 'b', 'c'];
  const out = moveIndex(input, 0, 2);
  assert.deepEqual(input, ['a', 'b', 'c']);
  assert.notEqual(out, input);
});

test('moveIndex: ayni indeks ve aralik disi indeks diziyi oldugu gibi dondurur', () => {
  const input = ['a', 'b', 'c'];
  assert.equal(moveIndex(input, 1, 1), input);
  assert.equal(moveIndex(input, -1, 1), input);
  assert.equal(moveIndex(input, 0, 3), input);
  assert.equal(moveIndex(input, undefined, 1), input);
  assert.equal(moveIndex(input, 0.5, 1), input);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/reorder.test.js`
Expected: FAIL, `Cannot find module './reorder.js'` (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Write minimal implementation**

`src/reorder.js`:

```js
export function moveIndex(list, from, to) {
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < list.length;
  if (!inRange(from) || !inRange(to) || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/reorder.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/reorder.js src/reorder.test.js
git commit -m "feat: add moveIndex for reordering venue cards

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `cardSummary` (numbers for the closed card)

**Files:**
- Create: `src/cardsummary.test.js`
- Create: `src/cardsummary.js`

- [ ] **Step 1: Write the failing test**

`src/cardsummary.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSummary } from './cardsummary.js';

const risk = (calcType, amount) => ({ type: 'risk', active: true, calcType, amount });

test('cardSummary: toplam, kisi basi, dahil ve eksik sayisi', () => {
  const venue = {
    baseFeeEur: 10000,
    fbPerPersonEur: 100,
    flags: [{ type: 'safe' }, { type: 'safe' }, { type: 'info' }, risk('vat_pct', 20), risk('fixed', 0)],
  };
  const s = cardSummary(venue, 100);
  assert.equal(s.totalEur, 24000);
  assert.equal(s.perGuestEur, 240);
  assert.equal(s.included, 2);
  assert.equal(s.gaps, 1);
});

test('cardSummary: sadece safe dahil sayilir', () => {
  const venue = { baseFeeEur: 1, fbPerPersonEur: 1, flags: [{ type: 'info' }, risk('fixed', 5)] };
  assert.equal(cardSummary(venue, 10).included, 0);
});

test('cardSummary: bos mekan 0 toplam, kira ve yemek eksik', () => {
  const s = cardSummary({ baseFeeEur: 0, fbPerPersonEur: 0, flags: [] }, 100);
  assert.equal(s.totalEur, 0);
  assert.equal(s.included, 0);
  assert.equal(s.gaps, 2);
});

test('cardSummary: bayraksiz mekanda hata vermez', () => {
  const s = cardSummary({ baseFeeEur: 5000, fbPerPersonEur: 50 }, 100);
  assert.equal(s.totalEur, 10000);
  assert.equal(s.included, 0);
  assert.equal(s.gaps, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/cardsummary.test.js`
Expected: FAIL, `Cannot find module './cardsummary.js'`.

- [ ] **Step 3: Write minimal implementation**

`src/cardsummary.js`:

```js
import { calculateBreakdown } from './calc.js';
import { completeness } from './completeness.js';

export function cardSummary(venue, guestCount) {
  const breakdown = calculateBreakdown(venue, guestCount);
  const missing = completeness(venue);
  return {
    totalEur: breakdown.turnkeyTotalEur,
    perGuestEur: breakdown.effectivePerGuestEur,
    included: (venue.flags || []).filter((flag) => flag.type === 'safe').length,
    gaps: (missing.rentMissing ? 1 : 0) + (missing.foodMissing ? 1 : 0) + missing.needsPriceCount,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/cardsummary.test.js`
Expected: PASS, 4 tests. (Check by hand if a number is off: 10000 + 100*100 = 20000, VAT 20% = 4000, total 24000; the `fixed` 0 flag adds nothing and is the one "needs price" gap.)

- [ ] **Step 5: Commit**

```bash
git add src/cardsummary.js src/cardsummary.test.js
git commit -m "feat: add cardSummary for the compact venue card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Persisted global open state and compact grid style

**Files:**
- Modify: `src/viewmode.test.js` (extend the import list and append tests)
- Modify: `src/viewmode.js` (append exports)

- [ ] **Step 1: Write the failing tests**

In `src/viewmode.test.js` change the import to also include the new names:

```js
import {
  VIEW_KEY,
  DENSITY_KEY,
  CARDS_OPEN_KEY,
  resolveViewMode,
  loadViewMode,
  saveViewMode,
  resolveDensity,
  loadDensity,
  saveDensity,
  densityZoom,
  gridStyle,
  loadCardsOpen,
  saveCardsOpen,
  compactGridStyle,
} from './viewmode.js';
```

Append at the end of the file:

```js
test('cards-open: varsayilan kapali, gidis-donus, bozuk deger ve engelli depo kapali sayilir', () => {
  assert.equal(loadCardsOpen(fakeStorage()), false);
  const store = fakeStorage();
  saveCardsOpen(store, true);
  assert.equal(store.data[CARDS_OPEN_KEY], 'true');
  assert.equal(loadCardsOpen(store), true);
  saveCardsOpen(store, false);
  assert.equal(loadCardsOpen(store), false);
  assert.equal(loadCardsOpen(fakeStorage({ [CARDS_OPEN_KEY]: 'garbage' })), false);
  assert.equal(loadCardsOpen({ getItem() { throw new Error('blocked'); } }), false);
  assert.doesNotThrow(() => saveCardsOpen({ setItem() { throw new Error('blocked'); } }, true));
});

test('compactGridStyle: dar sutunlu sabit izgara, zoom yok', () => {
  const style = compactGridStyle();
  assert.equal(style.gridTemplateColumns, 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))');
  assert.ok(!('zoom' in style));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/viewmode.test.js`
Expected: FAIL, the import of `CARDS_OPEN_KEY` / `loadCardsOpen` is not exported (SyntaxError: does not provide an export named ...).

- [ ] **Step 3: Write minimal implementation**

Append to `src/viewmode.js`:

```js
export const CARDS_OPEN_KEY = 'wqd:cards-open';

export function loadCardsOpen(storage) {
  try {
    return storage?.getItem(CARDS_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveCardsOpen(storage, open) {
  try {
    storage?.setItem(CARDS_OPEN_KEY, open ? 'true' : 'false');
  } catch {
    // storage blocked: keep the choice in memory only
  }
}

export function compactGridStyle() {
  return { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' };
}
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all tests pass (142 before plus 5 + 4 + 2 new = 153).

- [ ] **Step 5: Commit**

```bash
git add src/viewmode.js src/viewmode.test.js
git commit -m "feat: persist the global card open state and add compact grid style

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Add SortableJS and expose the new modules

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `index.html` (module script, around lines 143-195)

- [ ] **Step 1: Install the pinned dependency**

Run: `npm install --save-exact sortablejs@1.15.7`
Expected: `package.json` gains `"sortablejs": "1.15.7"` under `dependencies`; `package-lock.json` updated.

- [ ] **Step 2: Import and expose in the module script**

In `index.html`, in the `<script type="module">` block:

After the line `import Alpine from 'alpinejs';` add:

```js
      import Sortable from 'sortablejs';
```

After the line `import * as matrix from '/src/matrix.js';` add:

```js
      import * as reorder from '/src/reorder.js';
      import * as cardsummary from '/src/cardsummary.js';
```

After the line `window.__MATRIX__ = matrix;` add:

```js
      window.__REORDER__ = reorder;
      window.__CARDSUM__ = cardsummary;
      window.Sortable = Sortable;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds with no errors; `dist/assets/*.js` exists. If the build fails on the new imports, fix the path (`/src/...` with a leading slash like the other imports).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json index.html
git commit -m "chore: bundle SortableJS and expose reorder and card summary modules

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Alpine state, methods and i18n

**Files:**
- Modify: `index.html` (state around line 812, `init()` around line 846, methods near `gridStyle()` around line 945, i18n near `densitySmall` lines 307 and 563)

- [ ] **Step 1: Add state**

Next to `density: 'large',` (state object, around line 813) add:

```js
          cardsOpen: false,
          openCards: {},
```

- [ ] **Step 2: Load the saved global state in `init()`**

After `this.density = window.__VIEW__.loadDensity(window.localStorage);` add:

```js
            this.cardsOpen = window.__VIEW__.loadCardsOpen(window.localStorage);
```

- [ ] **Step 3: Replace `gridStyle()` and add the card methods**

Replace the existing method

```js
          gridStyle() {
            return window.__VIEW__.gridStyle(this.venues.length, this.density);
          },
```

with:

```js
          gridStyle() {
            if (this.allCollapsed()) return window.__VIEW__.compactGridStyle();
            return window.__VIEW__.gridStyle(this.venues.length, this.density);
          },

          isCardOpen(venue) {
            if (this.venues.length < 2) return true;
            return this.openCards[venue.id] ?? this.cardsOpen;
          },

          allCollapsed() {
            return this.venues.length >= 2 && !this.venues.some((venue) => this.isCardOpen(venue));
          },

          canReorder() {
            return this.viewMode === 'cards' && this.allCollapsed();
          },

          toggleCard(venue) {
            this.openCards = { ...this.openCards, [venue.id]: !this.isCardOpen(venue) };
          },

          toggleAllCards() {
            this.cardsOpen = !this.cardsOpen;
            this.openCards = {};
            window.__VIEW__.saveCardsOpen(window.localStorage, this.cardsOpen);
          },

          cardSummaryOf(venue) {
            return window.__CARDSUM__.cardSummary(venue, this.guestCount);
          },

          reorderVenue(from, to) {
            this.venues = window.__REORDER__.moveIndex(this.venues, from, to);
          },

          initSortable(el) {
            if (!window.Sortable) return;
            const sortable = window.Sortable.create(el, {
              draggable: 'article',
              handle: '[data-drag-handle]',
              animation: 150,
              forceFallback: true,
              disabled: !this.canReorder(),
              onEnd: (evt) => {
                const { item, from, oldDraggableIndex, newDraggableIndex } = evt;
                from.removeChild(item);
                const articles = [...from.children].filter((node) => node.tagName === 'ARTICLE');
                from.insertBefore(item, articles[oldDraggableIndex] || null);
                this.reorderVenue(oldDraggableIndex, newDraggableIndex);
              },
            });
            this.$watch(
              () => this.canReorder(),
              (enabled) => sortable.option('disabled', !enabled)
            );
          },
```

Why `onEnd` reverts the DOM first: SortableJS has already moved the node; Alpine's keyed `x-for` expects to own DOM order, so we put the node back and let Alpine re-render from the new array.

- [ ] **Step 4: Add i18n keys (TR)**

After the TR line `densitySmall: 'Küçük',` add:

```js
          cardsExpandAll: 'Detayları aç',
          cardsCollapseAll: 'Detayları kapat',
          cardExpand: 'Detayı aç',
          cardCollapse: 'Kartı kapat',
          dragHandleLabel: 'Sıralamak için sürükle',
          includedCountLabel: 'özellik dahil',
```

- [ ] **Step 5: Add i18n keys (EN)**

After the EN line `densitySmall: 'Small',` add:

```js
          cardsExpandAll: 'Expand details',
          cardsCollapseAll: 'Collapse details',
          cardExpand: 'Expand details',
          cardCollapse: 'Collapse card',
          dragHandleLabel: 'Drag to reorder',
          includedCountLabel: 'included',
```

- [ ] **Step 6: Syntax-check the inline scripts**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; const s = fs.readFileSync('index.html','utf8'); let n = 0; for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) { new Function(m[1]); n++; } console.log('inline scripts ok:', n)"
```

Expected: `inline scripts ok: 1` (or more), no SyntaxError. Remember: no raw apostrophes inside single-quoted TR strings (use the typographic apostrophe).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add card open/close state, reorder method and strings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Markup (toolbar button, compact card, collapse arrow, grid)

**Files:**
- Modify: `index.html` (toolbar around line 2943, grid around line 2967, card around line 2980 and the cover controls around line 3051)

All edits are unique-anchor replacements; do them in order.

- [ ] **Step 1: Add the global button and hide density while everything is closed**

In the toolbar, find the density group opening tag:

```html
              <div
                x-show="venues.length >= 2 && viewMode === 'cards'"
                class="inline-flex items-center rounded-full border border-champagne-line bg-white/80 p-1"
                role="group"
                :aria-label="t('densityLabel')"
              >
```

Replace it with the button plus the changed group (note the extra `&& !allCollapsed()`):

```html
              <button
                type="button"
                x-show="venues.length >= 2 && viewMode === 'cards'"
                @click="toggleAllCards()"
                :aria-pressed="cardsOpen"
                class="rounded-full border border-champagne-line bg-white/80 px-3.5 py-2 text-xs font-semibold text-obsidian transition-colors hover:border-champagne whitespace-nowrap"
                x-text="cardsOpen ? t('cardsCollapseAll') : t('cardsExpandAll')"
              ></button>
              <div
                x-show="venues.length >= 2 && viewMode === 'cards' && !allCollapsed()"
                class="inline-flex items-center rounded-full border border-champagne-line bg-white/80 p-1"
                role="group"
                :aria-label="t('densityLabel')"
              >
```

- [ ] **Step 2: Make the grid gap and Sortable hook state-aware**

Replace

```html
          <div
            x-show="!showTable()"
            class="mt-8 grid grid-cols-1 gap-7 items-start"
            :class="venues.length < 2 ? 'max-w-2xl' : ''"
            :style="gridStyle()"
          >
```

with:

```html
          <div
            x-show="!showTable()"
            x-init="initSortable($el)"
            class="mt-8 grid grid-cols-1 items-start"
            :class="[venues.length < 2 ? 'max-w-2xl' : '', allCollapsed() ? 'gap-4' : 'gap-7']"
            :style="gridStyle()"
          >
```

- [ ] **Step 3: Insert the compact block and wrap the existing card body**

Find (unique):

```html
                <div>
                  <!-- Atmospheric Visual Cover Banner (1. Verified Real Photo -> 2. Uploaded Quote Image -> 3. Curated Luxury Cover) -->
```

Replace with:

```html
                <!-- Compact summary: shown while the card is closed -->
                <div x-show="!isCardOpen(venue)" x-cloak>
                  <div class="relative h-20 w-full overflow-hidden bg-gradient-to-br from-[#F9F3F0] via-[#EFE6E0] to-[#E5D7CC]">
                    <img
                      x-show="!venue.coverError && getVenueCoverUrl(venue)"
                      :src="getVenueCoverUrl(venue)"
                      :alt="displayVenueName(venue)"
                      referrerPolicy="no-referrer"
                      @error="handleCoverImgError(venue)"
                      class="h-full w-full"
                      :class="getActiveCoverKind(venue) === 'quote' ? 'object-contain bg-obsidian' : 'object-cover'"
                    />
                    <button
                      type="button"
                      data-drag-handle
                      x-show="canReorder()"
                      :title="t('dragHandleLabel')"
                      :aria-label="t('dragHandleLabel')"
                      class="absolute left-2.5 top-2.5 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full border border-white/25 bg-obsidian/65 text-pearl backdrop-blur-md active:cursor-grabbing"
                    >
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
                        <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
                        <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    @click="toggleCard(venue)"
                    :aria-expanded="isCardOpen(venue)"
                    :title="t('cardExpand')"
                    :aria-label="t('cardExpand') + ': ' + displayVenueName(venue)"
                    class="block w-full px-4 pb-4 pt-3 text-left"
                  >
                    <span class="flex items-start justify-between gap-2">
                      <span class="block min-w-0 line-clamp-2 font-serif text-lg font-semibold leading-tight text-obsidian" x-text="displayVenueName(venue)"></span>
                      <svg class="mt-1 h-4 w-4 shrink-0 text-stone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                    </span>
                    <span class="mt-2 block font-serif text-2xl font-semibold tabular-nums text-obsidian">
                      <span x-show="cardSummaryOf(venue).totalEur > 0" x-text="formatCurrency(cardSummaryOf(venue).totalEur)"></span>
                      <span x-show="!(cardSummaryOf(venue).totalEur > 0)" class="font-sans text-base font-normal text-stone/50">—</span>
                    </span>
                    <span
                      x-show="cardSummaryOf(venue).totalEur > 0"
                      class="block text-[11px] tabular-nums text-stone"
                      x-text="`${formatCurrency(cardSummaryOf(venue).perGuestEur)} / ${t('perGuestShort')}`"
                    ></span>
                    <span class="mt-3 flex flex-wrap items-center gap-1.5">
                      <span
                        x-show="isBestValue(venue)"
                        class="rounded-full border border-champagne/60 bg-emeraldSafe-bg/95 px-2.5 py-0.5 text-[11px] font-semibold text-emeraldSafe whitespace-nowrap"
                        x-text="t('bestValueBadgeShort')"
                      ></span>
                      <span
                        x-show="!isBestValue(venue) && getDeltaFromLowest(venue) > 0"
                        class="rounded-full border border-champagne-line bg-pearl px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-stone whitespace-nowrap"
                        x-text="`+${formatCurrency(getDeltaFromLowest(venue))}`"
                      ></span>
                      <span
                        x-show="cardSummaryOf(venue).included > 0"
                        class="rounded-full border border-champagne-line bg-white px-2.5 py-0.5 text-[11px] font-medium text-obsidian whitespace-nowrap"
                        x-text="`${cardSummaryOf(venue).included} ${t('includedCountLabel')}`"
                      ></span>
                      <span
                        x-show="cardSummaryOf(venue).gaps > 0"
                        class="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900 whitespace-nowrap"
                        x-text="`${cardSummaryOf(venue).gaps} ${t('gapWord')}`"
                      ></span>
                    </span>
                  </button>
                </div>

                <div x-show="isCardOpen(venue)">
                  <!-- Atmospheric Visual Cover Banner (1. Verified Real Photo -> 2. Uploaded Quote Image -> 3. Curated Luxury Cover) -->
```

The wrapper `<div x-show="isCardOpen(venue)">` replaces the old bare `<div>`; its closing `</div>` is the existing one at 16 spaces of indentation right before `</article>` (the `</article>` line is at 14 spaces). No other closing tag changes.

- [ ] **Step 4: Add the collapse arrow to the open card's cover controls**

Find (unique, the remove button start in the cover controls):

```html
                      <button
                        type="button"
                        @click="removeVenue(venue.id)"
```

Replace with:

```html
                      <button
                        type="button"
                        x-show="venues.length >= 2"
                        @click="toggleCard(venue)"
                        :title="t('cardCollapse')"
                        :aria-label="t('cardCollapse')"
                        class="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-obsidian/65 text-pearl/90 backdrop-blur-md transition-colors hover:bg-obsidian"
                      >
                        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
                      </button>

                      <button
                        type="button"
                        @click="removeVenue(venue.id)"
```

- [ ] **Step 5: Syntax check and build**

Run the inline-script check from Task 5 Step 6, then `npm test` and `npm run build`.
Expected: `inline scripts ok`, all tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: compact venue cards with expand toggle and drag handle

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verify in the browser (desktop, then phone)

**Files:** none (fix anything found in `index.html`, then re-run this task)

- [ ] **Step 1: Build and serve**

Run in the background: `npm run build && npx vite preview --port 4191`
Open `http://localhost:4191/?v=7` with the built-in browser (`mcp__Claude_Browser__navigate`). Never use `mcp__claude-in-chrome__*`.

- [ ] **Step 2: Load demo data**

In the page, run through `mcp__Claude_Browser__javascript_tool`: `new Function(localStorage.getItem('demo-src'))()` (the demo helper from earlier sessions; if `demo-src` is missing, add 5 venues by hand-editing `localStorage['wqd:v1']` from a quote screenshot flow, no API key needed). Reload. Switch to the Cards view. Note: pane can report stale layout while hidden, so take screenshots to force frames.

- [ ] **Step 3: Desktop checks at 1200 px (`resize_window` 1200x800)**

Check and record each:
1. With `wqd:cards-open` unset, every card is a compact card: slim photo, name, total, per-guest line, "N özellik dahil" chip where flags exist, amber "N eksik" chip where gaps exist, "En düşük" on the cheapest.
2. 5 venues fit in one row at roughly 230 px each; no page-level horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`).
3. The density buttons are hidden while all cards are closed.
4. Click one card: it becomes today's full card, grid switches to the wide grid, density buttons appear, drag handles disappear, other cards stay compact.
5. Click the collapse arrow in the open card cover: it closes; when none are open the grid returns to the compact grid and handles reappear.
6. The toolbar button toggles label "Detayları aç" / "Detayları kapat"; opening all shows full cards, closing all returns to compact; reload keeps the global choice (`localStorage['wqd:cards-open']`).
7. Single venue (remove all but one): no button, no arrow, card always open.
8. Table view unaffected; table column order matches the card order.

- [ ] **Step 4: Drag-and-drop checks**

With all cards closed, drag the third card's grip handle onto the first position (use `computer` `left_click_drag`, or if the fallback drag needs stepped moves, several `left_mouse_down`-style moves via `left_click_drag` with intermediate hovers).
Expected:
1. Order changes in the grid immediately; no duplicated or ghost card remains.
2. `JSON.parse(localStorage['wqd:v1']).venues.map(v => v.name)` shows the new order after about 300 ms.
3. After reload the order is the same; switching to Table shows columns in the same order.
4. Dragging from anywhere other than the grip does not start a drag; clicking the card still expands it.
5. `read_console_messages` shows no errors.
6. Add a card by pasting text, or delete one, right after a drag: the right cards are affected.

If the revert-then-reorder in `initSortable` leaves a stray DOM node or reorders wrongly, fix `onEnd` (the likely culprit is the `articles[oldDraggableIndex]` insertion reference) and re-run this step before moving on.

- [ ] **Step 5: Phone check at 375 px (`resize_window` preset `mobile`, then reload)**

1. Compact cards show two per row if `230px` fits twice (it will not at 375, so one per row) with no horizontal page scroll.
2. Toolbar buttons wrap cleanly; the global button is reachable.
3. The grip handle is tappable and `touch-none` prevents page scroll while dragging it; touch drag via `touch_path` (or `touch2_path` not needed) reorders.
4. The sticky dock (`--dock-h`) does not cover the last card; open a card and confirm its full content scrolls normally.
5. Also verify the earlier unverified redesign pieces on this width: comparison matrix frame, sticky header, the overflow menu.

Reset the viewport afterwards: `resize_window` preset `desktop`. Stop the preview server.

- [ ] **Step 6: Final checks and commit fixes**

Run: `npm test` and `npm run build`
Expected: all green. If Step 3-5 required fixes, commit them:

```bash
git add -A
git commit -m "fix: address issues found while verifying compact cards

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Skip the commit if nothing changed.

---

### Task 8: Ship (only after the user says go)

**Files:** none

- [ ] **Step 1: Confirm with the user**

Report the verification results (what passed, what could not be checked) and ask whether to push, open the PR and merge. Do not push before that.

- [ ] **Step 2: Push, PR, merge**

```bash
git push -u origin feat/comparison-redesign
gh pr create --base main --title "feat: comparison matrix redesign and compact cards with reorder" --body "<what changed, how it was verified, what was not>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

After opening the PR, call `mcp__ccd_pr__get_status` and, if it does not report that PR, `mcp__ccd_pr__bind_pr`. Merge when the user confirms and CI is green, then wait for the GitHub Pages workflow and open the live site in the built-in browser to confirm the cards, button and drag work there.

---

## Self-review

**Spec coverage:** compact summary content (Task 2 numbers, Task 6 markup) ok; open card same as today plus collapse arrow (Task 6 Steps 3-4) ok; global button and per-card override and persistence (Tasks 3, 5, 6) ok; density hidden while all closed (Task 6 Step 1) ok; drag only when all closed, handle only, order in `venues`, persisted by the existing `serializeState` watcher, table follows (Tasks 1, 5, 6, 7) ok; Sortable absent fallback (`if (!window.Sortable) return`) ok; storage-blocked behaviour (Task 3) ok; tests listed in the spec ok; two-section layout intentionally replaced (Task 0, decision 1).

**Placeholders:** none; every code step has code. The PR body in Task 8 is filled in at the time from real results.

**Type consistency:** `moveIndex(list, from, to)` used by `reorderVenue(from, to)`; `cardSummary` returns `{ totalEur, perGuestEur, included, gaps }`, used in markup as `cardSummaryOf(venue).totalEur/perGuestEur/included/gaps`; `loadCardsOpen/saveCardsOpen/compactGridStyle/CARDS_OPEN_KEY` names match in tests, module and `index.html`; i18n keys defined in Task 5 (`cardsExpandAll`, `cardsCollapseAll`, `cardExpand`, `cardCollapse`, `dragHandleLabel`, `includedCountLabel`) are the ones used in Task 6; existing keys reused: `gapWord`, `bestValueBadgeShort`, `perGuestShort`.
