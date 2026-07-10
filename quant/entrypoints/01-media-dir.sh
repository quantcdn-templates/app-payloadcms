#!/bin/bash
set -e

MEDIA_DIR="${MEDIA_DIR:-/data/media}"

mkdir -p "$MEDIA_DIR"
chown -R node:node "$(dirname "$MEDIA_DIR")"

echo "payloadcms: media directory ready at ${MEDIA_DIR}"
