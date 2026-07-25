# Cloud Run image for apps/admin (operator console), replacing apphosting.admin.yaml
# (Firebase App Hosting). See docs/runbooks/admin-cloud-run.md for the deploy procedure and
# docs/decisions-carryover.md / ADR-005 for the Cloud Run + IAP target this implements.
#
# Monorepo build: same pnpm-workspace constraint as apphosting-build.mjs — App Hosting's
# default adapter (and a naive Docker build) falls back to npm and fails on `workspace:*`
# deps unless the build runs from the repo root, where pnpm-lock.yaml lives. This Dockerfile
# therefore copies the whole repo context (see .dockerignore) and builds with
# `pnpm --filter @repo/admin... build`, matching scripts/apphosting-build.mjs exactly so the
# two build paths stay in parity while both exist.
#
# next.config.mjs already sets `output: 'standalone'`, so runtime only needs the standalone
# server bundle plus the static/public assets copied alongside it (same copy step
# apphosting-build.mjs performs for App Hosting).

FROM node:22-bookworm-slim AS build
WORKDIR /repo

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile --filter @repo/admin...
RUN pnpm --filter @repo/admin... --workspace-concurrency=1 build

RUN mkdir -p apps/admin/.next/standalone/apps/admin/.next \
  && cp -r apps/admin/.next/static apps/admin/.next/standalone/apps/admin/.next/static \
  && cp -r apps/admin/public apps/admin/.next/standalone/apps/admin/public

# --- Runtime image: only the standalone server bundle, not the full monorepo/build cache ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /repo/apps/admin/.next/standalone ./

EXPOSE 8080
CMD ["node", "apps/admin/server.js"]
