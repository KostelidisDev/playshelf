# PlayShelf

A hand-picked collection of YouTube videos, grouped by game. The catalog is
put together by hand and can hold videos from any creators. A static,
installable web app (React + TypeScript, built with Vite) served by Apache in
a hardened container. One image serves any catalog: the site's name and
description are set at runtime.

- Browse every game alphabetically, including those with no videos yet,
  search (accent-insensitive), and watch a game's videos, newest first. A
  video can be on several games.
- Works offline once visited, and installs as an app (PWA). The catalog
  editor installs too, and works offline once visited.
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
An older catalog that is one `videos.csv` (the game as each video's title) converts
to the two files with `python3 scripts/migrate_catalog.py`.

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
- A standalone site can serve its own copies: `scripts/preload_media.py` (below)
  fetches both from Twitch and YouTube, and the files are uploaded with the
  site (see [Standalone](#standalone-shared-hosting)). Pictures that are
  already there are skipped.

#### Preloading pictures

`scripts/preload_media.py` runs on your own machine, with Python 3 and Pillow
(`pip install -r scripts/requirements.txt`). It needs a Twitch application for the covers: create
one at [dev.twitch.tv/console](https://dev.twitch.tv/console) and copy its
Client ID and Client Secret.

```sh
export TWITCH_CLIENT_ID=...
export TWITCH_CLIENT_SECRET=...
python3 scripts/preload_media.py --catalog public/assets/api --thumbnails public/assets/thumbnails
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

`/studio/` edits the site's catalog in the browser. It opens the files the
site is serving now (`Games.txt` and `Videos.txt`), so nothing needs to be
picked. Add, change or delete games and videos. When you're done, click
**Download catalog (.zip)**: it downloads both files in one archive. Upload
the two files to the server yourself, which is what makes them live. Until
then, the site keeps showing the old files.

Entering a video's ID or YouTube URL fills in its title from YouTube. The
publish date is filled in too when a YouTube Data API key is saved (the
"Fill publish dates from YouTube" panel on the Videos tab). The key is
optional, stays in that browser only, and is sent only to Google's API. Create
it in Google Cloud, enable the YouTube Data API v3, and restrict the key to
that API.

The editor reads the files and writes its download inside the page; nothing
is sent anywhere. If the site's files can't be read, the editor says why and
offers "Open" buttons, so the files can be picked by hand. Opening a file
replaces what's on screen, after a warning if there are unsaved changes.
Unsaved changes are also kept in this browser (IndexedDB), so they come back
on the next visit. That copy is temporary: the browser can delete it at any
time, so download before you leave. The page warns while there are changes
that aren't downloaded. "Forget saved copy" removes the copy.

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
`SITE_URL` is optional there.

## Docker

```sh
docker build -t playshelf .
docker run --rm -p 8080:8080 -e SITE_NAME="Some Site" -e SITE_URL=https://games.example.com \
  -v "$PWD/public/assets/api:/usr/local/apache2/htdocs/assets/api:ro" \
  -v "$PWD/public/assets/thumbnails:/usr/local/apache2/htdocs/assets/thumbnails:ro" \
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
| `SITE_NAME`        | `PlayShelf`                     | Page title, app bar, installed app; the catalog editor is "<name> Catalog editor". |
| `SITE_DESCRIPTION` | "A hand-picked collection of …" | Search results, link previews, installed app. |
| `SITE_URL`         | `https://$DOMAIN` (compose)     | The site's address, its root. Canonical link and preview image. The standalone build requires it. |

`index.html` and `manifest.webmanifest` contain `__SITE_NAME__` and
`__SITE_DESCRIPTION__` placeholders. When the container starts,
`docker-entrypoint.sh` escapes both settings for HTML and JSON, and Apache
(`site.conf`) fills them in as those files are served. Each must be one line
of text. Changing them only needs a restart, not a rebuild. The files in the
image stay read-only.

`index.html` carries the Open Graph and Twitter card tags (title, description,
name, and the preview image, a 512 px icon). `__SITE_LINKS__` in `index.html`
holds the tags that need `SITE_URL`, and is filled in the same way. Without
`SITE_URL` (local builds only, since the container and the standalone build
require it), those tags are left out.

Game pages (`?game=…`) are drawn in the browser, so search engines and link
previews see the home page's tags for every game. Per-game tags would need
pre-rendering, which the site doesn't do.

`robots.txt` lets search engines index the home page only. Game pages, the
search and letter filters (all query strings on the home address), and the
catalog editor under `/studio/` are disallowed. The editor's page also says
`noindex`, but a crawler that's disallowed never fetches that page, so the
`noindex` can't take effect while the rule is in place. The rule keeps
crawlers away from the editor; the `noindex` only matters if the rule is
removed. The app's code, the catalog and the icons stay allowed, because the
browser-drawn home page needs them to render.

### Hardening

- Runs as `www-data` on port 8080, with no Linux capabilities needed.
- Strict Content-Security-Policy (no inline scripts or styles) and the usual
  security headers, in `site.conf`. The catalog editor's own policy (in a
  `/studio/` block there) also lets it look up video titles on YouTube, and
  publish dates too when a YouTube Data API key is saved in the editor.
- Only `GET`/`HEAD`; no directory listings, `.htaccess` or dotfiles.

## Deployment

`docker-compose.yml` runs the image behind Traefik, with a read-only filesystem,
all capabilities dropped, and CPU, memory and process limits.
The catalog editor is always behind basic auth: `docker-compose.yml` requires
`PLAYSHELF_AUTH` (htpasswd users, see `.env.example`) and won't start without
it. To put the site behind the same login, add the override
`docker-compose.basic-auth.yml`. A site that shouldn't be public at all, or is
protected some other way, uses the override with its own Traefik setup.

```sh
cp .env.example .env   # set PLAYSHELF_AUTH and both data volumes; DOMAIN and EDITOR_DOMAIN default to the kostelidis.dev hosts
docker compose up -d                                                  # editor behind login, site open
docker compose -f docker-compose.yml -f docker-compose.basic-auth.yml up -d   # site and editor behind login
```

### The catalog editor's host

The catalog editor is served on its own host, `EDITOR_DOMAIN`, so that it
installs as an app beside the site. (An app installed from `DOMAIN` covers
`/studio/` too, so Chrome would open the site's app for the editor instead.)
Traefik routes both hosts to the same container: `EDITOR_DOMAIN` serves the
editor's pages and the files they load, sends any other path to `/studio/`,
and `/studio/` on `DOMAIN` moves to the editor's host. Point DNS for
`EDITOR_DOMAIN` at the same Traefik, and make sure its certificate covers it.

### Volumes

| Volume       | Mounted at (in `htdocs/`)       | Access     | Holds                    |
| ------------ | ------------------------------- | ---------- | ------------------------ |
| `data`       | `assets/api`                    | read-only  | `Games.txt`, `Videos.txt` |
| `thumbnails` | `assets/thumbnails`             | read-only  | Video thumbnails and game covers |

Each volume is your own mount: a **bind mount**, an **NFS export** or a
**CIFS/SMB share**. `data` is set by `PLAYSHELF_DATA_VOLUME_TYPE`, `_OPTIONS`
and `_DEVICE`; `thumbnails` by `PLAYSHELF_THUMBNAILS_VOLUME_TYPE`, `_OPTIONS`
and `_DEVICE`. The examples below are for `data`; `thumbnails` takes the same
forms with its own paths:

| Kind | `TYPE` | `OPTIONS`                                                           | `DEVICE`                        |
| ---- | ------ | ------------------------------------------------------------------- | ------------------------------- |
| Bind | `none` | `bind`                                                              | `/srv/playshelf/data`           |
| NFS  | `nfs`  | `addr=192.168.1.10,nfsvers=4,ro`                                    | `:/export/playshelf/data`       |
| CIFS | `cifs` | `addr=192.168.1.10,username=…,password=…,vers=3.0,uid=82,gid=82,ro` | `//192.168.1.10/playshelf/data` |

- The container runs as uid/gid 82 (`www-data`) and only reads its volumes, so
  they must be readable by uid 82. For a bind mount, the directory must already
  exist. For NFS, the export must let uid 82 read.
- The Docker host mounts NFS and CIFS shares, so it needs `nfs-common` /
  `nfs-utils` or `cifs-utils`. For CIFS, `addr` must be an IP address and the
  password can't contain commas.
- Docker keeps a volume's settings once it's created. After changing them,
  run `docker compose down`, then `docker volume rm <INSTANCE_NAME>-data`
  (or `-thumbnails`), then `docker compose up -d`.

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
   YouTube's thumbnail. `scripts/preload_media.py` makes both on any machine (see
   [Preloading pictures](#preloading-pictures)).

To update, upload a newer zip's contents over the old ones. The zips contain
no catalog or thumbnails, so the uploaded ones stay.

To build a standalone site locally, with any name and description:

```sh
npm run build
SITE_NAME="Some Site" SITE_DESCRIPTION="..." SITE_URL=https://some.example.org npm run standalone -- standalone/some-site
```

## Project layout

```
build/                 Build-time helpers: CSP, service worker shell, version, site settings, standalone build
public/                Static files: icons, web manifest, demo catalog (plus a local, git-ignored one)
src/components/        React components (and, in halloween/, the Halloween artwork)
src/hooks/             React hooks
src/lib/               Pure logic: catalog and CSV parsing, routing, pagination, text, the editor's rules, Halloween date and spell
src/studio/            The catalog editor at /studio/
src/sw/                Service workers (offline support): the site's, and the catalog editor's
src/ui/                Browser helpers: brand, version, tint, SW registration, Halloween shriek, saving a file
studio/                The catalog editor's HTML entry (a second page of the same build)
site.conf              Apache config: headers, caching, site settings, demo catalog
Dockerfile             Builds and tests the site, then serves it from httpd
docker-compose.yml     Runs the image behind Traefik; the editor requires basic auth
docker-compose.basic-auth.yml   Override for docker-compose.yml: basic auth for the site too
.env.example           Every setting for the compose files, with its default
CLAUDE.md              Notes for Claude Code: commands, invariants, conventions
docker-entrypoint.sh   Escapes the site settings for the page and the web manifest
scripts/               Tools the maintainer runs on their own machine, never in the image:
                       preload_media.py (game covers from Twitch, video thumbnails from
                       YouTube), migrate_catalog.py (the old single-file catalog to the
                       two files), requirements.txt (Pillow)
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
