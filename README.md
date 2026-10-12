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
node scripts/extract-kanjivg.js            # both kana scripts
node scripts/extract-kanjivg.js hiragana   # only hiragana
node scripts/extract-kanjivg.js katakana   # only katakana
```

The English deck is hand-authored (KanjiVG has no Latin letters):

```bash
node scripts/build-alphabet.js
```

---

## Features

- **Three decks**: **ひらがな**, **カタカナ**, and **えいご** (uppercase A–Z), with
  46 kana per kana deck (no dakuten/handakuten or small kana) and 26 letters.
- **Hamburger menu** in the header to switch between decks.
- **Stroke-by-stroke writing** with a shadow and numbered stroke order for guidance,
  and gentle "もう いちど" (try again) feedback on misses.
- **Controls under each character**:
  - **?** — replay the stroke order (demo strokes drawn in a distinct colour).
  - **やりなおす** — restart the current character.
  - **つぎへ** — advance, enabled once all strokes are registered.
  - A compact top-left **←** button returns to the character list.
- **Focused practice**: tap any character on the dashboard to practise just that one;
  or start from the beginning and continue through the set.
- **Simple progress** (no scheduling): each character is marked practised (✓) or
  **かんぺき / perfect** (★) when written with no mistakes.
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
- **Deck contents.** Each deck shows the standard gojūon set (46 kana) or A–Z.
  The bundled kana data files still contain all 83 kana (dakuten/handakuten and
  small kana), so those can be surfaced later via `js/lib/sections.js`.
- **English stroke data.** The A–Z paths are hand-authored simple shapes, not
  school-verified stroke data.
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
  **CC BY-SA 3.0**. The derived `js/data/hiragana.json` and `js/data/katakana.json`
  are likewise distributed under CC BY-SA 3.0. Attribution appears in the app footer.
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
  alphabet.json             Hand-authored A–Z stroke data
  overrides.json            Pedagogical stroke-count override hook
scripts/extract-kanjivg.js  Kana extraction from KanjiVG
scripts/build-alphabet.js   A–Z data generator
```

## Extending the decks

1. Add the target codepoint range to `scripts/extract-kanjivg.js` (or hand-author
   a JSON file like `scripts/build-alphabet.js`).
2. Add or edit a deck in `js/lib/sections.js` — it pairs a character list with a
   data file and a speech language. `StudyView` / `Dashboard` consume the generic
   `{char, codepoint, viewBox, paths, numbers}` array.
3. Swap `Storage` to IndexedDB if the character count grows large.
