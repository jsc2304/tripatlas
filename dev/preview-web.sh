#!/usr/bin/env bash
# Launch wrapper for the preview harness: injects the dev env (DB URL, timezone,
# and the initial admin password used for automated M5 verification).
set -euo pipefail
export DATABASE_URL="${DATABASE_URL:-postgres://tripatlas:tripatlas@localhost:5432/tripatlas}"
export APP_TIMEZONE="${APP_TIMEZONE:-Europe/Zurich}"
export INITIAL_ADMIN_PASSWORD="${INITIAL_ADMIN_PASSWORD:-test1234}"
cd "$(dirname "$0")/.."
exec pnpm --filter @tripatlas/web dev
