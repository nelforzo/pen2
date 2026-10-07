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

The bundled `js/data/hiragana.json` was generated from KanjiVG and is checked in.
To regenerate:

```bash
node scripts/extract-kanjivg.js
```

This fetches KanjiVG SVGs over the network and writes `js/data/hiragana.json`.

---

## Features

- **46 standard hiragana** (no dakuten/handakuten or small kana).
- **Stroke-by-stroke writing** with a shadow and numbered stroke order for guidance,
  and gentle "もう いちど" (try again) feedback on misses.
- **On completion**, the child chooses:
  - **つぎへ** (next character) — shown only after a clean run (no mistakes).
  - **もういちど** (repeat) — always available.
  - **もどる** (back to the character list).
- **Focused practice**: tap any character on the dashboard to practise just that one;
  or start from the beginning and continue through the set.
- **Simple progress** (no scheduling): each character is marked practised (✓) or
  **かんぺき / perfect** (★) when written with no mistakes.
- **All controls labelled in Japanese** for young learners.
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
pattern (`Dashboard`, `StudyView`, `SettingsView`) with an explicit `destroy()` for
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
child finishes a character and chooses **つぎへ** (next), **もういちど** (repeat), or
**もどる** (back). "Next" only appears after a clean run, gently encouraging a
retry otherwise.

Progress is a tiny per-character record (`{ practiced, clean, attempts }`) in
`js/lib/progress.js`, persisted to `localStorage` behind an async wrapper
(`js/lib/storage.js`). A character shown with ✓ was practised; ★ means it was
written with no mistakes.

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
**2 captured points**. Recognition is intentionally lenient — the goal is
encouragement, not strict grading.

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
Dashboard shows three simple counts — れんしゅうした (practised), かんぺき (perfect),
のこり (remaining) — and a grid of the 46 standard hiragana. A ✓ marks a practised
character and a ★ marks one written with no mistakes.

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
- **Deck contents.** Only the 46 standard hiragana are shown (no dakuten /
  handakuten, no small kana). The bundled data file still contains all 83 kana, so
  the other sets can be added later by extending `standardCharacters()`.
- **Accessibility.** Canvas drawing is inherently not screen-reader accessible. All
  non-canvas controls have ARIA labels, there is an `aria-live` status region for
  feedback, and full keyboard control of the practice actions. Zoom is enabled (no
  `user-scalable=no`), and safe-area insets are respected. A non-visual fallback
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
  **CC BY-SA 3.0**. The derived `js/data/hiragana.json` is likewise distributed
  under CC BY-SA 3.0. Attribution appears in the app footer and settings.
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
  study-view.js             Drawing, validation, result buttons
  settings-view.js          Preferences + attribution
js/lib/
  progress.js               Standard character set + per-char progress
  stroke-matcher.js         Sampling, resampling, matching, threshold
  storage.js                Async localStorage wrapper
js/data/
  hiragana.json             Extracted KanjiVG stroke data (CC BY-SA 3.0)
  overrides.json            Pedagogical stroke-count override hook
scripts/extract-kanjivg.js  One-time data extraction
```

## Extending to Katakana & Kanji

1. Add the target codepoint range to `scripts/extract-kanjivg.js` and regenerate
   into a new data file (or extend `hiragana.json`).
2. Feed the new dataset to `StudyView` / `Dashboard` — they consume a generic
   `{char, codepoint, viewBox, paths, numbers}` array. Update the character list in
   `js/lib/progress.js` (`standardCharacters()`).
3. Swap `Storage` to IndexedDB if the character count grows large.
