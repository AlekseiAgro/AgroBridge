#!/bin/sh
set -eu

cd /app/apps/api

if [ -x ./node_modules/.bin/prisma ]; then
  PRISMA=./node_modules/.bin/prisma
elif [ -x /app/node_modules/.bin/prisma ]; then
  PRISMA=/app/node_modules/.bin/prisma
else
  echo "Prisma CLI not found in the image" >&2
  exit 1
fi

echo "Running Prisma migrations..."
"$PRISMA" migrate deploy

echo "Starting AgroBridge API..."
exec node dist/main.js
