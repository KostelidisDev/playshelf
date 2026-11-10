# CLAUDE.md

PlayShelf: a hand-picked collection of YouTube videos, from any creators,
grouped by game. A static, installable web app (React 19 + TypeScript, Vite)
with no backend, served by Apache in a hardened container. README.md has
the user-facing details; this file is what to keep in mind when changing
the code.

## Commands

Node.js 26 (LTS) or later, as in `package.json` and the Docker build.

```sh
npm run dev        # dev server (SITE_NAME=..., SITE_DESCRIPTION=...)
npm test           # Vitest, once
npm run typecheck  # tsc -b
npm run build      # typecheck + app build + service worker build into dist/
npm run preview    # serve dist/ under the production CSP from site.conf
npm run standalone -- <dir>   # after build: dist/ for a shared host, in <dir>
docker build -t playshelf .   # runs the tests, then builds the image
```

Run `npm test` and `npm run typecheck` before calling a change done. For
anything touching site.conf, the CSP, the service worker or the container,
also check it in `npm run preview` or a built image.

## Layout

- `src/lib/`: pure logic (catalog and CSV parsing, routes, pagination, text).
  No DOM, no network. Keep it that way, so it stays unit-testable.
- `src/components/`, `src/hooks/`: React UI.
- `studio/`, `src/studio/`: the catalog editor at `/studio/`, a second page
  of the same build (its own HTML entry, manifest and service worker, scoped
  to /studio/). Its rules are in `src/lib/studio.ts`, and it shares the file
  rules in `src/lib/catalog.ts`.
- `src/ui/`: browser helpers (brand, tint, version, SW registration, saving a
  file, and the Halloween shriek's sound).
- `src/sw/`: the service workers, built separately: the site's `sw.ts`
  (`vite.sw.config.ts`) and the editor's `studio.ts` (`vite.studio-sw.config.ts`,
  output in `dist/studio/`). `fetch.ts` holds the fetch helpers both share.
  `strategy.ts` holds its pure, tested parts.
- `build/`: build-time helpers used by the Vite configs (CSP, shell file
  list, version, site settings), and `standalone.ts`, which turns dist/
  into a site for a shared host (settings filled in, an `.htaccess` made
  from site.conf). All tested in `build/build.test.ts`.
- `site.conf`: Apache config (headers, CSP, caching, site settings, demo
  catalog rewrite). `docker-entrypoint.sh` runs in the container.
  `scripts/` holds the maintainer's tools, which run on their own machine and
  are never copied into the image: `preload_media.py` fetches game covers from
  Twitch and video thumbnails from YouTube, and `migrate_catalog.py` converts
  the old single-file catalog.

Tests sit next to the code they cover (`*.test.ts[x]`); fixtures and setup
are in `src/test/`.

## Invariants

- **CSP**: `site.conf` is the single source of the Content-Security-Policy;
  `npm run preview` reads it from there (`build/csp.ts`). No inline scripts
  or styles, no `style=""` attributes, no `data:` URLs (`assetsInlineLimit:
  0`), and images only from `'self'` and `i.ytimg.com`. Any new external
  origin needs a CSP change, and a good reason. The one exception is the
  editor's `/studio/` block in `site.conf`, which also allows
  `https://www.youtube.com` in `connect-src` for the title lookup; the tests
  keep it identical to the site's policy apart from that origin.
- **Site settings**: the build is brand-neutral. `index.html` and the web
  manifest carry `__SITE_NAME__` and `__SITE_DESCRIPTION__`, and so do the
  catalog editor's page and manifest (`studio/index.html`,
  `public/studio/manifest.webmanifest`, named "<name> Catalog editor"). They're
  filled in at serve time (Apache in the container, `build/site.ts` locally), escaped by
  `docker-entrypoint.sh`. Never bake a name or description into the build;
  only the standalone sites (`build/standalone.ts`) fill them in, after it.
- **Catalog**: two CSVs, `assets/api/Games.txt` (game_id, title) and
  `assets/api/Videos.txt` (video_id, title, published_at, game_ids; the game
  ids separated by `;`), format in README.md. `src/lib/catalog.ts` reads and
  writes both, for the site and the editor alike, so a change to the format
  goes there first. Real data is never
  committed (`public/assets/api/` and `public/assets/thumbnails/` are
  git-ignored); `public/assets/demo/` holds the demo pair served while the
  catalog volume has neither file.
- **Game ids**: 1-64 letters, digits, `-` or `_`, as with video ids. They
  go into URLs and file names (`assets/thumbnails/games/<id>.webp`), so
  `catalog.ts` and `preload_media.py` both check them.
- **Video ids**: only 11-character YouTube ids (`[A-Za-z0-9_-]{11}`) are
  used, both in the site and in `preload_media.py`, so a crafted row can't
  point a request or a file path elsewhere.
- **Offline**: the service worker precaches the app shell listed by
  `build/shell.ts` (the hashed app build plus its `ALWAYS` list); a new
  static file outside `assets/app/` probably belongs in that list.
  Thumbnails are cached as they're viewed, not precached.
  The editor's worker (`/studio/sw.js`) precaches its own shell, listed by
  `studioShellFiles` from `dist/studio/index.html`. It never caches the
  catalog: the editor fetches the live files from the site, uncached, and its saved copy of unsaved changes is in IndexedDB.
- **Container**: read-only root filesystem, no capabilities, runs as
  www-data (uid 82) on port 8080. Site files stay root-owned. The catalog is
  a read-only custom mount (bind/NFS/CIFS). The container writes nothing but
  `/tmp`.

## Conventions

- TypeScript is strict, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Imports use explicit `.ts`/`.tsx` extensions.
- Dependencies are pinned to exact versions.
- Comments explain why, in plain sentences, at the top of a file or above a
  non-obvious block. Match the existing tone and density.
- Keep README.md and `.env.example` in step with any change to settings,
  volumes or deployment.

## Git

The maintainer supervises every commit: don't commit, push or rewrite
history unless asked. Leave changes in the working tree for review.
