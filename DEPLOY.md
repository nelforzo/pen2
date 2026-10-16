# Deployment notes (internal)

How pen2 reaches GitHub Pages. **Read this before shipping a change** — pushing
the source repo alone does *not* update the live site.

## The two repos

| Role | Repository | Local path | Pages? |
|------|------------|------------|--------|
| Source of truth (dev) | `git@github.com:nelforzo/pen2.git` | `~/Developer/pen2` | no |
| Live distribution | `git@github.com:nelforzo/nelforzo.github.io.git` | `~/Developer/nelforzo.github.io` | yes |

- **Live URL:** <https://nelforzo.github.io/pen2/>
- The site is the `pen2/` subdirectory of the `nelforzo.github.io` repo.
- That subdirectory is a **plain copy of the app files** — *not* a git submodule
  and *not* a symlink. Editing/pushing `nelforzo/pen2` has no effect on the site.
- Only these app files are copied (no `scripts/`, no `.gitignore`):
  `index.html`, `css/`, `js/`, `icons/`, `manifest.webmanifest`, `sw.js`,
  `README.md`, `DEPLOY.md`.

## Deploy checklist

Work in `~/Developer/pen2` as usual, then:

1. **Bump the service-worker cache** if *any* cached asset changed.
   In `sw.js`, increment the `CACHE_NAME` version (e.g. `pen2-app-v8` →
   `pen2-app-v9`).
   This is cache-first, so without a bump installed clients keep the old files
   forever — this matters most for `js/data/*.json`.

2. **Commit and push the source repo.**

   ```bash
   cd ~/Developer/pen2
   git add -A && git commit -m "..."
   git push origin main
   ```

3. **Sync the app files into the Pages repo** (excludes dev-only files):

   ```bash
   rsync -a --delete \
     --exclude '.git' --exclude '.gitignore' --exclude 'scripts' \
     --exclude 'node_modules' --exclude '.DS_Store' \
     ~/Developer/pen2/ ~/Developer/nelforzo.github.io/pen2/
   ```

   `--delete` keeps the copy exact (e.g. removes files deleted upstream). Do
   **not** add the stray `.DS_Store` in the Pages repo.

4. **Verify the copy matches** (should print nothing):

   ```bash
   diff -rq --exclude='.git' --exclude='.gitignore' --exclude='scripts' \
     --exclude='.DS_Store' \
     ~/Developer/pen2 ~/Developer/nelforzo.github.io/pen2
   ```

5. **Commit and push the Pages repo** — this is what actually deploys:

   ```bash
   cd ~/Developer/nelforzo.github.io
   git add pen2
   git commit -m "pen2: <summary>"
   git push origin main
   ```

6. **Confirm the live site updated** (GitHub Pages build takes ~1 min; CDN may
   serve stale for a few minutes — cache-bust the URL):

   ```bash
   curl -s "https://nelforzo.github.io/pen2/js/data/katakana.json?cb=$RANDOM" | head
   ```

## Regenerating stroke data before deploying

Stroke JSON is generated, not hand-edited (see `scripts/`). After regenerating,
follow the checklist above — and remember the cache bump.

```bash
node scripts/extract-kanjivg.js katakana   # or: hiragana / alphabet / (none = all)
node scripts/build-numbers.js              # numbers deck
```

Known source quirk: KanjiVG paths can carry a `kvg:type="…"` attribute between
the `id` and `d` attributes. The extractor regex must tolerate that (it does
now — see `parseSVG` in `scripts/extract-kanjivg.js`). If strokes ever come out
empty for a character, this is the first thing to suspect (it previously broke
katakana マ).
