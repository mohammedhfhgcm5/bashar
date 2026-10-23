#!/bin/bash
set -euo pipefail

export POSTGRES_USER="${POSTGRES_USER:-damage}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-damage}"
export POSTGRES_DB="${POSTGRES_DB:-damage}"
export PGDATA="${PGDATA:-/data/postgres}"
export PORT="${PORT:-8080}"
export API_PORT=3000
export NODE_ENV="${NODE_ENV:-production}"
export UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
export VISION_MODEL_PATH="${VISION_MODEL_PATH:-/models/peccd-yolov8n.onnx}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:${PORT}}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-dev-access-secret-change-me-please-32b}"
export JWT_REFRESH_PEPPER="${JWT_REFRESH_PEPPER:-dev-refresh-pepper-change-me-please-32}"
export BOOTSTRAP_SUPERVISOR_EMAIL="${BOOTSTRAP_SUPERVISOR_EMAIL:-supervisor@damage.local}"
export BOOTSTRAP_SUPERVISOR_PASSWORD="${BOOTSTRAP_SUPERVISOR_PASSWORD:-change-me-now}"
export BOOTSTRAP_SUPERVISOR_NAME="${BOOTSTRAP_SUPERVISOR_NAME:-مشرف النظام}"
export BOOTSTRAP_SUPERVISOR_PHONE="${BOOTSTRAP_SUPERVISOR_PHONE:-0900000000}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?schema=public"

mkdir -p "$PGDATA" "$UPLOAD_DIR" /models
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

python3 --version
if [ -f "$VISION_MODEL_PATH" ]; then
  echo "vision model ready: $VISION_MODEL_PATH"
else
  echo "vision model missing: $VISION_MODEL_PATH"
fi

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/app.conf
nginx

docker-entrypoint.sh postgres &
POSTGRES_PID=$!

cleanup() {
  nginx -s quit 2>/dev/null || true
  kill "$POSTGRES_PID" 2>/dev/null || true
  wait "$POSTGRES_PID" 2>/dev/null || true
}
trap 'cleanup; exit 0' TERM INT

ready=0
for _ in $(seq 1 90); do
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
    echo "postgres stopped during startup" >&2
    exit 1
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "postgres was not ready in time" >&2
  exit 1
fi

cd /app/apps/api
attempt=0
until /app/node_modules/.bin/prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "migrations failed" >&2
    exit 1
  fi
  echo "waiting for database"
  sleep 2
done

node dist/main.js &
API_PID=$!
set +e
wait "$API_PID"
code=$?
set -e
cleanup
exit "$code"
