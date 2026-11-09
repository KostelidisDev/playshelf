# syntax=docker/dockerfile:1

# docker build -t ghcr.io/kostelidisdev/playshelf:latest .

# Build stage: type-checks, tests and builds the app into dist/. It runs on
# the build host's own platform: the output is static files, the same for
# every target architecture, so nothing needs emulating.
# The build version (v<year>.<month>.<day>-build<HHMMSS>) comes from the
# build host's clock in BUILD_TZ, unless BUILD_VERSION sets it.
FROM --platform=$BUILDPLATFORM node:26.13.0-alpine3.24 AS build
ARG BUILD_TZ=Europe/Athens
ARG BUILD_VERSION=""
RUN apk add --no-cache tzdata
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test
RUN APP_VERSION="${BUILD_VERSION:-"$(TZ="$BUILD_TZ" date +'v%Y.%m.%d-build%H%M%S')"}" \
    && export APP_VERSION \
    && npm run build \
    && echo "Built version $APP_VERSION"

FROM httpd:2.4.69-alpine3.24

# - Turn on compression, cache headers, placeholder substitution (the
#   site's name and description) and rewrites (the demo catalog)
# - Listen on 8080: an unprivileged user can't bind ports below 1024
# - Hide the Apache version in headers and error pages
# - Keep the PID file and runtime files in /tmp, since www-data can't write
#   to the root-owned logs/ directory
RUN sed -i \
      -e 's/^#\(LoadModule deflate_module\)/\1/' \
      -e 's/^#\(LoadModule expires_module\)/\1/' \
      -e 's/^#\(LoadModule substitute_module\)/\1/' \
      -e 's/^#\(LoadModule rewrite_module\)/\1/' \
      -e 's/^Listen 80$/Listen 8080/' \
      -e '$a ServerTokens Prod' \
      -e '$a ServerSignature Off' \
      -e '$a PidFile /tmp/httpd.pid' \
      -e '$a DefaultRuntimeDir /tmp' \
      -e '$a Include conf/extra/site.conf' \
      conf/httpd.conf

# The site's files stay owned by root: Apache can read them, not change them.
COPY site.conf conf/extra/site.conf
COPY --link --from=build /app/dist/ htdocs/

# Mount point for the catalog, which isn't part of the image
# (docker-compose.yml). Nothing in the container writes to it.
RUN mkdir -p htdocs/assets/api

# The site's name (page title, app bar, installed app) and description
# (search results, link previews, installed app), read when the container
# starts, so changing them needs no rebuild (docker run -e SITE_NAME=...).
ENV SITE_NAME=PlayShelf \
    SITE_DESCRIPTION="A hand-picked collection of YouTube videos, from any creator, grouped by game."
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/

# www-data (uid 82) comes with Alpine. As a non-root user, the container
# needs no capabilities at all, and Apache skips its usual switch from root.
USER www-data

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["httpd-foreground"]

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
