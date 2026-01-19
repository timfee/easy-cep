# E2E Test Notes

## Commands (Repo-wide)

- `bun run build` / `bun run check` / `bun run lint` / `bun run format`
- `bun --env-file=.env.local test` (runs all tests)
- `bun --env-file=.env.local test path/to/file.test.ts` or `bun --env-file=.env.local test --filter "name"` (single test)
- `RUN_E2E=1 bun --env-file=.env.local test` (live E2E), `UPDATE_FIXTURES=1` or `CHECK_FIXTURES=1` for fixtures, `SKIP_E2E=1` to skip
- `bun run e2e:live` (live E2E runner)

- Tests require refresh tokens or service account credentials in `.env.local`.
  Set `TEST_GOOGLE_REFRESH_TOKEN`/`TEST_MS_REFRESH_TOKEN` (exchanged for bearer
  tokens during `bun test`) and `TEST_DOMAIN` as needed. Service account auth
  can use `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_FILE` with
  `GOOGLE_IMPERSONATED_ADMIN_EMAIL`.
- Set `RUN_E2E=1` when invoking `bun test` to enable the live tests.
- For live runs, you can call `bun run e2e:live` after tokens are set.
- Fixtures live under `test/e2e/fixtures/`.
- Set `UPDATE_FIXTURES=1` to record new fixtures or `CHECK_FIXTURES=1` to
  verify existing ones. Without either variable the tests run without fixture
  comparison.
- Missing fixtures in verify mode will cause the test to fail with an explicit
  error.
- Use `beforeAll`/`afterAll` hooks for setup and cleanup. Network calls should
  only occur when `RUN_E2E` is set; otherwise rely on fixtures to keep tests
  deterministic.
