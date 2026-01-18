# Script Guidelines

## Commands (Repo-wide)

- `bun run build` / `bun run check` / `bun run lint` / `bun run format`
- `bun test` (runs all tests)
- `bun test path/to/file.test.ts` or `bun test --filter "name"` (single test)
- `RUN_E2E=1 bun test` (live E2E), `UPDATE_FIXTURES=1` or `CHECK_FIXTURES=1` for fixtures, `SKIP_E2E=1` to skip
- `bun run e2e:live` (live E2E runner)

- Node scripts are written in TypeScript and run with `bun x tsx`.
- Scripts expect bearer tokens via environment variables or token files.
- Do not embed real credentials or tenant IDs directly in scripts.
- Use the constants in `constants.ts` for API endpoints.
