#!/bin/sh
# The container's entrypoint. It escapes CHANNEL_NAME for HTML and for JSON
# (Apache can't), for site.conf to put into index.html and the web manifest
# as they're served. Then it starts the thumbnail sync in the background,
# unless THUMBNAILS_SYNC=false, and runs the given command
# (httpd-foreground by default).
#
# Both forms also escape "|" (the Substitute delimiter) and "\", so the name
# can't break out of the directive in site.conf.
set -eu

name=$(printf '%s' "${CHANNEL_NAME:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
if [ -z "$name" ]; then
  echo "CHANNEL_NAME must be set" >&2
  exit 1
fi
if printf '%s' "$name" | grep -q '[[:cntrl:]]'; then
  echo "CHANNEL_NAME must be a single line of text" >&2
  exit 1
fi

CHANNEL_NAME_HTML=$(printf '%s' "$name" | sed \
  -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' \
  -e "s/'/\\&#39;/g" -e 's/|/\&#124;/g' -e 's/\\/\&#92;/g')
CHANNEL_NAME_JSON=$(printf '%s' "$name" | sed \
  -e 's/\\/\\u005c/g' -e 's/"/\\u0022/g' -e 's/|/\\u007c/g')
export CHANNEL_NAME_HTML CHANNEL_NAME_JSON

if [ "${THUMBNAILS_SYNC:-true}" != false ]; then
  sync-thumbnails.sh &
fi

exec "$@"
