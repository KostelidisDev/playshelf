#!/bin/sh
# The container's entrypoint. It escapes SITE_NAME and SITE_DESCRIPTION for
# HTML and for JSON (Apache can't), for site.conf to put into index.html and
# the web manifest as they're served. Then it runs the given command
# (httpd-foreground by default).
#
# Both forms also escape "|" (the Substitute delimiter) and "\", so a value
# can't break out of the directive in site.conf.
set -eu

# The setting named $1 with value $2, trimmed; it must be one line of text.
setting() {
  value=$(printf '%s' "$2" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  if [ -z "$value" ]; then
    echo "$1 must be set" >&2
    exit 1
  fi
  if printf '%s' "$value" | grep -q '[[:cntrl:]]'; then
    echo "$1 must be a single line of text" >&2
    exit 1
  fi
  printf '%s' "$value"
}

html() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' \
    -e "s/'/\\&#39;/g" -e 's/|/\&#124;/g' -e 's/\\/\&#92;/g'
}

json() {
  printf '%s' "$1" | sed -e 's/\\/\\u005c/g' -e 's/"/\\u0022/g' -e 's/|/\\u007c/g'
}

name=$(setting SITE_NAME "${SITE_NAME:-}")
description=$(setting SITE_DESCRIPTION "${SITE_DESCRIPTION:-}")
SITE_NAME_HTML=$(html "$name")
SITE_NAME_JSON=$(json "$name")
SITE_DESCRIPTION_HTML=$(html "$description")
SITE_DESCRIPTION_JSON=$(json "$description")

# SITE_URL is required: the site's root address, http or https, with no
# query or fragment, which gets a trailing slash. The link tags that need it
# (canonical, og:url, og:image) are built here, on one line, with single
# quotes, as site.conf's Substitute directive needs them (build/site.ts
# makes the same ones for the local builds).
url=$(printf '%s' "${SITE_URL:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
if [ -z "$url" ]; then
  echo "SITE_URL must be set to the site's address, e.g. https://games.example.com" >&2
  exit 1
fi
if ! printf '%s' "$url" | grep -Eq '^https?://[^[:space:]"<>|$\\?#]+$'; then
  echo "SITE_URL must be an http or https address of the site's root, e.g. https://games.example.com" >&2
  exit 1
fi
url="$(printf '%s' "$url" | sed -e 's:/*$::')/"
root=$(html "$url")
image="${root}assets/icons/icon-512.png"
SITE_LINKS_HTML="<link rel='canonical' href='$root'> <meta property='og:url' content='$root'> <meta property='og:image' content='$image'> <meta property='og:image:width' content='512'> <meta property='og:image:height' content='512'> <meta name='twitter:image' content='$image'>"
export SITE_NAME_HTML SITE_NAME_JSON SITE_DESCRIPTION_HTML SITE_DESCRIPTION_JSON SITE_LINKS_HTML

exec "$@"
