# E2E Test Notes

## Commands (Repo-wide)

- `bun run build` / `bun run check` / `bun run lint` / `bun run format`
- `NODE_ENV=test bun test` (runs all tests)
- `NODE_ENV=test bun test path/to/file.test.ts` or `NODE_ENV=test bun test --filter "name"` (single test)
- `NODE_ENV=test bun test` (live E2E always runs)
- `UPDATE_FIXTURES=1 NODE_ENV=test bun test` or `CHECK_FIXTURES=1 NODE_ENV=test bun test` for fixtures
- `bun run e2e:live` (live E2E runner)

- Tests require refresh tokens or service account credentials in `.env.local`.
  If missing, the live E2E suite is skipped with a warning so unit tests can run.
  Bun auto-loads `.env`, `.env.test`, and `.env.local` based on `NODE_ENV`, so
  do not pass `--env-file`. Set `TEST_GOOGLE_REFRESH_TOKEN`/`TEST_MS_REFRESH_TOKEN`
  (exchanged for bearer tokens during `bun test`) and `TEST_DOMAIN` as needed.
  Service account auth can use `GOOGLE_SERVICE_ACCOUNT_JSON` or
  `GOOGLE_SERVICE_ACCOUNT_FILE` with `GOOGLE_IMPERSONATED_ADMIN_EMAIL`.
- For live runs, you can call `bun run e2e:live` after tokens are set.
- Fixtures live under `test/e2e/fixtures/`.
- Set `UPDATE_FIXTURES=1` to record new fixtures or `CHECK_FIXTURES=1` to
  verify existing ones. Without either variable the tests run without fixture
  comparison.
- Missing fixtures in verify mode will cause the test to fail with an explicit
  error.
- Use `beforeAll`/`afterAll` hooks for setup and cleanup. Cleanup only deletes
  resources that include the `_test` suffix.
