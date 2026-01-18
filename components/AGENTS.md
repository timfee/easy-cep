# Component Guidelines

## Commands (Repo-wide)

- `bun run build` / `bun run check` / `bun run lint` / `bun run format`
- `bun test` (runs all tests)
- `bun test path/to/file.test.ts` or `bun test --filter "name"` (single test)
- `RUN_E2E=1 bun test` (live E2E), `UPDATE_FIXTURES=1` or `CHECK_FIXTURES=1` for fixtures, `SKIP_E2E=1` to skip
- `bun run e2e:live` (live E2E runner)

- Export all React components using **named exports**. No `default` exports.
- Add "use client" at the top of components that use state or effects.
- Use `cn()` from `@/lib/utils` to compose Tailwind class names.
- Prefer primitives from `components/ui/` over custom styling.
- Keep component props typed and avoid `any`.
- Layout files under `app/` should remain **server components**. Only leaf components that need interactivity should include "use client".
- Use Next.js `fetch` with `{ cache: "no-store" }` for token-based requests or `revalidate` options for cached data.

