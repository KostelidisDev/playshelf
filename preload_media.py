#!/usr/bin/env python3
"""Preloads the pictures the site shows, so they don't wait for a visitor.

For every game in Games.txt it fetches the game's cover (box art) from the
Twitch API, and for every video in Videos.txt its YouTube thumbnail. Both are
stored as WebP, where the site looks for them:

    <thumbnails>/<video_id>.webp        video thumbnails
    <thumbnails>/games/<game_id>.webp   game covers

Pictures that are already there are skipped, so the script can be run again
after the catalog changes. It runs on your own machine, not in the container:
the Twitch client secret must stay out of the site.

    pip install pillow
    export TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=...   # https://dev.twitch.tv/console
    python3 preload_media.py --catalog public/assets/api --thumbnails public/assets/thumbnails

--dry-run lists what would be fetched, with no network access. --no-covers
or --no-thumbnails leave one kind out. --force fetches again.

Twitch: a game is looked up by its title (Get Games, by exact name); when
that finds nothing, Search Categories is tried and only an exact,
case-insensitive name match is taken. The client credentials come from the
environment and are never written to disk.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

GAME_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
ALLOWED_HOSTS = {"static-cdn.jtvnw.net", "i.ytimg.com"}
MAX_DOWNLOAD = 10 * 1024 * 1024
THUMBNAIL_WIDTH = 640
THUMBNAIL_QUALITY = 80
COVER_SIZE = (570, 760)  # Twitch's box art, 2x the 285x380 the site shows.
COVER_QUALITY = 85
USER_AGENT = "playshelf-preload/1.0"


@dataclass(frozen=True)
class Game:
    id: str
    title: str


@dataclass(frozen=True)
class Video:
    id: str
    game_ids: tuple[str, ...]


def read_rows(path: Path, columns: tuple[str, ...]) -> list[dict[str, str]]:
    """The rows of a catalog file. A byte order mark is allowed; a missing
    column is an error, as the site treats it."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in columns if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"{path.name} is missing column(s): {', '.join(missing)}")
        return list(reader)


def read_games(path: Path) -> list[Game]:
    games: dict[str, Game] = {}
    for row in read_rows(path, ("game_id", "title")):
        game_id, title = row["game_id"].strip(), " ".join(row["title"].split())
        if GAME_ID.match(game_id) and title and game_id not in games:
            games[game_id] = Game(game_id, title)
    return list(games.values())


def read_videos(path: Path) -> list[Video]:
    videos: dict[str, Video] = {}
    for row in read_rows(path, ("video_id", "title", "published_at", "game_ids")):
        video_id = row["video_id"].strip()
        game_ids = tuple(dict.fromkeys(g.strip() for g in row["game_ids"].split(";") if g.strip()))
        if VIDEO_ID.match(video_id) and video_id not in videos:
            videos[video_id] = Video(video_id, game_ids)
    return list(videos.values())


def check_url(url: str) -> None:
    """Only the two image hosts the site uses, over https."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"refusing to download {url}")


def download(url: str) -> bytes:
    """The body of a URL, or raises HTTPError (404 is how YouTube says a
    video has no maxres thumbnail)."""
    check_url(url)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(MAX_DOWNLOAD + 1)
    if len(data) > MAX_DOWNLOAD:
        raise ValueError(f"{url} is larger than {MAX_DOWNLOAD} bytes")
    return data


def write_webp(image_bytes: bytes, target: Path, crop=None, width: int | None = None, quality: int = 80) -> None:
    """Converts a picture to WebP at `target`, through a .part file first so
    the site never serves a half-written image."""
    from PIL import Image  # Pillow: the only dependency beyond Python itself.

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if crop is not None:
        image = image.crop(crop)
    if width is not None and image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name("." + target.name + ".part")
    image.save(part, "WEBP", quality=quality)
    part.replace(target)


class Twitch:
    """The Twitch Helix API with an app access token (client credentials)."""

    TOKEN_URL = "https://id.twitch.tv/oauth2/token"
    API = "https://api.twitch.tv/helix"

    def __init__(self, client_id: str, client_secret: str) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.token: str | None = None

    def _token(self) -> str:
        if self.token is None:
            form = urllib.parse.urlencode({
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials",
            }).encode()
            request = urllib.request.Request(self.TOKEN_URL, data=form, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=30) as response:
                self.token = json.load(response)["access_token"]
        return self.token

    def _get(self, path: str, params: dict[str, str]) -> list[dict]:
        url = f"{self.API}/{path}?{urllib.parse.urlencode(params)}"
        headers = {"Client-Id": self.client_id, "Authorization": f"Bearer {self._token()}"}
        for attempt in range(3):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **headers})
                with urllib.request.urlopen(request, timeout=30) as response:
                    return json.load(response).get("data", [])
            except urllib.error.HTTPError as error:
                if error.code != 429 or attempt == 2:
                    raise
                time.sleep(5)  # Rate limited: wait a little, then try again.
        return []

    def box_art(self, title: str) -> str | None:
        """The box art URL of the game with exactly this title, or None."""
        matches = self._get("games", {"name": title})
        if not matches:
            wanted = title.casefold()
            matches = [c for c in self._get("search/categories", {"query": title}) if c.get("name", "").casefold() == wanted]
        if not matches:
            return None
        template = matches[0].get("box_art_url") or ""
        return template.replace("{width}", str(COVER_SIZE[0])).replace("{height}", str(COVER_SIZE[1])) or None


def fetch_covers(games: list[Game], out: Path, twitch: Twitch, force: bool) -> list[str]:
    failures = []
    for game in games:
        target = out / "games" / f"{game.id}.webp"
        if target.exists() and not force:
            continue
        try:
            url = twitch.box_art(game.title)
            if url is None:
                failures.append(f"cover {game.id}: no Twitch game called {game.title!r}")
                continue
            write_webp(download(url), target, quality=COVER_QUALITY)
            print(f"cover {game.id}: saved")
        except (OSError, ValueError, KeyError) as error:
            failures.append(f"cover {game.id}: {error}")
        time.sleep(0.15)  # Stays well under Twitch's request limit.
    return failures


def fetch_thumbnail(video_id: str, out: Path) -> None:
    """YouTube's 16:9 maxres picture, or the 4:3 hq one with its letterbox
    bars cropped off (not every video has a maxres one)."""
    try:
        data = download(f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg")
        write_webp(data, out / f"{video_id}.webp", width=THUMBNAIL_WIDTH, quality=THUMBNAIL_QUALITY)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        data = download(f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg")
        write_webp(data, out / f"{video_id}.webp", crop=(0, 45, 480, 315), width=THUMBNAIL_WIDTH, quality=THUMBNAIL_QUALITY)


def fetch_thumbnails(videos: list[Video], out: Path, force: bool) -> list[str]:
    failures = []
    for video in videos:
        if (out / f"{video.id}.webp").exists() and not force:
            continue
        try:
            fetch_thumbnail(video.id, out)
            print(f"thumbnail {video.id}: saved")
        except (OSError, ValueError) as error:
            failures.append(f"thumbnail {video.id}: {error}")
    return failures


def pillow_installed() -> bool:
    """Pillow converts the pictures to WebP. It's checked up front, so a
    missing install stops the run before any download, not on the first
    picture."""
    try:
        import PIL  # noqa: F401
    except ImportError:
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--catalog", type=Path, default=Path("public/assets/api"), help="folder with Games.txt and Videos.txt")
    parser.add_argument("--thumbnails", type=Path, default=Path("public/assets/thumbnails"), help="folder for the WebP pictures")
    parser.add_argument("--no-covers", action="store_true", help="skip the Twitch game covers")
    parser.add_argument("--no-thumbnails", action="store_true", help="skip the video thumbnails")
    parser.add_argument("--force", action="store_true", help="fetch pictures that are already there")
    parser.add_argument("--dry-run", action="store_true", help="list what would be fetched; no network")
    args = parser.parse_args(argv)

    writes_pictures = not args.dry_run and not (args.no_covers and args.no_thumbnails)
    if writes_pictures and not pillow_installed():
        print(
            "Warning: Pillow is not installed, so the pictures can't be converted to WebP.\n"
            "Install it with `pip install pillow` (or `pip install -r requirements.txt`),\n"
            "or use --dry-run to list what would be fetched.",
            file=sys.stderr,
        )
        return 2

    games = read_games(args.catalog / "Games.txt")
    videos = read_videos(args.catalog / "Videos.txt")
    print(f"{len(games)} game(s), {len(videos)} video(s)")

    failures: list[str] = []
    if not args.no_covers:
        if args.dry_run:
            todo = [g for g in games if args.force or not (args.thumbnails / "games" / f"{g.id}.webp").exists()]
            print(f"would fetch {len(todo)} cover(s) from Twitch")
        else:
            client_id, secret = os.environ.get("TWITCH_CLIENT_ID", ""), os.environ.get("TWITCH_CLIENT_SECRET", "")
            if not client_id or not secret:
                print("Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET for the covers, or pass --no-covers.", file=sys.stderr)
                return 2
            failures += fetch_covers(games, args.thumbnails, Twitch(client_id, secret), args.force)

    if not args.no_thumbnails:
        if args.dry_run:
            todo = [v for v in videos if args.force or not (args.thumbnails / f"{v.id}.webp").exists()]
            print(f"would fetch {len(todo)} thumbnail(s) from YouTube")
        else:
            failures += fetch_thumbnails(videos, args.thumbnails, args.force)

    for failure in failures:
        print(failure, file=sys.stderr)
    if failures:
        print(f"{len(failures)} failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
