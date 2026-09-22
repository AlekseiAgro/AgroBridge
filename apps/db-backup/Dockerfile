# Isolated AgroBridge PostgreSQL backup image.
# Build context MUST be the repository root (same as apps/api and apps/web).
# Railway: leave Root Directory empty; Dockerfile path = apps/db-backup/Dockerfile.
# A Root Directory of apps/db-backup fails with: "/apps/db-backup": not found.
# Does NOT use apps/api/docker-entrypoint.sh and never runs Prisma.
#
# PG_CLIENT_MAJOR / PG_DUMP_IMAGE_TAG default to 16 because local
# docker-compose.yml uses postgres:16-alpine. Production major is NOT verified.
# Rebuild with --build-arg PG_CLIENT_MAJOR=<major> after checking the live server.

ARG NODE_VERSION=22
ARG PG_CLIENT_MAJOR=16
ARG PG_DUMP_IMAGE_TAG=16-alpine

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/db-backup/package.json apps/db-backup/package.json
RUN pnpm install --frozen-lockfile --filter @agrobridge/db-backup...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/db-backup/node_modules ./apps/db-backup/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/db-backup ./apps/db-backup
RUN pnpm --filter @agrobridge/db-backup build

FROM node:${NODE_VERSION}-alpine AS runner
ARG PG_CLIENT_MAJOR
ARG PG_DUMP_IMAGE_TAG
ENV NODE_ENV=production \
    PG_CLIENT_MAJOR=${PG_CLIENT_MAJOR} \
    PG_DUMP_IMAGE_TAG=${PG_DUMP_IMAGE_TAG}
RUN apk add --no-cache "postgresql${PG_CLIENT_MAJOR}-client" \
  && addgroup -S backup \
  && adduser -S backup -G backup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/db-backup/dist ./dist
COPY --from=build /app/apps/db-backup/package.json ./package.json
USER backup
# Intentionally not apps/api/docker-entrypoint.sh
CMD ["node", "dist/main.js"]
