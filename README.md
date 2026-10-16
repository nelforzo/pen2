# pen2 — ひらがな れんしゅう

A hiragana writing-practice app for **young children**, with stroke-order guidance
and forgiving stroke validation. The child traces each character stroke by stroke;
when they finish, they choose what to do next.

The app runs entirely in the browser, works offline after first load, and requires
**no build step** and **no backend**.

---

## Quick Start

Serve the directory with any static file server (ES modules require HTTP, not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

That's it. No `npm install`, no bundler, no compilation.

### Regenerating stroke data (optional)

The bundled `js/data/hiragana.json` and `js/data/katakana.json` were generated
from KanjiVG and are checked in. To regenerate:

```bash
node scripts/extract-kanjivg.js            # kana + Latin alphabet
node scripts/extract-kanjivg.js hiragana   # only hiragana
node scripts/extract-kanjivg.js katakana   # only katakana
node scripts/extract-kanjivg.js alphabet   # only Latin A–Z / a–z
```

KanjiVG also ships stroke data for the Latin alphabet (both cases), so the
English deck is extracted the same way — no hand-authored letters.

The numbers deck (digits 0–9, plus composed 10–100) is hand-authored, since
KanjiVG has no digits:

```bash
node scripts/build-numbers.js
```

### Deployment

The live app is served by GitHub Pages from a **separate repo**
(`nelforzo.github.io`, in its `pen2/` subdirectory). Pushing this source repo
does **not** update the site. See [`DEPLOY.md`](./DEPLOY.md) for the full
checklist (sync the app files into the Pages repo, push both, and bump the
service-worker cache).

---

## Features

- **Four decks**: **ひらがな**, **カタカナ**, **えいご** (A–Z), and **すうじ**
  (numbers), with 46 kana per kana deck (no dakuten/handakuten or small kana).
- **Gojūon row grouping**: the ひらがな and カタカナ decks are split into
  **あ行**, **か行**, **さ行**, **た行**, **な行**, **は行**, **ま行**, **や行**,
  **ら行**, **わ行**, each with its own **▶** button to practise a single row.
- **English case toggle**: the えいご deck has **大文字**/**小文字** buttons that
  switch between uppercase A–Z and lowercase a–z; the choice is remembered.
- **Numbers 1–100**: the すうじ deck is grouped into sections (**1–10**,
  **11–20**, …, **91–100**) with a play button on each group. Every number is
  traceable: a multi-digit number is composed from its digits and practised
  stroke by stroke, left to right. Zero has no card of its own — it is practised
  inside 10, 20, … 100.
- **Hamburger menu** in the header to switch between decks (ひらがな, カタカナ,
  ABC, 123).
- **Stroke-by-stroke writing** with a shadow and numbered stroke order for guidance,
  and gentle "もう いちど" (try again) feedback on misses.
- **Dashboard actions**: a green **▶** button starts practice from the beginning;
  a red **↻** button resets the deck's saved progress.
- **Controls under each character**:
  - **?** — replay the stroke order (demo strokes drawn in a distinct colour).
  - **↻** — restart the current character.
  - **→** — advance, enabled once all strokes are registered, or immediately when
    the character already has a pass mark (contrasts with the top-left **←** back
    button, which returns to the character list).
- **Pass mark in practice**: the same ✓/★ shown on the character list appears at
  the top-right of the practice screen — on the back button's line — so children
  can see their star without leaving practice.
- **Focused practice**: tap any character on the dashboard to practise just that one;
  or start from the beginning and continue through the set.
- **Simple progress** (no scheduling): each character is marked practised (✓) or
  **かんぺき / perfect** (★) when written with no mistakes.
- **Star counter**: the header shows a running total of every ★ earned across all
  decks, so children can watch their collection grow.
- **Keeps progress until reset**: the saved ✓/★ marks (and the star counter)
  stay put day to day. A red **↻** button on each deck clears that deck's marks
  and its stars whenever the child is ready to start over.
- **All controls labelled in Japanese** for young learners.
- **Voice reading**: each character's name is read aloud when it appears and when
  the **?** stroke-order demo is played (Web Speech API).
- **Offline**: zero external runtime requests; everything is local.
- **Mobile-first**: responsive drawing canvas sized with `min(vw, vh)` so it always
  fits on screen; large ≥44 px touch targets; safe-area insets for notched devices;
  high-DPI canvas rendering; landscape phones get a side-by-side layout. Full
  Pointer Events support for stylus, touch, and mouse (with multi-touch/palm
  rejection while a stroke is in progress).

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `C` | Clear / restart the current character |
| `B` / `Esc` | Back to the character list |
| `N` / `→` | Next character (when finished) |
| `R` | Repeat (when finished) |

---

## Architecture & Design Decisions

### 1. No framework — vanilla JS + ES modules
**Suggested in the brief:** plain JS vs. Preact/Lit/Web Components.

**Decision: vanilla JS.** The DOM here is small and largely static; the real
complexity lives in Canvas/SVG rendering and stroke math, where a component
framework adds nothing. Vanilla keeps the codebase small, eliminates all
dependencies, and makes the app trivially offline-capable. A tiny view class
pattern (`Dashboard`, `StudyView`) with an explicit `destroy()` for
event-listener cleanup provides enough structure without abstraction overhead.

### 2. Stroke data — bundled JSON extracted from KanjiVG
**Suggested:** fetch raw KanjiVG SVGs from GitHub at runtime.

**Decision: one-time extraction into a local JSON bundle.**
`scripts/extract-kanjivg.js` parses each SVG's `kvg:StrokePaths_*` (the `d` paths)
and `kvg:StrokeNumbers_*` (number positions from transform matrices) into
`js/data/hiragana.json`:

```json
{ "char": "あ", "codepoint": "03042", "viewBox": "0 0 109 109",
  "paths": ["M31.01,33c…", "…"], "numbers": [{"n":1,"x":22.51,"y":35}, …] }
```

Runtime fetching was rejected because it breaks offline-first, adds CORS/network
fragility, and slows first paint. The whole hiragana bundle is ~60 KB.

### 3. No SRS — simple practice + progress (deliberate simplification)
**Originally:** an SM-2-inspired spaced-repetition scheduler.

**Decision: dropped the SRS.** The target audience is small children learning to
write hiragana, for whom scheduling pressure, due dates, and 4-way recall ratings
are inappropriate. Instead the app offers immediate, low-stakes repetition: the
child finishes a character and chooses **つぎへ** (next), **やりなおす** (restart), or
**?** (replay the stroke order). "Next" is enabled once every stroke is registered;
a clean run still earns a ★.

Progress is a tiny per-character record (`{ practiced, clean, attempts }`) in
`js/lib/progress.js`, persisted to `localStorage` behind an async wrapper
(`js/lib/storage.js`). A character shown with ✓ was practised; ★ means it was
written with no mistakes. There is no automatic reset: progress persists until a
grown-up or child presses the manual **↻** button on a deck, which clears that
deck's marks and removes its stars from the counter.

### 4. Stroke recognition — normalized point-cloud matcher (not full `$1`)
**Suggested:** hand-rolled Euclidean, or `$1`/`$P`/DTW.

**Decision: a direction-aware normalized point-cloud matcher
(`js/lib/stroke-matcher.js`).**

- Reference KanjiVG paths are sampled in-browser via `getPointAtLength()` (64 points).
- User strokes are resampled to the same count by arc length.
- Both are normalized to a unit scale via their bounding box.
- Similarity = `1 − meanEuclideanDistance × 2.5`.
- A **direction check** compares start→25% vectors; drawing a stroke backwards is
  penalized.

Full `$1` was rejected because it is intentionally **rotation-invariant** — wrong
for Japanese, where ー (horizontal) and 丨 (vertical) are different strokes. Using
only the first segment for direction (the naive approach) is too noisy for curvy
strokes like あ's third stroke; sampling at 25% of the stroke length fixed a real
bug where a *perfectly traced* あ stroke scored 0.60 (just below threshold).

Since the app now targets young children, a single forgiving threshold is used
(**0.50**, the former "trace" value), and a stroke only needs a minimum of
**2 captured points** (or **1** for a dot). Recognition is intentionally
lenient — the goal is encouragement, not strict grading.

**Dot strokes are matched by position, not shape.** Some characters end with a
dot — the dots on lowercase **i** and **j** today, and dakuten/handakuten marks
later. Tiny circles are very hard to draw accurately, even with a stylus, so a
reference stroke whose sampled bounding box is under **13 viewBox units** is
treated as a *dot*. For a dot, the app accepts *any* reasonably small mark — a
single tap, a tick, or a circle — whose centre falls within **24 units** of the
reference dot, ignoring shape and direction. The `y` descender (~15.6 units) is
deliberately kept above the threshold so it is still matched by shape. These
constants live at the top of `js/lib/stroke-matcher.js`
(`DOT_MAX_DIAGONAL`, `DOT_ACCEPT_RADIUS`, `DOT_MAX_USER_DIAGONAL`).

### 5. Rendering — SVG (reference) + Canvas (drawing) hybrid
**Suggested:** SVG vs. Canvas for the shadow.

**Decision: both, layered.**

```
Layer 2: <canvas id="draw-canvas">   user strokes (live + accepted)
Layer 1: <svg id="shadow-svg">       reference character, stroke numbers
Layer 0: <canvas id="grid-canvas">   田字格 grid (drawn once)
```

SVG gives crisp, scalable reference paths and lets us highlight the current stroke
and position numbers trivially. Canvas is far better for pointer capture and live
freehand drawing. Both share KanjiVG's `0 0 109 109` coordinate space, so alignment
is exact. Pointer Events unify mouse, touch, and stylus.

### 6. Progress tracking
Each deck's dashboard shows a grid of its characters. A ✓ marks a practised
character and a ★ marks one written with no mistakes. Progress is stored per deck
(separate localStorage keys), so resetting one deck leaves the others untouched.

---

## Known Caveats & Limitations

- **Stroke recognition on subtle strokes.** Point-cloud distance is weaker on
  pauses, hooks, and sweeps than on gross shape. Mitigations: direction checking,
  64-point resampling, and a deliberately lenient threshold. Not perfect — a
  "shaky but roughly right" stroke may pass, and an unusually stylized correct
  stroke may fail. No ML recognizer in Phase 1.
- **KanjiVG stroke splitting.** Some kana may be split into more strokes than is
  pedagogically standard. `js/data/overrides.json` exists as a hook for a
  per-character override map; the current hiragana set matches expected counts
  (あ = 3 strokes), so no overrides are active yet.
- **Deck contents.** Each deck shows the standard gojūon set (46 kana), A–Z
  (upper/lower via the case toggle), or numbers 0–100. The bundled kana data
  files still contain all 83 kana (dakuten/handakuten and small kana), so those
  can be surfaced later via `js/lib/sections.js`.
- **Number stroke data.** Digits 0–9 are hand-authored simple shapes (KanjiVG
  has no digits), not school-verified stroke data. Multi-digit numbers are
  generated by placing those digit shapes side by side, so their stroke order is
  the digits' own stroke order (left to right) and their proportions are
  approximate.
- **Accessibility.** Canvas drawing is inherently not screen-reader accessible. All
  non-canvas controls have ARIA labels, there is an `aria-live` status region for
  feedback, and full keyboard control of the practice actions. Zoom is intentionally
  disabled for young users, and safe-area insets are respected. A non-visual fallback
  (e.g. typed-answer mode) is out of scope for Phase 1.
- **Mobile.** Verified on 375–844 px viewports (portrait and landscape) and tablet:
  no horizontal overflow, the drawing area always fits in view, and stroke capture
  works with touch and mouse. Tested via headless Chromium device emulation; not
  yet tested on physical hardware or with a real stylus.
- **Arrows.** Stroke *numbers* are shown for order; directional arrows are not.
  Arrows can be added by computing end-tangents of each path.
- **localStorage** caps around 5 MB. Fine for hiragana/katakana; kanji will need
  the IndexedDB swap the storage layer is already designed for.

---

## Attribution & Licensing

- **Stroke data:** [KanjiVG](http://kanjivg.tagaini.net) by Ulrich Apel, licensed
  **CC BY-SA 3.0**. The derived `js/data/hiragana.json`, `js/data/katakana.json`,
  and `js/data/alphabet.json` are likewise distributed under CC BY-SA 3.0.
  Attribution appears in the app footer.
- **Number stroke data:** hand-authored digits (`js/data/numbers.json`); not
  derived from KanjiVG.
- **Application code:** original, no third-party runtime dependencies.

If you redistribute this project or data derived from it, you must retain the
KanjiVG attribution and share-alike terms for the data.

---

## Project Structure

```
index.html                  App shell
css/style.css               All styles
js/app.js                   Routing + view lifecycle
js/components/
  dashboard.js              Character grid + practice progress
  study-view.js             Drawing, validation, practice controls
js/lib/
  sections.js               Deck definitions (chars, data file, voice lang)
  progress.js               Standard character sets + per-char progress
  stroke-matcher.js         Sampling, resampling, matching, threshold
  speech.js                 Web Speech API wrapper (character names)
  storage.js                Async localStorage wrapper
js/data/
  hiragana.json             Extracted KanjiVG stroke data (CC BY-SA 3.0)
  katakana.json             Extracted KanjiVG stroke data (CC BY-SA 3.0)
  alphabet.json             Extracted KanjiVG stroke data (CC BY-SA 3.0)
  numbers.json              Hand-authored 0–9 data + composed 10–100
  overrides.json            Pedagogical stroke-count override hook
scripts/extract-kanjivg.js  Kana extraction from KanjiVG
scripts/build-numbers.js    0–9 data + composed 10–100 generator
```

## Extending the decks

1. Add the target codepoint range to `scripts/extract-kanjivg.js` (or hand-author
   a JSON file like `scripts/build-numbers.js`).
2. Add or edit a deck in `js/lib/sections.js` — it pairs a character list with a
   data file and a speech language. `StudyView` / `Dashboard` consume the generic
   `{char, codepoint, viewBox, paths, numbers}` array.
3. Swap `Storage` to IndexedDB if the character count grows large.
