#!/bin/bash
set -e

# Persist Next.js's cache across deploys and restarts.
#
# Next writes optimised images to <distDir>/cache/images and its data/fetch
# caches alongside them, all under /app/.next/cache — the container's writable
# layer. Every deploy, restart or task replacement discards it, so every image
# is re-optimised with sharp on first request (seconds of CPU per transform on
# a small task, for output that was already computed).
#
# Pointing that directory at the persistent volume keeps the caches warm across
# deploys. Opt out with NEXT_CACHE_PERSIST=false.
#
# NOTE: assumes a single running task. With multiple replicas they share one
# cache directory over the volume; Next writes cache entries per-file so this
# is tolerable, but it has not been load-tested here.

if [ "${NEXT_CACHE_PERSIST:-true}" != "true" ]; then
  echo "payload: Next cache persistence disabled (NEXT_CACHE_PERSIST=false)"
  exit 0
fi

# Default alongside MEDIA_DIR on the same persistent volume.
PERSIST_DIR="${NEXT_CACHE_DIR:-/data/next-cache}"
APP_CACHE_DIR=/app/.next/cache

# Only persist when the target is on a mounted volume; otherwise this would
# just move the cache to another ephemeral path and imply a guarantee we cannot
# keep.
VOLUME_ROOT="$(dirname "$PERSIST_DIR")"
if ! mountpoint -q "$VOLUME_ROOT" 2>/dev/null && [ ! -d "$VOLUME_ROOT" ]; then
  echo "payload: ${VOLUME_ROOT} is not available — leaving Next cache on ephemeral storage"
  exit 0
fi

mkdir -p "$PERSIST_DIR"

# Swap the build-time cache directory for a symlink to the volume, preserving
# anything the build baked in.
if [ -d "$APP_CACHE_DIR" ] && [ ! -L "$APP_CACHE_DIR" ]; then
  cp -a "$APP_CACHE_DIR/." "$PERSIST_DIR/" 2>/dev/null || true
  rm -rf "$APP_CACHE_DIR"
fi

mkdir -p "$(dirname "$APP_CACHE_DIR")"
ln -sfn "$PERSIST_DIR" "$APP_CACHE_DIR"

chown -R node:node "$PERSIST_DIR" 2>/dev/null || true
chown -h node:node "$APP_CACHE_DIR" 2>/dev/null || true

echo "payload: Next cache persisted at ${PERSIST_DIR} (linked from ${APP_CACHE_DIR})"
