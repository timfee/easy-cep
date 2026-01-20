# Script Guidelines

## Commands (Repo-wide)

- `bun run build` / `bun run check` / `bun run lint` / `bun run format`
- `NODE_ENV=test bun test` (runs all tests)
- `NODE_ENV=test bun test path/to/file.test.ts` or `NODE_ENV=test bun test --filter "name"` (single test)
- `NODE_ENV=test bun test` (live E2E always runs)
- `UPDATE_FIXTURES=1 NODE_ENV=test bun test` or `CHECK_FIXTURES=1 NODE_ENV=test bun test` for fixtures
- `bun run e2e:live` (live E2E runner)

- Node scripts are written in TypeScript and run with `bun x tsx`.
- Bun auto-loads `.env`, `.env.test`, and `.env.local` based on `NODE_ENV`.
  Do not pass `--env-file`; set vars in the environment or `.env.local` instead.
- Scripts expect bearer tokens via environment variables or refresh tokens.
  Refresh tokens live in `.env.local` and are exchanged for access tokens during
  test runs or scripts.
- Do not embed real credentials or tenant IDs directly in scripts.
- Use the constants in `constants.ts` for API endpoints.
