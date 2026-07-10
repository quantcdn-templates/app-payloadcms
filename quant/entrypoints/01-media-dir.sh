#!/bin/bash
set -e

MEDIA_DIR="${MEDIA_DIR:-/data/media}"

mkdir -p "$MEDIA_DIR"

# Recursive chown is expensive on large EFS-backed media libraries, so only
# run it when ownership is actually wrong (e.g. first boot or a new volume).
if [ "$(stat -c %U "$MEDIA_DIR" 2>/dev/null)" != "node" ]; then
  chown -R node:node "$(dirname "$MEDIA_DIR")"
fi

echo "payloadcms: media directory ready at ${MEDIA_DIR}"
