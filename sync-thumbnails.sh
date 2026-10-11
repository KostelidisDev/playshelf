#!/bin/sh
# Downloads YouTube's thumbnail for every video in videos.csv that doesn't
# have one here, and stores it as <video_id>.webp: the file the site asks
# for, and smaller than YouTube's JPEG. docker-entrypoint.sh runs it in the
# background. Until a thumbnail is here, the site shows YouTube's own
# (i.ytimg.com), so it never waits for this.
#
# Runs again every THUMBNAILS_SYNC_INTERVAL seconds (0: only once), so new
# rows in videos.csv get their thumbnails without a restart.
set -u

HTDOCS=/usr/local/apache2/htdocs
CATALOG=${THUMBNAILS_CSV:-$HTDOCS/assets/api/videos.csv}
# What the site serves while the catalog volume has no videos.csv (site.conf).
DEMO_CSV=$HTDOCS/assets/demo/videos.csv
DIR=${THUMBNAILS_DIR:-$HTDOCS/assets/thumbnails}
INTERVAL=${THUMBNAILS_SYNC_INTERVAL:-3600}
WIDTH=${THUMBNAILS_WIDTH:-640}
QUALITY=${THUMBNAILS_QUALITY:-80}
JOBS=${THUMBNAILS_JOBS:-4}

log() { echo "sync-thumbnails: $*" >&2; }

# One video's thumbnail: the 16:9 maxres JPEG, or the 4:3 hq one with its
# letterbox bars cropped off (not every video has a maxres one). It's
# written to a hidden .part file first and then renamed, so the site never
# serves a half-written file (Apache refuses dotfiles and .part files).
fetch() {
  id=$1
  src=$(mktemp) || return 1
  part="$DIR/.$id.webp.part"
  if wget -q -T 20 -O "$src" "https://i.ytimg.com/vi/$id/maxresdefault.jpg"; then
    set -- -resize "$WIDTH" 0
  elif wget -q -T 20 -O "$src" "https://i.ytimg.com/vi/$id/hqdefault.jpg"; then
    set -- -crop 0 45 480 270
    [ "$WIDTH" -lt 480 ] && set -- "$@" -resize "$WIDTH" 0
  else
    log "$id: no thumbnail on YouTube"
    rm -f "$src"
    return 0
  fi
  if ! { cwebp -quiet -mt -q "$QUALITY" "$@" "$src" -o "$part" && mv -f "$part" "$DIR/$id.webp"; }; then
    log "$id: conversion failed"
    rm -f "$part"
  fi
  rm -f "$src"
}

# The video ids in the first column, skipping the header and anything that
# isn't an 11-character YouTube id (the site makes the same check), so a
# crafted row can't point a request or a file path anywhere else.
ids() {
  tail -n +2 "$CSV" | cut -d, -f1 | tr -d '"\r ' | grep -E '^[A-Za-z0-9_-]{11}$' | sort -u
}

# The ids that have no thumbnail here.
missing() {
  ids | while read -r id; do
    [ -e "$DIR/$id.webp" ] || echo "$id"
  done
}

# One pass: downloads every missing thumbnail, a few at a time.
sync_once() {
  CSV=$CATALOG
  if [ ! -r "$CSV" ]; then
    log "no $CATALOG; using the demo catalog"
    CSV=$DEMO_CSV
  fi
  if [ ! -r "$CSV" ]; then
    log "no $CSV; skipping"
    return
  fi
  if [ ! -w "$DIR" ]; then
    log "$DIR is not writable; skipping"
    return
  fi
  rm -f "$DIR"/.*.webp.part
  todo=$(missing)
  [ -n "$todo" ] || return 0
  log "downloading $(echo "$todo" | wc -l) missing thumbnail(s)"
  echo "$todo" | xargs -n 1 -P "$JOBS" "$0" fetch
  left=$(missing | wc -l)
  log "done; $left still missing"
}

# xargs runs this script again as `sync-thumbnails.sh fetch <id>`, once per
# video.
case "${1:-}" in
  fetch) fetch "$2"; exit ;;
esac

for value in "$INTERVAL" "$WIDTH" "$QUALITY" "$JOBS"; do
  case "$value" in
    '' | *[!0-9]*) log "THUMBNAILS_* settings must be whole numbers; not syncing"; exit 1 ;;
  esac
done

while :; do
  sync_once
  [ "$INTERVAL" -gt 0 ] || exit 0
  sleep "$INTERVAL"
done
