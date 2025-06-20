# E2E Test Notes

- Tests require `TEST_GOOGLE_BEARER_TOKEN`, `TEST_MS_BEARER_TOKEN` and
  `TEST_DOMAIN` environment variables.
- Set `RUN_E2E=1` when invoking `pnpm test` to enable the live tests.
- Fixtures live under `test/e2e/fixtures/`. Use `UPDATE_FIXTURES=1` to
  regenerate them and `CHECK_FIXTURES=1` to assert against them.
