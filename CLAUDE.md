# CLAUDE.md

PlayShelf: a hand-picked collection of YouTube videos, from any creators,
grouped by game. A static, installable web app (React 19 + TypeScript, Vite)
with no backend, served by Apache in a hardened container. README.md has
the user-facing details; this file is what to keep in mind when changing
the code.

## Commands

Node.js 26 (LTS) or later, as in `package.json` and the Docker build.

```sh
npm run dev        # dev server (CHANNEL_NAME=... to change the name)
npm test           # Vitest, once
npm run typecheck  # tsc -b
npm run build      # typecheck + app build + service worker build into dist/
npm run preview    # serve dist/ under the production CSP from site.conf
docker build -t playshelf .   # runs the tests, then builds the image
```

Run `npm test` and `npm run typecheck` before calling a change done. For
anything touching site.conf, the CSP, the service worker or the container,
also check it in `npm run preview` or a built image.

## Layout

- `src/lib/`: pure logic (CSV parsing, routes, pagination, text, videos). No
  DOM, no network. Keep it that way, so it stays unit-testable.
- `src/components/`, `src/hooks/`: React UI.
- `src/ui/`: browser helpers (brand, tint, version, SW registration).
- `src/sw/`: the service worker, built separately (`vite.sw.config.ts`).
  `strategy.ts` holds its pure, tested parts.
- `build/`: build-time helpers used by the Vite configs (CSP, shell file
  list, version, channel name), tested in `build/build.test.ts`.
- `site.conf`: Apache config (headers, CSP, caching, channel name, demo
  catalog rewrite). `docker-entrypoint.sh` and `sync-thumbnails.sh` run in
  the container.

Tests sit next to the code they cover (`*.test.ts[x]`); fixtures and setup
are in `src/test/`.

## Invariants

- **CSP**: `site.conf` is the single source of the Content-Security-Policy;
  `npm run preview` reads it from there (`build/csp.ts`). No inline scripts
  or styles, no `style=""` attributes, no `data:` URLs (`assetsInlineLimit:
  0`), and images only from `'self'` and `i.ytimg.com`. Any new external
  origin needs a CSP change, and a good reason.
- **Channel name**: the build is channel-neutral. `index.html` and the web
  manifest carry `__CHANNEL_NAME__`, filled in at serve time
  (Apache in the container, `build/channel.ts` locally), escaped by
  `docker-entrypoint.sh`. Never bake a name into the build.
- **Catalog**: one CSV, `assets/api/videos.csv` (format in README.md). It
  must stay in sync with the manager's export
  (`manager/creator_manager/storage/site_csv.py`). Real data is never
  committed (`public/assets/api/` and `public/assets/thumbnails/` are
  git-ignored); `public/assets/demo/videos.csv` is the demo that's served
  when the catalog volume has none.
- **Video ids**: only 11-character YouTube ids (`[A-Za-z0-9_-]{11}`) are
  used, both in the site and in `sync-thumbnails.sh`, so a crafted row can't
  point a request or a file path elsewhere.
- **Offline**: the service worker precaches the app shell listed by
  `build/shell.ts` (the hashed app build plus its `ALWAYS` list); a new
  static file outside `assets/app/` probably belongs in that list.
  Thumbnails are cached as they're viewed, not precached.
- **Container**: read-only root filesystem, no capabilities, runs as
  www-data (uid 82) on port 8080. Site files stay root-owned. The catalog is
  a read-only custom mount (bind/NFS/CIFS); thumbnails are a Docker-managed
  volume, the only place the container writes (plus `/tmp`).

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
