# pen2 — Japanese Character Writing SRS

A spaced-repetition system (SRS) for learning Japanese characters through **active
writing practice with stroke-order validation**. Phase 1 covers hiragana.

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

- **83 hiragana cards** (base kana, dakuten/handakuten, small kana, archaic ゐゑ).
- **Stroke-by-stroke writing** with immediate validation and gentle "Try again" feedback.
- **Progressive scaffolding** that fades as cards mature:
  - **Trace mode** (New / Learning): shadow + stroke numbers; learner traces.
  - **Guided mode** (Young Review): shadow only; learner draws from memory.
  - **Recall mode** (Mature Review): blank canvas; strict threshold.
  - **Relearning**: drops back one step (to Guided).
- **SRS scheduling** (SM-2 inspired) with Again / Hard / Good / Easy ratings.
- **Auto-suggested rating** based on stroke accuracy (retries + hints), overridable.
- **Progress tracking** on the dashboard (due / new / learning / mature counts, per-card state).
- **Keyboard controls** for accessibility: `U` undo, `H` show stroke, `S` skip, `1–4` rate.
- **Offline**: zero external runtime requests; everything is local.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `U` | Undo last accepted stroke |
| `H` | Show the correct stroke (hint) |
| `S` | Skip / rate Again |
| `1` `2` `3` `4` | Rate Again / Hard / Good / Easy |

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

### 3. SRS — custom minimal scheduler (not `ts-fsrs`)
**Suggested:** `ts-fsrs`.

**Decision: ~100-line SM-2-inspired scheduler (`js/lib/srs.js`).**
FSRS is excellent but overkill for ~83 cards, and pulls a dependency into a
zero-build, offline app. The custom scheduler gives full, readable control over
exactly the states the fade-out progression needs (`new`, `learning`, `review`,
`relearning`) plus `interval`/`ef` for maturity thresholds. It is trivial to audit
and later swap for FSRS if desired.

State is persisted to `localStorage` behind an async wrapper (`js/lib/storage.js`)
so IndexedDB can be substituted for the kanji phase without touching call sites.

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

Thresholds per mode: **trace 0.62 · guided 0.72 · recall 0.78**. Thresholds are
global rather than per-character: resampling normalizes stroke length, so longer
strokes do not need looser tolerance. This can be revisited if per-character
tuning proves necessary.

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
Dashboard shows due/new/learning/mature counts and a per-character grid with state
badges. Each card stores `strokesAttempted` / `strokesCorrect`; session retries and
hints feed the auto-rating suggestion.

---

## Known Caveats & Limitations

- **Stroke recognition on subtle strokes.** Point-cloud distance is weaker on
  pauses, hooks, and sweeps than on gross shape. Mitigations: direction checking,
  64-point resampling, mode-specific thresholds. Not perfect — a deliberately
  "shaky but roughly right" stroke may pass, and an unusually stylized correct
  stroke may fail. No ML recognizer in Phase 1.
- **KanjiVG stroke splitting.** Some kana may be split into more strokes than is
  pedagogically standard. `js/data/overrides.json` exists as a hook for a
  per-character override map; the current hiragana set matches expected counts
  (あ = 3 strokes), so no overrides are active yet.
- **Dakuten** are counted as separate strokes (e.g. が = 5). This is acceptable for
  Phase 1 but may warrant special handling later.
- **Accessibility.** Canvas drawing is inherently not screen-reader accessible. All
  non-canvas controls have ARIA labels, there is an `aria-live` status region for
  feedback, and full keyboard control of review actions. A non-visual fallback
  (e.g. typed-answer mode) is out of scope for Phase 1.
- **Arrows.** The brief mentions arrow overlays; Phase 1 renders stroke *numbers*
  only. Arrows can be added by computing end-tangents of each path.
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
  dashboard.js              Deck stats + character grid
  study-view.js             Drawing, validation, scaffolding, rating
  settings-view.js          Preferences + attribution
js/lib/
  srs.js                    Scheduler + maturity mapping
  stroke-matcher.js         Sampling, resampling, matching, thresholds
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
   `{char, codepoint, viewBox, paths, numbers}` array.
3. Swap `Storage` to IndexedDB if the card count grows large.
