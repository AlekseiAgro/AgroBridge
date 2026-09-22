#!/bin/sh
# Local-only backup drill. Never points at production.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)"
NETWORK="agrobridge-backup-local-$$"
PG_NAME="agrobridge-backup-pg-$$"
STORE="$(mktemp -d /tmp/agrobridge-backup-local-XXXXXX)"
IMAGE="agrobridge-db-backup:local"

cleanup() {
  docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Building isolated backup image (PG_CLIENT_MAJOR=${PG_CLIENT_MAJOR:-16})..."
docker build \
  -f "$ROOT/apps/db-backup/Dockerfile" \
  --build-arg "PG_CLIENT_MAJOR=${PG_CLIENT_MAJOR:-16}" \
  --build-arg "PG_DUMP_IMAGE_TAG=${PG_DUMP_IMAGE_TAG:-16-alpine}" \
  -t "$IMAGE" \
  "$ROOT"

docker network create "$NETWORK" >/dev/null
docker run -d --rm --name "$PG_NAME" --network "$NETWORK" \
  -e POSTGRES_USER=agrobridge \
  -e POSTGRES_PASSWORD=agrobridge \
  -e POSTGRES_DB=agrobridge_backup_test \
  postgres:16-alpine >/dev/null

echo "Waiting for temporary PostgreSQL..."
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if docker exec "$PG_NAME" pg_isready -U agrobridge -d agrobridge_backup_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$PG_NAME" psql -U agrobridge -d agrobridge_backup_test -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE farms(id text primary key, name text);
   INSERT INTO farms VALUES ('farm_1', 'Kartli Orchard');
   CREATE TABLE products(id text primary key, title text);
   INSERT INTO products VALUES ('p1', 'Apple');"

DATABASE_URL="postgresql://agrobridge:agrobridge@${PG_NAME}:5432/agrobridge_backup_test?schema=public"

run_backup() {
  kind="$1"
  dry="${2:-false}"
  docker run --rm --network "$NETWORK" \
    -e DATABASE_URL="$DATABASE_URL" \
    -e BACKUP_ENVIRONMENT=local \
    -e "BACKUP_KIND=$kind" \
    -e BACKUP_STORAGE=fs \
    -e BACKUP_FS_ROOT=/out \
    -e "BACKUP_DRY_RUN=$dry" \
    -e BACKUP_MIN_BYTES=32 \
    -e BACKUP_KEEP_DAILY=1 \
    -v "$STORE:/out" \
    "$IMAGE"
}

echo "Dry-run..."
run_backup daily true
echo "Manual locked backup..."
run_backup manual false
echo "Daily backup..."
run_backup daily false

echo "Store contents:"
find "$STORE" -type f | sort
echo "Local integration finished. Temporary files: $STORE"
