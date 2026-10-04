#!/usr/bin/env sh
# Bootstraps .env files and starts the full tbm stack.
# Usage: ./start.sh [extra docker compose up args, e.g. -d]
set -e
cd "$(dirname "$0")"
sh ./scripts/init-env.sh
docker compose up --build "$@"
