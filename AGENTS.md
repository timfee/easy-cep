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
- `StepOutcome` (e.g. `StepOutcome.Succeeded`)
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
  status: StepOutcome;
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

```
pnpm lint
pnpm check
pnpm build
```

These commands should run without any warnings or TypeScript errors.
