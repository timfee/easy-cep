# E2E Test Notes

- Tests require `TEST_GOOGLE_BEARER_TOKEN`, `TEST_MS_BEARER_TOKEN` and
  `TEST_DOMAIN` environment variables.
- Set `RUN_E2E=1` when invoking `pnpm test` to enable the live tests.
- Fixtures live under `test/e2e/fixtures/`.
- Set `UPDATE_FIXTURES=1` to record new fixtures or `CHECK_FIXTURES=1` to
  verify existing ones. Without either variable the tests run without fixture
  comparison.
- Missing fixtures in verify mode will cause the test to fail with an explicit
  error.
- Use `beforeAll`/`afterAll` hooks for setup and cleanup. Network calls should
  only occur when `RUN_E2E` is set; otherwise rely on fixtures to keep tests
  deterministic.
