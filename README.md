# PlayShelf

A hand-picked collection of YouTube videos, grouped by game. The catalog is
put together by hand and can hold videos from any creators. A static,
installable web app (React + TypeScript, built with Vite) served by Apache in
a hardened container. One image serves any catalog: the site's name and
description are set at runtime.

- Browse every game alphabetically, including those with no videos yet,
  search (accent-insensitive), and watch a game's videos, newest first. A
  video can be on several games.
- Works offline once visited, and installs as an app (PWA).
- No backend: the whole catalog is two CSV files, Games.txt and Videos.txt.
- On October 31 the site dresses up for Halloween, jump scare and shriek
  included; typing `boo` anywhere outside a text field toggles it on any
  other day. Visitors who ask their system for reduced motion get only the
  colours, with no animation, scare or sound.

## Data

The catalog is two files, `assets/api/Games.txt` and `assets/api/Videos.txt`.
The catalog isn't committed or built into the image: the container mounts the
folder from a volume (see [Deployment](#deployment)).
For local development, put copies in `public/assets/api/` (git-ignored).

Until the catalog volume holds both files, the container serves a demo
catalog (`public/assets/demo/`, built into the image) at the same URLs. The
volume stays read-only. Once both files are there, they're used straight
away: replace them and the site shows the new catalog on the next visit.

**`Games.txt`**, one row per game:

```csv
game_id,title
clair-obscur-expedition-33,Clair Obscur: Expedition 33
```

| Column    | Notes                                                                                  |
| --------- | -------------------------------------------------------------------------------------- |
| `game_id` | 1 to 64 letters, digits, `-` or `_`. Stays the same when the game is renamed. Rows with a bad or repeated id are skipped. |
| `title`   | The game's name, up to 150 characters. A row without one is skipped.                  |

**`Videos.txt`**, one row per video:

```csv
video_id,title,published_at,game_ids
o9KQ4rlymEQ,Clair Obscur: Expedition 33 | Reveal Trailer,2024-06-09,clair-obscur-expedition-33
```

| Column         | Notes                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| `video_id`     | YouTube id (11 characters). Rows with an invalid or repeated id are skipped.            |
| `title`        | Video title. Empty shows the id.                                                        |
| `published_at` | ISO 8601 date or timestamp.                                                             |
| `game_ids`     | One or more game ids from `Games.txt`, separated by `;`. A video is shown on each of its games. Ids that aren't in `Games.txt` are left out, and a video with none left is skipped. |

Both files are CSV: UTF-8 (a byte order mark is fine), commas between the
columns, and a field in double quotes when it has a comma in it. A game
with no videos is still listed, with "No videos yet". Rows that can't be
used are skipped, and listed in the [catalog editor](#catalog-editor) when
the files are opened.

### Pictures

Each game shows its cover (box art) and each video its thumbnail:

- Game covers are stored as `assets/thumbnails/games/<game_id>.webp`, and
  video thumbnails as `assets/thumbnails/<video_id>.webp`. A game without a
  cover shows its newest video's thumbnail, and a picture that's missing
  altogether shows as a blank.
- The container has no copy of the pictures. A video card shows YouTube's
  thumbnail, and a game without a cover shows its newest video's. Game covers
  need Twitch credentials, which don't belong in the container, so the
  Docker deployment shows no covers.
- A standalone site can serve its own copies: `preload_media.py` (below)
  fetches both from Twitch and YouTube, and the files are uploaded with the
  site (see [Standalone](#standalone-shared-hosting)). Pictures that are
  already there are skipped.

#### Preloading pictures

`preload_media.py` runs on your own machine, with Python 3 and Pillow
(`pip install pillow`). It needs a Twitch application for the covers: create
one at [dev.twitch.tv/console](https://dev.twitch.tv/console) and copy its
Client ID and Client Secret.

```sh
export TWITCH_CLIENT_ID=...
export TWITCH_CLIENT_SECRET=...
python3 preload_media.py --catalog public/assets/api --thumbnails public/assets/thumbnails
```

| Option           | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `--no-covers`    | Skip the Twitch covers (no credentials needed).                                 |
| `--no-thumbnails`| Skip the YouTube thumbnails.                                                    |
| `--force`        | Fetch again, even the pictures that are already there.                          |
| `--dry-run`      | List what would be fetched, with no network access.                             |

A game's cover is looked up on Twitch by its exact title. A game that
Twitch doesn't know is listed at the end, and its cover can be added by
hand as `games/<game_id>.webp`. The client secret is only read from the
environment and never written to disk.

### Catalog editor

`/studio/` edits both files in the browser. Open `Games.txt` and `Videos.txt`
(or start a new catalog), add, change or delete games and videos, and export
each file again. The files are read and exported inside the page and never
sent anywhere. Each change is also kept in this browser (IndexedDB), so the
last edits come back on the next visit. That copy is temporary: the browser
can delete it at any time, so export before you leave (the page warns if
there are unexported changes). "Forget saved copy" removes it.

- A video needs at least one game, picked from the games in the editor. The
  editor needs both files open, so the games are there to choose from.
- A new game's id is made from its title (`Pokémon Scarlet` becomes
  `pokemon-scarlet`) and never changes, so renaming a game keeps its videos.
- Games and videos show as cards with their covers and thumbnails, as on the
  site: a missing cover falls back to the newest video's thumbnail, and a
  video's own thumbnail to YouTube's.
- Two games can't have the same title, ignoring case.
- Deleting a game takes it off its videos. A video whose only game it was is
  deleted too, and the editor says so first.
- Rows the editor can't use are shown when the files are opened, and the
  export leaves them out.
- Dates are saved in UTC (`2024-05-09T10:30:30Z`). A
  date on its own is midnight UTC, and a time without an offset is UTC too.
- Commas and double quotes in video titles are saved as `;` and `'`.

The page isn't linked from the site and asks search engines not to index it.
It's served by the same container (and the standalone zips), so the same
access controls apply to it.

## Development

Requires Node.js 26 (the current LTS) or later.

```sh
npm ci
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # type-check and build into dist/
npm run preview    # serve dist/ with the production Content-Security-Policy
npm run standalone -- <dir>   # after build: a standalone site (see below)
```

`SITE_NAME=...` and `SITE_DESCRIPTION=...` before `npm run dev` (or
`preview`) set the site's name and description locally; they default to
`PlayShelf` and "A hand-picked collection of YouTube videos, from any creator, grouped by game."

## Docker

```sh
docker build -t playshelf .
docker run --rm -p 8080:8080 -e SITE_NAME="Some Site" \
  -v "$PWD/public/assets/api:/usr/local/apache2/htdocs/assets/api:ro" \
  playshelf
```

The build runs the tests, then builds the site into an `httpd` (Alpine)
image. The Node and httpd base images are pinned in the `FROM` lines of the
Dockerfile. Build arguments:

| Argument        | Default                      | Purpose                                                          |
| --------------- | ---------------------------- | ---------------------------------------------------------------- |
| `BUILD_VERSION` | `v<Y>.<M>.<D>-build<HHMMSS>` | Version shown in the app bar and used to name the offline cache. |
| `BUILD_TZ`      | `Europe/Athens`              | Time zone for the default build version.                         |

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

### Hardening

- Runs as `www-data` on port 8080, with no Linux capabilities needed.
- Strict Content-Security-Policy (no inline scripts or styles) and the usual
  security headers, in `site.conf`.
- Only `GET`/`HEAD`; no directory listings, `.htaccess` or dotfiles.

## Deployment

`docker-compose.basic-auth.yml` runs the image behind Traefik, with basic auth,
a read-only filesystem, all capabilities dropped, and CPU, memory and process
limits. `docker-compose.yml` is the same without the basic-auth middleware, for
a site that is protected some other way (or not at all).

```sh
cp .env.example .env   # set DOMAIN, PLAYSHELF_AUTH and the data volume
docker compose -f docker-compose.basic-auth.yml up -d
```

`PLAYSHELF_AUTH` is only read by `docker-compose.basic-auth.yml`.

### Volumes

| Volume       | Mounted at (in `htdocs/`)       | Access     | Holds                    |
| ------------ | ------------------------------- | ---------- | ------------------------ |
| `data`       | `assets/api`                    | read-only  | `Games.txt`, `Videos.txt` |

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

## Standalone (shared hosting)

The site also runs on a managed Apache or shared host, without Docker. Each
GitHub release has one zip per site attached by the
[Standalone release](.github/workflows/standalone-release.yml) workflow:

| Zip                            | `SITE_NAME`      | `SITE_DESCRIPTION`                        |
| ------------------------------ | ---------------- | ----------------------------------------- |
| `playshelf-<version>.zip`      | `PlayShelf`      | The default.                              |
| `kostelidis-dev-<version>.zip` | `Kostelidis.dev` | My Gaming Videos Organized By Game Titles |

A zip holds a finished document root, with the site's name and description
filled in and an `.htaccess` generated from `site.conf` (security headers,
caching, compression and the demo catalog). It needs Apache 2.4 with
`AllowOverride All`, the usual on shared hosts, and must be served from the
domain's root.

1. Upload the zip's contents to the document root, `.htaccess` included.
2. Upload the catalog as `assets/api/Games.txt` and `assets/api/Videos.txt`
   (format in [Data](#data)). Until both are there, the demo catalog is shown,
   if the host has `mod_rewrite`.
3. Upload the thumbnails as `assets/thumbnails/<video_id>.webp`, and the
   covers as `assets/thumbnails/games/<game_id>.webp`. Videos without one show
   YouTube's thumbnail. `preload_media.py` makes both on any machine (see
   [Preloading pictures](#preloading-pictures)).

To update, upload a newer zip's contents over the old ones. The zips contain
no catalog or thumbnails, so the uploaded ones stay.

To build a standalone site locally, with any name and description:

```sh
npm run build
SITE_NAME="Some Site" SITE_DESCRIPTION="..." npm run standalone -- standalone/some-site
```

## Project layout

```
build/                 Build-time helpers: CSP, service worker shell, version, site settings, standalone build
public/                Static files: icons, web manifest, demo catalog (plus a local, git-ignored one)
src/components/        React components (and, in halloween/, the Halloween artwork)
src/hooks/             React hooks
src/lib/               Pure logic: catalog and CSV parsing, routing, pagination, text, the editor's rules, Halloween date and spell
src/studio/            The catalog editor at /studio/
src/sw/                Service worker (offline support)
src/ui/                Browser helpers: brand, version, tint, SW registration, Halloween shriek
studio/                The catalog editor's HTML entry (a second page of the same build)
site.conf              Apache config: headers, caching, site settings, demo catalog
Dockerfile             Builds and tests the site, then serves it from httpd
docker-compose.yml     Runs the image behind Traefik (no auth)
docker-compose.basic-auth.yml   The same, with basic auth in front
.env.example           Every setting for the compose files, with its default
CLAUDE.md              Notes for Claude Code: commands, invariants, conventions
docker-entrypoint.sh   Escapes the site settings for the page and the web manifest
preload_media.py       Preloads game covers (Twitch) and video thumbnails, on your own machine
```

## How it was built

PlayShelf was developed with [Claude Code](https://claude.com/claude-code).
Every commit was reviewed and made by me, and I tested the site by hand for
bugs before releasing it.

## License

[MIT](LICENSE.md) © Kostelidis.dev

The interface icons in `src/components/Icons.tsx` come from Google's
[Material Icons](https://github.com/google/material-design-icons), under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), except the
Halloween skull, which, like the artwork in `src/components/halloween/`, was
made for this project and is under the MIT license.
