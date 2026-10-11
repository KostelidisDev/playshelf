# PlayShelf

A hand-picked collection of YouTube videos, grouped by game. The catalog is
put together by hand and can hold videos from any creators. A static,
installable web app (React + TypeScript, built with Vite) served by Apache in
a hardened container. One image serves any catalog: the site's name and
description are set at runtime.

- Browse games alphabetically, search (accent-insensitive), and page through
  each game's videos, newest first.
- Works offline once visited, and installs as an app (PWA).
- No backend: the whole catalog is one CSV file.

## Data

The catalog is one CSV file, `assets/api/videos.csv`. Neither it nor the
thumbnails are committed or built into the image: the container mounts both
from volumes (see [Deployment](#deployment)). For local development, put a
copy in `public/assets/api/videos.csv` (git-ignored).

Until the catalog volume holds a `videos.csv`, the container serves a
one-video demo catalog (`public/assets/demo/videos.csv`, built into the
image) at the same URL, and the thumbnail sync reads it too. The volume
stays read-only; once a real `videos.csv` is there, it's used straight away.

```csv
video_id,title,published_at,game_title
o9KQ4rlymEQ,Clair Obscur: Expedition 33 | Reveal Trailer,2024-06-09,Clair Obscur: Expedition 33
```

| Column         | Notes                                                             |
| -------------- | ----------------------------------------------------------------- |
| `video_id`     | YouTube id (11 characters). Rows with an invalid id are skipped.  |
| `title`        | Video title.                                                      |
| `published_at` | ISO 8601 date or timestamp.                                       |
| `game_title`   | Groups videos into games. Empty puts the video under "Unmatched". |

Thumbnails are read from `assets/thumbnails/<video_id>.webp`, falling back
to YouTube's (`i.ytimg.com`) for any that are missing. In the container,
`sync-thumbnails.sh` downloads the missing ones (see
[Thumbnail sync](#thumbnail-sync)).

## Development

Requires Node.js 26 (the current LTS) or later.

```sh
npm ci
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # type-check and build into dist/
npm run preview    # serve dist/ with the production Content-Security-Policy
```

`SITE_NAME=...` and `SITE_DESCRIPTION=...` before `npm run dev` (or
`preview`) set the site's name and description locally; they default to
`PlayShelf` and "A hand-picked collection of YouTube videos, from any creator, grouped by game."

## Docker

```sh
docker build -t playshelf .
docker run --rm -p 8080:8080 -e SITE_NAME="Some Site" \
  -v "$PWD/public/assets/api:/usr/local/apache2/htdocs/assets/api:ro" \
  -v "$PWD/thumbnails:/usr/local/apache2/htdocs/assets/thumbnails" \
  playshelf
```

The build runs the tests, then builds the site into an `httpd` (Alpine)
image. Build arguments:

| Argument        | Default                      | Purpose                                                          |
| --------------- | ---------------------------- | ---------------------------------------------------------------- |
| `BUILD_VERSION` | `v<Y>.<M>.<D>-build<HHMMSS>` | Version shown in the app bar and used to name the offline cache. |
| `BUILD_TZ`      | `Europe/Athens`              | Time zone for the default build version.                         |
| `NODE_TAG`      | `26.11.1-alpine3.24`         | Node image used for the build (Node 26 LTS).                     |
| `HTTPD_TAG`     | `2.4.69-alpine3.24`          | Apache image that serves the site.                               |

### Site name and description

| Variable           | Default                         | Shown in                                      |
| ------------------ | ------------------------------- | --------------------------------------------- |
| `SITE_NAME`        | `PlayShelf`                     | Page title, app bar, installed app.           |
| `SITE_DESCRIPTION` | "A hand-picked collection of …" | Search results, link previews, installed app. |

`index.html` and `manifest.webmanifest` contain `__SITE_NAME__` and
`__SITE_DESCRIPTION__` placeholders. When the container starts,
`docker-entrypoint.sh` escapes both settings for HTML and JSON, and Apache
(`site.conf`) fills them in as those files are served. Each must be one line
of text. Changing them only needs a restart, not a rebuild. The files in the
image stay read-only.

### Thumbnail sync

At start, `docker-entrypoint.sh` runs `sync-thumbnails.sh` in the background.
For every video in `videos.csv` without a `<video_id>.webp`, it downloads
YouTube's 16:9 maxres thumbnail (or the 4:3 hq one with its letterbox bars
cropped off), converts it to WebP with `cwebp`, and writes it to the
thumbnails volume (managed by Docker). A thumbnail is roughly a quarter of
YouTube's JPEG. It then checks the CSV again on an interval, so new videos
get their thumbnails without a restart. Apache starts straight away; until a thumbnail exists, the
site shows YouTube's.

| Variable                   | Default | Purpose                                         |
| -------------------------- | ------- | ----------------------------------------------- |
| `THUMBNAILS_SYNC`          | `true`  | `false` turns the sync off.                     |
| `THUMBNAILS_SYNC_INTERVAL` | `3600`  | Seconds between checks; `0` checks only at start. |
| `THUMBNAILS_WIDTH`         | `640`   | WebP width in pixels.                           |
| `THUMBNAILS_QUALITY`       | `80`    | WebP quality (0–100).                           |
| `THUMBNAILS_JOBS`          | `4`     | Downloads at a time.                            |

The sync skips (and logs why) when the CSV is missing or the thumbnails
directory isn't writable.

### Hardening

- Runs as `www-data` on port 8080, with no Linux capabilities needed.
- Strict Content-Security-Policy (no inline scripts or styles) and the usual
  security headers, in `site.conf`.
- Only `GET`/`HEAD`; no directory listings, `.htaccess` or dotfiles.

## Deployment

`docker-compose.yml` runs the image behind Traefik, with basic auth, a
read-only filesystem, all capabilities dropped, and CPU, memory and process
limits.

```sh
cp .env.example .env   # set DOMAIN, PLAYSHELF_AUTH and the data volume
docker compose up -d
```

### Volumes

| Volume       | Mounted at (in `htdocs/`)       | Access     | Holds                    |
| ------------ | ------------------------------- | ---------- | ------------------------ |
| `data`       | `assets/api`                    | read-only  | `videos.csv`             |
| `thumbnails` | `assets/thumbnails`             | read-write | `<video_id>.webp` files  |

`thumbnails` is a plain Docker-managed volume (`<INSTANCE_NAME>-thumbnails`).
Docker seeds it from the image when it creates it, so it starts owned by
`www-data`. There's nothing to configure; if it's removed, the sync downloads
the thumbnails again.

`data` is your own mount: a **bind mount**, an **NFS export** or a
**CIFS/SMB share**, set by `PLAYSHELF_DATA_VOLUME_TYPE`, `_OPTIONS` and
`_DEVICE`:

| Kind | `TYPE` | `OPTIONS`                                                           | `DEVICE`                        |
| ---- | ------ | ------------------------------------------------------------------- | ------------------------------- |
| Bind | `none` | `bind`                                                              | `/srv/playshelf/data`           |
| NFS  | `nfs`  | `addr=192.168.1.10,nfsvers=4,ro`                                    | `:/export/playshelf/data`       |
| CIFS | `cifs` | `addr=192.168.1.10,username=…,password=…,vers=3.0,uid=82,gid=82,ro` | `//192.168.1.10/playshelf/data` |

- The container runs as uid/gid 82 (`www-data`) and only reads `data`, so it
  must be readable by uid 82. For a bind mount, the directory must already
  exist. For NFS, the export must let uid 82 read.
- The Docker host mounts NFS and CIFS shares, so it needs `nfs-common` /
  `nfs-utils` or `cifs-utils`. For CIFS, `addr` must be an IP address and the
  password can't contain commas.
- Docker keeps a volume's settings once it's created. After changing them,
  run `docker compose down`, then `docker volume rm <INSTANCE_NAME>-data`,
  then `docker compose up -d`.

`.env.example` lists every setting and its default. To run several sites
on one host, give each instance its own `.env` with a distinct
`INSTANCE_NAME` and network subnets.

## Project layout

```
build/                 Build-time helpers: CSP, service worker shell, version, site settings
public/                Static files: icons, web manifest, demo catalog (plus a local, git-ignored one)
src/components/        React components
src/hooks/             React hooks
src/lib/               Pure logic: CSV parsing, routing, pagination, text
src/sw/                Service worker (offline support)
src/ui/                Browser helpers: brand, version, tint, SW registration
site.conf              Apache config: headers, caching, site settings, demo catalog
CLAUDE.md              Notes for Claude Code: commands, invariants, conventions
docker-entrypoint.sh   Escapes the site settings and starts the thumbnail sync
sync-thumbnails.sh     Downloads missing thumbnails as WebP
```

## How it was built

PlayShelf was developed with [Claude Code](https://claude.com/claude-code).
Every commit was reviewed and made by me, and I tested the site by hand for
bugs before releasing it.

## License

[MIT](LICENSE.md) © Kostelidis.dev

The interface icons in `src/components/Icons.tsx` come from Google's
[Material Icons](https://github.com/google/material-design-icons), under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
