# Node discovery-campaign worker for Cloud Run Job dispatch.
# Production should run as the research@ service account with a Firestore-backed kill switch.
# Discovery jobs write private candidates only — never publish.
FROM node:22-bookworm-slim

WORKDIR /app

# Monorepo install: copy the repo and install @repo/config plus its workspace dependencies.
RUN corepack enable
COPY --chown=node:node . .

# corepack needs root (writes /usr/local); the install and runtime do not.
USER node

RUN pnpm install --frozen-lockfile --filter @repo/config...

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV DISCOVERY_MODE=fixture
ENV DISCOVERY_KILL_SWITCH=disengaged

CMD ["node", "--conditions", "development", "--import", "tsx", "workers/research-node/src/main.ts"]
