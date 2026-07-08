# syntax=docker/dockerfile:1

# Tripatlas web — Next.js standalone build. Multi-stage, pnpm workspace-aware.
# linux/arm64-compatible (Raspberry Pi). Uses node:22-bookworm-slim (not
# -alpine): @node-rs/argon2's prebuilt musl binary did not resolve cleanly
# through pnpm's workspace hoisting on alpine during verification — glibc
# avoids that whole class of native-binding issues. See README Deployment
# section for details.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- base: corepack/pnpm ----------------------------------------------
FROM ${NODE_IMAGE} AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# ---- deps: install full deps needed to build @tripatlas/web -----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY apps/web/package.json apps/web/package.json
# dev/fixtures is a workspace member per pnpm-workspace.yaml; pnpm needs its
# manifest present to resolve the lockfile even though nothing here installs it.
COPY dev/fixtures/package.json dev/fixtures/package.json
RUN pnpm install --frozen-lockfile --filter @tripatlas/web... --filter @tripatlas/core --filter @tripatlas/db

# ---- build: compile core+db, then build web ----------------------------
FROM deps AS build
COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/web apps/web
COPY tsconfig.base.json tsconfig.base.json
RUN pnpm --filter @tripatlas/core build \
 && pnpm --filter @tripatlas/db build \
 && pnpm --filter @tripatlas/web build

# ---- runtime -------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN groupadd --system --gid 1001 tripatlas \
 && useradd --system --uid 1001 --gid tripatlas tripatlas

# Next.js standalone output already contains a pruned node_modules with only
# the traced production dependencies — no separate prod-deps install needed.
COPY --from=build --chown=tripatlas:tripatlas /repo/apps/web/.next/standalone ./
COPY --from=build --chown=tripatlas:tripatlas /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=tripatlas:tripatlas /repo/apps/web/public ./apps/web/public

USER tripatlas
EXPOSE 3000

# Docker setzt HOSTNAME auf die Container-ID; Next standalone nutzt genau
# diese Variable als Bind-Adresse — ohne Override lauscht der Server nicht
# auf 127.0.0.1 und der Healthcheck unten schlägt fehl.
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
