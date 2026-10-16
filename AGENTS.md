# AGENTS.md — notes for coding agents

This file is for AI/coding agents working in this repo. Human-facing deploy
docs live in `DEPLOY.md`; read both before shipping.

## This repo alone is not the live site

`pen2` is the **source of truth** (dev only, GitHub Pages disabled). The live
site is a **separate repository** and a **plain copy** of the app files — not a
submodule, not a symlink.

| Role | Repository | Local path | Pages? |
|------|------------|------------|--------|
| Source of truth (dev) | `git@github.com:nelforzo/pen2.git` | `~/Developer/pen2` (this repo) | no |
| Live distribution | `git@github.com:nelforzo/nelforzo.github.io.git` | `~/Developer/nelforzo.github.io` | yes |

- **Live URL:** <https://nelforzo.github.io/pen2/>
- The live app is the `pen2/` subdirectory of `nelforzo.github.io`.

**Pushing this repo does not update the live site.** A change is only shipped
when *both* repos are pushed. When asked to "push to both repos", do the full
sequence below.

## Deploy sequence (every time)

1. **Bump the service-worker cache** in `sw.js` if *any* cached asset changed
   (`index.html`, `css/`, `js/`, `icons/`, data JSON, manifest). Increment
   `CACHE_NAME`, e.g. `pen2-app-v18` → `pen2-app-v19`. It is cache-first, so
   without a bump installed clients keep the old files indefinitely.
2. Commit and push the source repo:
   ```bash
   cd ~/Developer/pen2
   git add -A && git commit -m "..." && git push origin main
   ```
3. Sync app files into the Pages repo:
   ```bash
   rsync -a --delete \
     --exclude '.git' --exclude '.gitignore' --exclude 'scripts' \
     --exclude 'node_modules' --exclude '.DS_Store' \
     ~/Developer/pen2/ ~/Developer/nelforzo.github.io/pen2/
   ```
   Never commit the stray `.DS_Store` in the Pages repo.
4. Commit and push the Pages repo — this is what actually deploys:
   ```bash
   cd ~/Developer/nelforzo.github.io
   git add pen2 && git commit -m "pen2: <summary>" && git push origin main
   ```

## Do NOT poll the server after deploying

Do **not** loop/`curl`/repeatedly check the live URL to confirm the deploy.
GitHub Pages builds (~1 min) and the CDN can serve stale content for several
minutes; it will update on its own. Polling wastes time and can look like a
failure when nothing is wrong. If a check is truly needed, do a **single**
cache-busted request (e.g. `?cb=$RANDOM`) and then stop.
