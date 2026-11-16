# Lowest-Total Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An incomplete quote (rent, food or a priced extra missing) can never earn the "lowest" badge or serve as the baseline for the "+X difference" figures, and its total is labelled "from".

**Architecture:** One new pure module `src/lowest.js` computes, per venue, `{ total, complete, best, deltaEur }` from `calculateBreakdown` and `completeness`. `table.js` and the Alpine app read it instead of the old `calc.js` helpers, which are deleted. The UI adds a small "from" label on incomplete totals and one hint line when no venue can be named lowest.

**Tech Stack:** ES modules, `node --test`, Alpine.js 3.14.8, Vite 8, Tailwind CDN.

**Spec:** `docs/superpowers/specs/2026-11-16-lowest-total-logic-design.md`

**Working directory:** `/Users/caner/Developer/Wedding-Quote-Decoder`, branch `feat/lowest-logic` (cut from `main` after PR #17).

**Conventions:** TDD for every `src/` change. Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No emoji in code or UI strings. No code comments unless the reason is non-obvious. No raw apostrophes in single-quoted i18n strings (use the typographic one). Never put an API key in the repo.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lowest.js` (new) | `lowestStanding(venues, guestCount)` -> `[{ id, total, complete, best, deltaEur }]` |
| `src/lowest.test.js` (new) | tests for the rule table in the spec |
| `src/table.js` (modify) | columns get `best`, `deltaEur`, `complete` from `lowestStanding` |
| `src/table.test.js` (modify) | update the old best/delta test (its venues have no food price, so they are now incomplete) and add new cases |
| `src/calc.js` (modify) | delete `getLowestTotalEur`, `getDeltaFromLowest`, `isBestValue`, `pricedTotals` |
| `src/calc.test.js` (modify) | delete the tests of the removed functions |
| `index.html` (modify) | expose `__LOWEST__`, new wrappers, "from" label (3 places), hint line, i18n |
| `docs/superpowers/specs/2026-11-16-lowest-total-logic-design.md` (modify) | drop the "cached per render" claim |

## Decisions made while planning

1. **No caching.** Alpine getters are not memoised, and with at most a few dozen venues recomputing per binding is cheap, so the spec's "computed once per render" claim is dropped (Task 0).
2. **Existing test breaks on purpose.** `table.test.js` "en avantajli ve fark: bos kart sayilmaz" builds venues with food price 0, which now counts as incomplete. It is rewritten with food prices, not loosened.
3. **"From" label as a separate small element** next to the number, not inside the number text, so narrow cards and the 120px phone columns do not overflow.

---

### Task 0: Spec touch-up

**Files:**
- Modify: `docs/superpowers/specs/2026-11-16-lowest-total-logic-design.md`

- [ ] **Step 1: Replace the caching sentence**

In the `## Kod` section, replace

```
`lowestStanding` sonucuna bakar. Hesaplama render başına bir kez yapılır (getter ile
  önbelleğe alınır), mekan başına tekrar edilmez. `getLowestTotalEur` sarmalayıcısı
  kullanılmıyorsa silinir.
```

with

```
`lowestStanding` sonucuna bakar. Sonuç önbelleğe alınmaz (Alpine getter'ları zaten
  önbelleklenmez, mekan sayısı küçüktür). `getLowestTotalEur` sarmalayıcısı silinir.
```

(Match the exact existing line breaks; if the text differs slightly, replace the sentence about caching with the new one.)

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-16-lowest-total-logic-design.md
git commit -m "docs: drop the per-render caching claim from the lowest-total spec

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: `lowestStanding`

**Files:**
- Create: `src/lowest.test.js`
- Create: `src/lowest.js`

- [ ] **Step 1: Write the failing test**

`src/lowest.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lowestStanding } from './lowest.js';

const GUESTS = 100;
const venue = (id, base, fb, flags = []) => ({ id, baseFeeEur: base, fbPerPersonEur: fb, flags });
const needsPriceFlag = { type: 'risk', active: true, calcType: 'fixed', amount: 0 };

const complete = (id, total) => venue(id, total - 5000, 50);
const incomplete = (id, total) => venue(id, total, 0);

const standing = (venues) => lowestStanding(venues, GUESTS);
const bests = (venues) => standing(venues).map((s) => s.best);
const deltas = (venues) => standing(venues).map((s) => s.deltaEur);

test('eksikli ucuz rakip rozeti engeller', () => {
  const vs = [complete('A', 5500), incomplete('B', 2000)];
  assert.deepEqual(bests(vs), [false, false]);
  assert.deepEqual(deltas(vs), [0, 0]);
});

test('eksikli rakibin alt siniri daha yuksekse eksiksiz mekan en dusuk olur', () => {
  const vs = [complete('A', 5500), incomplete('B', 6000)];
  assert.deepEqual(bests(vs), [true, false]);
});

test('iki eksiksiz mekan: en dusuk rozet alir, digeri fark gorur', () => {
  const vs = [complete('A', 5500), complete('B', 6500)];
  assert.deepEqual(bests(vs), [true, false]);
  assert.deepEqual(deltas(vs), [0, 1000]);
});

test('hepsi eksikliyse rozet ve fark yok', () => {
  const vs = [incomplete('A', 2000), incomplete('B', 3000)];
  assert.deepEqual(bests(vs), [false, false]);
  assert.deepEqual(deltas(vs), [0, 0]);
});

test('tek fiyatli mekan varsa rozet yok', () => {
  const vs = [complete('A', 5500), venue('B', 0, 0)];
  assert.deepEqual(bests(vs), [false, false]);
});

test('esitlik: iki eksiksiz mekan da en dusuk', () => {
  const vs = [complete('A', 5500), complete('B', 5500)];
  assert.deepEqual(bests(vs), [true, true]);
  assert.deepEqual(deltas(vs), [0, 0]);
});

test('toplami 0 olan mekan rozet almaz ve digerlerini etkilemez', () => {
  const vs = [complete('A', 5500), venue('B', 0, 0), complete('C', 6500)];
  assert.deepEqual(bests(vs), [true, false, false]);
  assert.deepEqual(deltas(vs), [0, 0, 1000]);
  assert.equal(standing(vs)[1].total, 0);
});

test('fark tabani eksiksiz mekanlar arasindaki en dusuk toplamdir', () => {
  const vs = [incomplete('A', 1000), complete('B', 5500), complete('C', 6000)];
  assert.deepEqual(deltas(vs), [0, 0, 500]);
});

test('eksik sayilan haller: kira, yemek ve fiyati bekleyen kalem', () => {
  const noRent = venue('R', 0, 50);
  const noFood = venue('F', 1000, 0);
  const pending = venue('P', 1000, 50, [needsPriceFlag]);
  const ok = venue('OK', 1000, 50);
  assert.deepEqual(standing([noRent, noFood, pending, ok]).map((s) => s.complete), [false, false, false, true]);
});

test('girdi sirasi korunur, bos dizi ve tek mekan hata vermez', () => {
  const vs = [complete('B', 6500), complete('A', 5500)];
  assert.deepEqual(standing(vs).map((s) => s.id), ['B', 'A']);
  assert.deepEqual(standing([]), []);
  assert.deepEqual(bests([complete('A', 5500)]), [false]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lowest.test.js`
Expected: FAIL, `Cannot find module './lowest.js'` (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Write minimal implementation**

`src/lowest.js`:

```js
import { calculateBreakdown } from './calc.js';
import { completeness } from './completeness.js';

const isComplete = (c) => !c.rentMissing && !c.foodMissing && c.needsPriceCount === 0;

export function lowestStanding(venues, guestCount) {
  const rows = venues.map((venue) => ({
    id: venue.id,
    total: calculateBreakdown(venue, guestCount).turnkeyTotalEur,
    complete: isComplete(completeness(venue)),
  }));
  const priced = rows.filter((r) => r.total > 0);
  const completePriced = priced.filter((r) => r.complete);
  const floor = priced.length >= 2 ? Math.round(Math.min(...priced.map((r) => r.total))) : null;
  const baseline = completePriced.length ? Math.min(...completePriced.map((r) => r.total)) : null;

  return rows.map((r) => {
    const counts = r.total > 0 && r.complete;
    return {
      ...r,
      best: counts && floor !== null && Math.round(r.total) === floor,
      deltaEur: counts && baseline !== null ? r.total - baseline : 0,
    };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/lowest.test.js`
Expected: PASS, 10 tests. Hand-check one case if a number is off: `complete('A', 5500)` is base 500 + food 50 x 100 = 5500; `incomplete('B', 2000)` is base 2000, food 0 (foodMissing).

- [ ] **Step 5: Commit**

```bash
git add src/lowest.js src/lowest.test.js
git commit -m "feat: add lowestStanding that ignores incomplete quotes

An incomplete quote's total is only a lower bound, so it cannot be the
confirmed lowest nor the baseline for the difference figures.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Use it in `table.js` and remove the old helpers

**Files:**
- Modify: `src/table.test.js` (the test at "en avantajli ve fark")
- Modify: `src/table.js`
- Modify: `src/calc.test.js`
- Modify: `src/calc.js`

- [ ] **Step 1: Rewrite the old table test and add a new one (failing)**

In `src/table.test.js` replace

```js
test('en avantajli ve fark: bos kart sayilmaz', () => {
  const { columns } = build([venue('A', 5000, 0), venue('B', 0, 0), venue('C', 6000, 0)]);
  assert.deepEqual(columns.map((c) => c.best), [true, false, false]);
  assert.deepEqual(columns.map((c) => c.deltaEur), [0, 0, 1000]);
  assert.equal(columns[1].hasPrice, false);
});
```

with

```js
test('en dusuk ve fark: bos kart sayilmaz, eksiksiz mekanlar karsilastirilir', () => {
  const { columns } = build([venue('A', 500, 50), venue('B', 0, 0), venue('C', 1500, 50)]);
  assert.deepEqual(columns.map((c) => c.best), [true, false, false]);
  assert.deepEqual(columns.map((c) => c.deltaEur), [0, 0, 1000]);
  assert.deepEqual(columns.map((c) => c.complete), [true, false, true]);
  assert.equal(columns[1].hasPrice, false);
});

test('eksikli ucuz mekan en dusuk rozetini engeller', () => {
  const { columns } = build([venue('A', 500, 50), venue('B', 2000, 0)]);
  assert.deepEqual(columns.map((c) => c.best), [false, false]);
  assert.deepEqual(columns.map((c) => c.deltaEur), [0, 0]);
  assert.deepEqual(columns.map((c) => c.complete), [true, false]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/table.test.js`
Expected: FAIL, `columns.map(c => c.complete)` is `[undefined, undefined, undefined]` and `best` is wrong for the second test.

- [ ] **Step 3: Switch `table.js` to `lowestStanding`**

In `src/table.js` change the import line

```js
import { calculateBreakdown, getDeltaFromLowest, getFlagAmountEur, isBestValue } from './calc.js';
import { completeness, needsPrice } from './completeness.js';
```

to

```js
import { calculateBreakdown, getFlagAmountEur } from './calc.js';
import { completeness, needsPrice } from './completeness.js';
import { lowestStanding } from './lowest.js';
```

Replace the start of `buildComparison` and the two fields:

```js
export function buildComparison({ venues, guestCount, categories, categoryOf }) {
  const standing = lowestStanding(venues, guestCount);
  const columns = venues.map((venue, i) => {
    const b = calculateBreakdown(venue, guestCount);
    const gaps = completeness(venue);
    return {
      id: venue.id,
      venue,
      rentEur: Number(venue.baseFeeEur) || 0,
      foodEur: b.fbSubtotalEur,
      turnkeyEur: b.turnkeyTotalEur,
      perGuestEur: b.effectivePerGuestEur,
      deltaEur: standing[i].deltaEur,
      best: standing[i].best,
      complete: standing[i].complete,
      hasPrice: b.turnkeyTotalEur > 0,
```

(the rest of the returned object is unchanged).

- [ ] **Step 4: Run table tests**

Run: `node --test src/table.test.js`
Expected: PASS.

- [ ] **Step 5: Remove the old helpers and their tests**

In `src/calc.test.js` change the import block to

```js
import {
  calculateBreakdown,
  getFlagAmountEur,
} from './calc.js';
```

and delete these four tests entirely: `H3: toplami 0 olan kart en avantajli sayilmaz ve en dusuk toplami bozmaz`, `H3: fiyatli tek kart varsa kimse en avantajli degil`, `hic kart yokken en dusuk toplam 0` (they are the last three tests in the file; their behaviour is now covered by `lowest.test.js`).

In `src/calc.js` delete everything from `const pricedTotals = ...` to the end of the file (`pricedTotals`, `getLowestTotalEur`, `getDeltaFromLowest`, `isBestValue`). `calculateBreakdown` and `getFlagAmountEur` stay.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: all pass. If `matrix.test.js` or another test fails because its venues have no food price and it asserts column `best`, give those venues a food price (do not loosen the assertion). Row-level `best` assertions in `matrix.test.js` (lowest per row) are unaffected.

- [ ] **Step 7: Commit**

```bash
git add src/table.js src/table.test.js src/calc.js src/calc.test.js
git commit -m "refactor: drive table best/delta from lowestStanding and drop old helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Alpine wrappers, strings, "from" label and hint

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Expose the module**

In the `<script type="module">` block add after `import * as cardsummary from '/src/cardsummary.js';`:

```js
      import * as lowest from '/src/lowest.js';
```

and after `window.__CARDSUM__ = cardsummary;`:

```js
      window.__LOWEST__ = lowest;
```

- [ ] **Step 2: Replace the three wrappers**

Replace

```js
          getLowestTotalEur() {
            return window.__CALC__.getLowestTotalEur(this.venues, this.guestCount);
          },

          getDeltaFromLowest(venue) {
            return window.__CALC__.getDeltaFromLowest(venue, this.venues, this.guestCount);
          },

          isBestValue(venue) {
            return window.__CALC__.isBestValue(venue, this.venues, this.guestCount);
          },
```

with

```js
          standings() {
            return window.__LOWEST__.lowestStanding(this.venues, this.guestCount);
          },

          standingOf(venue) {
            return this.standings().find((s) => s.id === venue.id) || { total: 0, complete: false, best: false, deltaEur: 0 };
          },

          getDeltaFromLowest(venue) {
            return this.standingOf(venue).deltaEur;
          },

          isBestValue(venue) {
            return this.standingOf(venue).best;
          },

          isEstimate(venue) {
            const s = this.standingOf(venue);
            return s.total > 0 && !s.complete;
          },

          lowestUnknownCount() {
            const priced = this.standings().filter((s) => s.total > 0);
            if (priced.length < 2 || priced.some((s) => s.best)) return 0;
            return priced.filter((s) => !s.complete).length;
          },
```

- [ ] **Step 3: i18n keys**

After the TR line `bestValueBadgeShort: 'En düşük',` add:

```js
          fromPrefix: 'en az',
          lowestUnknownPrefix: 'En düşük belirlenemiyor:',
          lowestUnknownTail: 'mekanın fiyatı eksik',
```

After the EN line `bestValueBadgeShort: 'Lowest',` add:

```js
          fromPrefix: 'from',
          lowestUnknownPrefix: 'Lowest cannot be determined:',
          lowestUnknownTail: 'venues have missing prices',
```

- [ ] **Step 4: "From" label on the compact card**

Find (unique):

```html
                      <span x-show="cardSummaryOf(venue).totalEur > 0" x-text="formatCurrency(cardSummaryOf(venue).totalEur)"></span>
```

Replace with:

```html
                      <span x-show="isEstimate(venue)" class="mr-1 font-sans text-[11px] font-normal text-stone" x-text="t('fromPrefix')"></span>
                      <span x-show="cardSummaryOf(venue).totalEur > 0" x-text="formatCurrency(cardSummaryOf(venue).totalEur)"></span>
```

- [ ] **Step 5: "From" label on the open card total**

Find (unique):

```html
                        <span
                          class="font-serif text-[2.25rem] leading-none font-semibold tracking-tight text-obsidian tabular-nums sm:text-[2.5rem]"
                          x-text="formatCurrency(calculateBreakdown(venue).turnkeyTotalEur)"
                        ></span>
```

Replace with:

```html
                        <span class="flex items-baseline gap-2">
                          <span x-show="isEstimate(venue)" class="text-xs font-medium text-stone" x-text="t('fromPrefix')"></span>
                          <span
                            class="font-serif text-[2.25rem] leading-none font-semibold tracking-tight text-obsidian tabular-nums sm:text-[2.5rem]"
                            x-text="formatCurrency(calculateBreakdown(venue).turnkeyTotalEur)"
                          ></span>
                        </span>
```

- [ ] **Step 6: "From" label in the table header**

Find (unique start of the totals row in the matrix header):

```html
                        <div class="mt-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
```

Replace with:

```html
                        <div x-show="col.hasPrice && !col.complete" class="mt-2 text-[10px] font-medium uppercase tracking-wide text-stone" x-text="t('fromPrefix')"></div>
                        <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2" :class="col.hasPrice && !col.complete ? 'mt-0.5' : 'mt-2'">
```

- [ ] **Step 7: Hint line**

Find (unique):

```html
          <!-- Dynamic Venue Comparison Grid -->
```

Insert directly above it:

```html
          <p
            x-show="lowestUnknownCount() > 0"
            class="mt-3 text-xs text-amber-800"
            x-text="`${t('lowestUnknownPrefix')} ${lowestUnknownCount()} ${t('lowestUnknownTail')}`"
          ></p>

```

- [ ] **Step 8: Check and build**

Run:

```bash
node --input-type=module -e "import fs from 'node:fs'; const s = fs.readFileSync('index.html','utf8'); for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]); console.log('inline ok')"
npm test
npm run build
```

Expected: `inline ok`, all tests pass, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: label incomplete totals 'from' and explain when no lowest exists

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verify in the browser

**Files:** none (fix anything found in `index.html` or `src/`, then re-run this task)

- [ ] **Step 1: Build and serve**

Run in the background: `npm run build && npx vite preview --port 4191 --strictPort`
Open `http://localhost:4191/?v=20` with the built-in browser (`mcp__Claude_Browser__navigate`). Never use `mcp__claude-in-chrome__*`. The page's localStorage already holds the 10-venue demo state from earlier sessions; if it is empty, run `new Function(localStorage.getItem('demo-src'))()` or add blank cards. Do not read or print `wqd:gemini-key`.

- [ ] **Step 2: Demo data (almost everything incomplete)**

Reload, switch to Cards (1200x800). Expect:
1. No card has the "En düşük" badge unless a venue is complete and cheaper than every other total.
2. Incomplete cards show "en az" in front of the total.
3. The hint line "En düşük belirlenemiyor: N mekanın fiyatı eksik" shows above the grid, N = number of priced incomplete venues.
4. Table view: "en az" label above incomplete totals; the "En ucuza fark" row shows differences only for complete venues.

- [ ] **Step 3: Make the rule fire (via the page console)**

Run with `mcp__Claude_Browser__javascript_tool`:

```js
const a = Alpine.$data(document.body);
a.venues.forEach((v, i) => { v.baseFeeEur = 1000 + i * 500; v.fbPerPersonEur = 50; v.flags = []; });
await new Promise(r => setTimeout(r, 500));
({ best: a.venues.map(v => a.isBestValue(v)), delta: a.venues.map(v => Math.round(a.getDeltaFromLowest(v))), hint: a.lowestUnknownCount() })
```

Expected: only the first venue is `true`, deltas increase by 500 per venue, `hint` is 0, no "en az" labels, no hint line. Then make the cheapest incomplete:

```js
a.venues[0].fbPerPersonEur = 0;
await new Promise(r => setTimeout(r, 500));
({ best: a.venues.map(v => a.isBestValue(v)), hint: a.lowestUnknownCount(), estimate: a.isEstimate(a.venues[0]) })
```

Expected: all `false`, `hint` is 1, `estimate` is true, the hint line and the "en az" label appear on the first card. Screenshot to confirm (the pane can report stale layout while hidden, screenshots force a frame).

- [ ] **Step 4: Phone width and console**

`resize_window` preset `mobile`, reload: the "en az" label does not overflow the 120px table column or the compact card; the hint line wraps cleanly. `read_console_messages` with `onlyErrors: true` shows nothing new. Reset: `resize_window` preset `desktop`. Stop the preview server.

- [ ] **Step 5: Final checks and commit fixes**

Run: `npm test` and `npm run build`
Expected: green. Commit any fixes:

```bash
git add -A
git commit -m "fix: address issues found while verifying the lowest-total rule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Skip the commit if nothing changed.

---

### Task 5: Ship (only after the user says go)

**Files:** none

- [ ] **Step 1: Confirm with the user**

Report what was verified and what was not; ask whether to push, open the PR and merge. Do not push before that.

- [ ] **Step 2: Push, PR, merge, verify live**

```bash
git push -u origin feat/lowest-logic
gh pr create --base main --title "fix: do not call an incomplete quote the lowest" --body "<what changed, why, how verified, what was not>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then `mcp__ccd_pr__get_status` and `bind_pr` if unbound. After the user confirms the merge, watch the Pages run (`gh run watch`) and check the live site in the built-in browser.

---

## Self-review

**Spec coverage:** definitions and rules 1-4 (Task 1 code and tests; the five example rows map to tests 1-5 plus tie, zero-total, baseline, completeness-cases and order tests); `table.js` columns (Task 2); removal of old `calc.js` helpers and their test migration (Task 2); `index.html` wrappers, "from" label in compact card, open card and table header, hint line, i18n `fromPrefix` / `lowestUnknownPrefix` / `lowestUnknownTail` (Task 3; the spec's `lowestUnknownHint` single key became prefix + tail to fit the existing "N + tail" pattern, as `warnNeedsPriceTail` does); matrix "En ucuza fark" unchanged because it reads `deltaEur > 0` (verified in Task 4 Step 2); browser test plan (Task 4). The spec's caching claim is removed (Task 0).

**Placeholders:** none; the PR body in Task 5 is filled from real results at that time.

**Type consistency:** `lowestStanding` returns `{ id, total, complete, best, deltaEur }`; `table.js` reads `standing[i].deltaEur/best/complete`; `index.html` reads `standingOf(venue).best/deltaEur/total/complete`; column field `complete` is used by the table header (`col.complete`); i18n keys used in markup match those defined in Step 3.
