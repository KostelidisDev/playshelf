#!/usr/bin/env python3
"""Converts the old one-file catalog to the current two files.

The old catalog was one CSV, videos.csv, with the game as its title:

    video_id,title,published_at,game_title

The current catalog is Games.txt (game_id,title) and Videos.txt
(video_id,title,published_at,game_ids), where a game has an id of its own
and a video can belong to several games. This script reads the old file and
writes the new pair, applying the rules the site and the studio use
(src/lib/catalog.ts, src/lib/studio.ts), so the output loads without
warnings.

- Game ids are made from titles as the studio makes them (newGameId):
  lowercase, no accents, words joined by "-", and -2, -3 added on a clash.
- Titles that differ only by case are one game, as the studio treats them.
  The first spelling wins.
- Only games that still have a video are written, as the old site only
  listed games that had videos.
- A video with an invalid id, or with no game title, can't be written in the
  new format, so it is left out. A repeated video id keeps its first row. A
  date that isn't ISO 8601 is left blank. Each of these is listed in the
  report, not dropped quietly.

Input and output live in migration/ by default, which git and Docker ignore:
the catalog is the maintainer's own data, and the output is copied into
public/assets/api/ by hand. The script refuses to overwrite existing output
unless --force is given.

    python3 migrate_catalog.py                       # migration/videos.csv -> migration/
    python3 migrate_catalog.py old.csv out-dir --force
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

OLD_COLUMNS = ("video_id", "title", "published_at", "game_title")
GAME_COLUMNS = ("game_id", "title")
VIDEO_COLUMNS = ("video_id", "title", "published_at", "game_ids")
MAX_GAME_TITLE = 150
MAX_VIDEO_TITLE = 200
MAX_GAME_ID = 56  # newGameId cuts slugs here, so -2, -3 still fit in 64.
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Control characters, and the bidi marks cleanText in src/lib/text.ts removes.
CONTROL = re.compile("[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩؜]")
DEFAULT_INPUT = "migration/videos.csv"
DEFAULT_OUTPUT = "migration"
REPORT_NAME = "migration-report.txt"


def clean(value: str | None, max_length: int) -> str:
    """Text with control and bidi characters removed and whitespace collapsed,
    cut to max_length, as cleanText does."""
    text = CONTROL.sub(" ", value or "")
    return " ".join(text.split())[:max_length].strip()


def sort_time(text: str) -> float | None:
    """The moment an ISO 8601 date or timestamp names, or None when it isn't
    one. A date alone is midnight UTC here; only the order matters, not the
    zone. Used for both the validity check and the newest-first sort."""
    if DATE_ONLY.match(text):
        try:
            return datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            return None
    try:
        moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.timestamp()


def new_game_id(title: str, taken: set[str]) -> str:
    """The id for a game, made as the studio makes it (newGameId in
    src/lib/studio.ts): lowercase, no accents, words joined by "-", and a
    number added when the id is taken."""
    decomposed = unicodedata.normalize("NFD", title)
    plain = "".join(ch for ch in decomposed if not unicodedata.category(ch).startswith("M"))
    slug = re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:MAX_GAME_ID].rstrip("-") or "game"
    if slug not in taken:
        return slug
    n = 2
    while f"{slug}-{n}" in taken:
        n += 1
    return f"{slug}-{n}"


@dataclass
class Video:
    id: str
    title: str
    published_at: str
    game_id: str


def read_old(path: Path) -> list[tuple[int, dict[str, str]]]:
    """The old rows with their 1-based data row numbers. A BOM is accepted."""
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        header = reader.fieldnames or []
        missing = [column for column in OLD_COLUMNS if column not in header]
        if missing:
            sys.exit(f"{path} is missing column(s): {', '.join(missing)}.")
        return [(number, row) for number, row in enumerate(reader, start=1)]


def convert(rows: list[tuple[int, dict[str, str]]]) -> tuple[list[tuple[str, str]], list[Video], list[str]]:
    """Returns the games as (id, title), the videos, and the report lines."""
    report: list[str] = []
    games_by_key: dict[str, tuple[str, str]] = {}  # lowercase title -> (id, first spelling)
    spellings: dict[str, set[str]] = {}
    taken: set[str] = set()
    videos: list[Video] = []
    seen: set[str] = set()

    for number, row in rows:
        where = f"row {number}"
        video_id = (row.get("video_id") or "").strip()
        game_title = clean(row.get("game_title"), MAX_GAME_TITLE)

        if not VIDEO_ID.match(video_id):
            report.append(f"skipped {where}: video_id {video_id!r} isn't an 11-character YouTube id")
            continue
        if video_id in seen:
            report.append(f"skipped {where}: duplicate video_id {video_id}; the first row is kept")
            continue
        if not game_title:
            report.append(f"skipped {where}: {video_id} has no game_title, and every video needs a game")
            continue

        published = (row.get("published_at") or "").strip()
        if published and sort_time(published) is None:
            report.append(f"{where}: published_at {published!r} isn't ISO 8601; left blank")
            published = ""

        seen.add(video_id)
        key = game_title.lower()
        if key not in games_by_key:
            game_id = new_game_id(game_title, taken)
            taken.add(game_id)
            games_by_key[key] = (game_id, game_title)
            spellings[key] = {game_title}
        else:
            spellings[key].add(game_title)
        game_id = games_by_key[key][0]

        videos.append(Video(
            id=video_id,
            title=clean(row.get("title"), MAX_VIDEO_TITLE) or video_id,
            published_at=published,
            game_id=game_id,
        ))

    for key, names in spellings.items():
        if len(names) > 1:
            first = games_by_key[key][1]
            others = ", ".join(sorted(f"{name!r}" for name in names if name != first))
            report.append(f"merged game titles {others} into {first!r}")

    games = sorted(games_by_key.values(), key=lambda game: game[1].casefold())
    videos.sort(key=lambda video: sort_time(video.published_at) or float("-inf"), reverse=True)
    return games, videos, report


def write(path: Path, columns: tuple[str, ...], rows: list[list[str]]) -> None:
    """A CSV the way the studio writes it: a byte order mark (so Excel reads
    UTF-8), CRLF line ends, and quotes only where a field needs them."""
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", nargs="?", default=DEFAULT_INPUT, type=Path, help=f"the old videos.csv (default: {DEFAULT_INPUT})")
    parser.add_argument("output", nargs="?", default=DEFAULT_OUTPUT, type=Path, help=f"folder for Games.txt and Videos.txt (default: {DEFAULT_OUTPUT})")
    parser.add_argument("--force", action="store_true", help="overwrite existing output files")
    args = parser.parse_args()

    if not args.input.is_file():
        sys.exit(f"No such file: {args.input}")
    args.output.mkdir(parents=True, exist_ok=True)
    outputs = [args.output / name for name in ("Games.txt", "Videos.txt", REPORT_NAME)]
    existing = [path for path in outputs if path.exists()]
    if existing and not args.force:
        sys.exit(f"Already exists (use --force to overwrite): {', '.join(str(path) for path in existing)}")

    games, videos, report = convert(read_old(args.input))
    if not videos:
        sys.exit("No usable videos; nothing written.")

    write(outputs[0], GAME_COLUMNS, [[game_id, title] for game_id, title in games])
    write(outputs[1], VIDEO_COLUMNS, [[v.id, v.title, v.published_at, v.game_id] for v in videos])
    summary = f"{len(videos)} video(s) and {len(games)} game(s) written; {len(report)} note(s) below."
    outputs[2].write_text("\n".join([summary, *report]) + "\n", encoding="utf-8")

    print(summary)
    for line in report:
        print(f"  {line}")
    print(f"Wrote {outputs[0]}, {outputs[1]} and {outputs[2]}")


if __name__ == "__main__":
    main()
