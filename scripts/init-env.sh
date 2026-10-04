#!/usr/bin/env sh
# Creates missing .env files (root, backend, frontend) from their .env.example templates.
# Existing .env files are never overwritten.
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

for dir in "$ROOT_DIR" "$ROOT_DIR/backend" "$ROOT_DIR/frontend"; do
  if [ ! -f "$dir/.env" ] && [ -f "$dir/.env.example" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "Created $dir/.env from .env.example"
  fi
done
