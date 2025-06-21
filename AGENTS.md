# Workflow Step Authoring for LLMs

This document defines how to write a new federated identity workflow step.

Each step performs one logical operation (e.g. creating a user or assigning a role) and is fully self-contained.

## ✅ File Placement

Place your step definition in: `./lib/workflow/steps/{step-id}.ts`

Use `kebab-case` for filenames. The `step-id` must match one of the values in `StepId` (see `./lib/workflow/step-ids.ts`).

There is an `AGENTS.md` file in `./lib/workflow/steps` that will provide the API contracts you can expect.

## ✅ Required Format

Each file must export the result of the step builder:

```ts
export default defineStep(StepId.X)
  .requires(Var.X)
  .provides(Var.Y)
  .check(async ({ vars, google }) => {
    // ...
  })
  .execute(async ({ vars, google }) => {
    // ...
  })
  .build();
```

## ✅ Allowed Enums

Use only values from these enums — no string literals allowed:

- `Var` (e.g. `Var.GoogleAccessToken`)
- `StepId` (e.g. `StepId.CreateServiceUser`)
- `LogLevel` (e.g. `LogLevel.Info`)

## ✅ Logging

Use `ctx.log(...)`:

```ts
ctx.log(LogLevel.Info, "Created SSO assignment");
```

## ✅ Fetching

Use the `google` and `microsoft` HTTP clients provided by the step builder:

```ts
const user = await google.get(ApiEndpoint.Google.Users, UserSchema);
```

## ✅ Type Contracts

All return types must conform to these interfaces:

```ts
interface StepCheckResult {
  isComplete: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

interface StepExecuteResult<K extends Var> {
  status: StepUIState["status"];
  output?: Partial<Pick<WorkflowVars, K>>;
  notes?: string;
  error?: string;
}
```

## 🛑 Prohibited

- No `any`
- No `as` or casting
- No console.log
- No default exports other than the result of `defineStep(...).build()`

## ✅ Required Checks

All PRs must pass the following commands before submission:

```bash
pnpm lint
pnpm check
pnpm build
```

These commands should run without any warnings or TypeScript errors.

## ✅ Token Verification

Bearer tokens for Google and Microsoft live under `google_bearer.token` and
`microsoft_bearer.token`. Before running steps or E2E tests, verify they are
valid:

```bash
./scripts/token-info.sh
```

The script prints token metadata so you know the credentials are active.
Never commit refreshed tokens or other secrets to the repository.

## ✅ Testing

Unit and integration tests can be run with:

```bash
pnpm test
```

E2E tests require `TEST_GOOGLE_BEARER_TOKEN`, `TEST_MS_BEARER_TOKEN` and
`TEST_DOMAIN` environment variables. They are included by default; run them. If you are having catastrophic errors, you can skip with `SKIP_E2E=1`
