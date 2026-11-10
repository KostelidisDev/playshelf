# CLAUDE.md

PlayShelf is a hand-picked collection of YouTube videos, grouped by game. It's
a static, installable web app (React 19 + TypeScript, built with Vite) with no
backend, served by Apache in a hardened container. README.md has the
user-facing details. This file is what to keep in mind when changing the code.

## Commands

Node.js 26 or later, as in `package.json`, the Dockerfile and CI.

```sh
npm run dev        # dev server (SITE_NAME=..., SITE_DESCRIPTION=... to set the name)
npm test           # Vitest, once
npm run typecheck  # tsc -b
npm run build      # typecheck, app build, then the two service worker builds, into dist/
npm run preview    # serve dist/ under the production CSP read from site.conf
npm run standalone -- <dir>   # after build: a shared-host site in <dir> (needs SITE_URL)
docker build -t playshelf .   # runs the tests, then builds the image
```

Run `npm test` and `npm run typecheck` before calling a change done. For
anything touching `site.conf`, the CSP, the service workers or the container,
also check it in `npm run preview` or a built image.

## Layout

- `src/lib/`: pure logic (catalog and CSV parsing, routes, pagination, text,
  the editor's rules, the Halloween date and spell). No DOM, no network. Keep
  it that way so it stays unit-testable.
- `src/components/`, `src/hooks/`: React UI.
- `src/studio/`, `studio/`: the catalog editor at `/studio/`, a second page of
  the same build, with its own HTML entry, manifest and service worker, scoped
  to `/studio/`. Its rules are in `src/lib/studio.ts`, and it shares the file
  rules in `src/lib/catalog.ts`.
- `src/ui/`: browser helpers (brand, tint, version, service worker
  registration, saving a file, the Halloween shriek's sound).
- `src/sw/`: the two service workers, built separately: the site's `sw.ts`
  (`vite.sw.config.ts`) and the editor's `studio.ts` (`vite.studio-sw.config.ts`,
  output in `dist/studio/`). `fetch.ts` holds the fetch helpers both share;
  `strategy.ts` holds their pure, tested parts.
- `build/`: build-time helpers used by the Vite configs: CSP, shell file list,
  version, site settings. `standalone.ts` turns `dist/` into a site for a
  shared host (settings filled in, an `.htaccess` made from `site.conf`). All
  tested in `build/build.test.ts`.
- `site.conf`: Apache config (headers, CSP, caching, site settings, demo
  catalog rewrite). It's the one source of the CSP.
- `docker-entrypoint.sh`: runs in the container; escapes the site settings.
- `Dockerfile`, `docker-compose.yml`, `docker-compose.basic-auth.yml`,
  `.env.example`: the container and its deployment.
- `.github/workflows/`: `docker-publish.yml` (the image) and
  `standalone-release.yml` (one zip per site, attached to a release).
- `scripts/`: the maintainer's tools, which run on their own machine and are
  never copied into the image. `preload_media.py` fetches game covers from
  Twitch and video thumbnails from YouTube. `migrate_catalog.py` converts the
  old single-file catalog.

Tests sit next to the code they cover (`*.test.ts[x]`). Fixtures and setup are
in `src/test/`.

## Invariants

- **CSP**: `site.conf` is the single source of the Content-Security-Policy, and
  `npm run preview` reads it from there (`build/csp.ts`). No inline scripts or
  styles, no `style=""` attributes, no `data:` URLs (`assetsInlineLimit: 0`).
  Images come only from `'self'` and `i.ytimg.com`. A new external origin needs
  a CSP change and a good reason. The exception is the editor's `/studio/`
  block in `site.conf`, which also allows `https://www.youtube.com` (the title
  lookup) and `https://www.googleapis.com` (the optional Data API key's
  publish-date lookup) in `connect-src`. The tests keep that block identical to
  the site's policy apart from those origins.
- **Site settings**: the build is brand-neutral. `index.html`, the web manifest,
  the editor's page (`studio/index.html`) and its manifest
  (`public/studio/manifest.webmanifest`, named "<name> Catalog editor") carry
  `__SITE_NAME__`, `__SITE_DESCRIPTION__` and, for the link tags,
  `__SITE_LINKS__`. They're filled in at serve time: by Apache in the container
  (escaped by `docker-entrypoint.sh`), by `build/site.ts` under `dev` and
  `preview`, and by `build/standalone.ts` for a standalone site. Never bake a
  name or description into the build.
- **Catalog**: two CSVs, `assets/api/Games.txt` (game_id, title) and
  `assets/api/Videos.txt` (video_id, title, published_at, game_ids, the ids
  separated by `;`). The format is in README.md. `src/lib/catalog.ts` reads and
  writes both, for the site and the editor alike, so a format change goes there
  first. Real data is never committed: `public/assets/api/` and
  `public/assets/thumbnails/` are git-ignored, and `public/assets/demo/` holds
  the demo pair served while the catalog volume has neither file.
- **Ids**: game ids are 1-64 letters, digits, `-` or `_`. They go into URLs and
  file names (`assets/thumbnails/games/<id>.webp`), so `catalog.ts` and
  `preload_media.py` both check them. Video ids are only 11-character YouTube
  ids (`[A-Za-z0-9_-]{11}`), again checked in both places, so a crafted row
  can't point a request or a file path elsewhere.
- **Offline**: the site's service worker precaches the app shell listed by
  `build/shell.ts` (the hashed app build plus its `ALWAYS` list). A new static
  file outside `assets/app/` probably belongs in that list. Thumbnails are
  cached as they're viewed, not precached. The editor's worker
  (`/studio/sw.js`) precaches its own shell, listed by `studioShellFiles`. It
  never caches the catalog: the editor fetches the live files uncached, and its
  saved copy of unsaved changes is in IndexedDB.
- **Container**: read-only root filesystem, no capabilities, runs as `www-data`
  (uid 82) on port 8080. Site files stay root-owned. The catalog and thumbnails
  are read-only volumes (bind, NFS or CIFS). The container writes nothing but
  `/tmp`.
- **Editor access**: the editor is always behind basic auth
  (`PLAYSHELF_AUTH`, required by `docker-compose.yml`). It's served on its own
  host (`EDITOR_DOMAIN`), so it installs beside the site.

## Conventions

- TypeScript is strict, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Imports use explicit `.ts`/`.tsx` extensions.
- Dependencies are pinned to exact versions, in `package.json` and the
  Dockerfile's base image tags.
- Comments explain why, in plain sentences, at the top of a file or above a
  non-obvious block. Match the existing tone and density.
- Keep README.md and `.env.example` in step with any change to settings,
  volumes or deployment.

## Git

The maintainer supervises every commit: don't commit, push or rewrite history
unless asked. Leave changes in the working tree for review.
