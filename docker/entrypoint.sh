#!/bin/bash
set -euo pipefail

export POSTGRES_USER="${POSTGRES_USER:-damage}"
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  export POSTGRES_PASSWORD=damage
fi
export POSTGRES_DB="${POSTGRES_DB:-damage}"
export PGDATA="${PGDATA:-/data/postgres}"
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"
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
urlencode() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}
external_db=0
if [ -n "${DATABASE_URL:-}" ]; then
  external_db=1
  DATABASE_URL="${DATABASE_URL//&channel_binding=require/}"
  DATABASE_URL="${DATABASE_URL//\?channel_binding=require&/?}"
  DATABASE_URL="${DATABASE_URL%\?channel_binding=require}"
  case "$DATABASE_URL" in
    *sslmode=*) ;;
    *\?*) DATABASE_URL="${DATABASE_URL}&sslmode=require" ;;
    *) DATABASE_URL="${DATABASE_URL}?sslmode=require" ;;
  esac
  export DATABASE_URL
  echo "using external database"
else
  export DATABASE_URL="postgresql://$(urlencode "$POSTGRES_USER"):$(urlencode "$POSTGRES_PASSWORD")@127.0.0.1:5432/$(urlencode "$POSTGRES_DB")?schema=public"
fi

mkdir -p "$UPLOAD_DIR" /models
if [ "$external_db" -eq 0 ]; then
  mkdir -p "$PGDATA" /var/run/postgresql
  chown -R postgres:postgres "$PGDATA" /var/run/postgresql
  chmod 700 "$PGDATA"
fi

python3 --version
if [ -f "$VISION_MODEL_PATH" ]; then
  echo "vision model ready: $VISION_MODEL_PATH"
else
  echo "vision model missing: $VISION_MODEL_PATH"
fi

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/app.conf
nginx

POSTGRES_PID=""
if [ "$external_db" -eq 0 ] && [ ! -s "$PGDATA/PG_VERSION" ]; then
  if [ -n "$(ls -A "$PGDATA" 2>/dev/null || true)" ]; then
    echo "removing incomplete postgres data"
    find "$PGDATA" -mindepth 1 -delete
  fi
  echo "initializing postgres"
  pwfile=$(mktemp)
  printf '%s\n' "$POSTGRES_PASSWORD" > "$pwfile"
  chown postgres:postgres "$pwfile"
  chmod 600 "$pwfile"
  gosu postgres initdb \
    --username="$POSTGRES_USER" \
    --pwfile="$pwfile" \
    --auth-local=trust \
    --auth-host=scram-sha-256 \
    --locale=C.UTF-8 \
    -D "$PGDATA"
  rm -f "$pwfile"
  printf "\nlisten_addresses = '127.0.0.1'\n" >> "$PGDATA/postgresql.conf"
fi

if [ "$external_db" -eq 0 ]; then
  echo "starting postgres"
  gosu postgres postgres -D "$PGDATA" \
    -c listen_addresses=127.0.0.1 \
    -c shared_buffers=32MB \
    -c dynamic_shared_memory_type=mmap \
    -c huge_pages=off \
    -c max_connections=40 \
    -c work_mem=4MB \
    -c maintenance_work_mem=32MB &
  POSTGRES_PID=$!
fi

cleanup() {
  nginx -s quit 2>/dev/null || true
  if [ -n "$POSTGRES_PID" ]; then
    kill "$POSTGRES_PID" 2>/dev/null || true
    wait "$POSTGRES_PID" 2>/dev/null || true
  fi
}
trap 'cleanup; exit 0' TERM INT

if [ "$external_db" -eq 0 ]; then
  ready=0
  for _ in $(seq 1 90); do
    if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
      ready=1
      break
    fi
    if ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
      echo "postgres stopped during startup" >&2
      wait "$POSTGRES_PID" || true
      exit 1
    fi
    sleep 1
  done
  if [ "$ready" -ne 1 ]; then
    echo "postgres was not ready in time" >&2
    exit 1
  fi
fi

if [ "$external_db" -eq 0 ] && [ "$POSTGRES_DB" != "$POSTGRES_USER" ]; then
  existing=$(gosu postgres psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'")
  if [ "$existing" != "1" ]; then
    gosu postgres createdb -U "$POSTGRES_USER" --owner="$POSTGRES_USER" "$POSTGRES_DB"
  fi
fi

cd /app/apps/api
migrate_url="${DATABASE_URL//-pooler/}"
attempt=0
until DATABASE_URL="$migrate_url" /app/node_modules/.bin/prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "migrations failed" >&2
    exit 1
  fi
  echo "waiting for database"
  sleep 2
done

echo "seeding demo accounts"
node prisma/seed.mjs || echo "seed failed, continuing startup"

node dist/main.js &
API_PID=$!
set +e
wait "$API_PID"
code=$?
set -e
cleanup
exit "$code"
