# Node discovery-campaign worker for Cloud Run Job dispatch.
# Runtime credentials must be scoped to the Postgres research boundary.
# Discovery jobs write private candidates only — never publish.
FROM node:22-bookworm-slim

WORKDIR /app

# Monorepo install: copy the repo and install @repo/config plus its workspace dependencies.
COPY . .

RUN corepack enable \
  && pnpm install --frozen-lockfile --filter @repo/config...

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV DISCOVERY_MODE=fixture
ENV DISCOVERY_KILL_SWITCH=disengaged

CMD ["node", "--conditions", "development", "--import", "tsx", "workers/research-node/src/main.ts"]
