# syntax=docker/dockerfile:1

# Tripatlas demo — one-shot seeder image for the fake TeslaMate database used
# by docker-compose.demo.yml (see docs/demo.md).
#
# Deliberately standalone, NOT a pnpm-workspace build: dev/fixtures/seed.ts
# has zero workspace-internal dependencies (just the plain "postgres" npm
# package, see package.json), so a plain `npm install` in this directory is
# sufficient. This avoids coupling the demo stack to the root pnpm lockfile /
# workspace resolution — much less to go wrong when building in isolation.
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install

COPY seed.ts ./

CMD ["npm", "run", "seed"]
