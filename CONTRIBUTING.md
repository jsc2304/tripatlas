# Contributing to Tripatlas

Tripatlas is a self-hosted Tesla trip archive based on TeslaMate data. Thank you for helping keep it useful, maintainable, and safe for self-hosted deployments.

## License

Tripatlas is copyright (C) 2026 Jan Schultheiss and licensed under the GNU Affero General Public License v3.0. By contributing, you agree that your contributions are provided under the same AGPL-3.0 license.

## Development Setup

Tripatlas is a pnpm monorepo with a Next.js web app, a Node worker, shared packages, and PostgreSQL.

```bash
pnpm install
pnpm dev:db
pnpm db:seed:teslamate
DATABASE_URL=postgres://tripatlas:tripatlas@localhost:5432/tripatlas pnpm db:migrate
pnpm --filter @tripatlas/worker dev
pnpm --filter @tripatlas/web dev
```

The worker needs `DATABASE_URL` and `TESLAMATE_DATABASE_URL`; see `.env.example` for the expected local values. The web app runs at `http://localhost:3000` by default.

## Checks

Run the repository checks before opening a pull request:

```bash
pnpm test
pnpm lint
```

`pnpm lint` is the repository typecheck/lint entry point. It first builds the shared package types, then runs all package checks. For the web app TypeScript compiler specifically, run:

```bash
pnpm --filter @tripatlas/web exec tsc --noEmit
```

## Pull Requests

Keep pull requests small and focused. Describe what changed, why it changed, and how you tested it.

Pull request descriptions and discussion are welcome in English or German.
