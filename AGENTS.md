# Workflow Step Authoring for LLMs

This document defines how to write a new federated identity workflow step.

Each step performs one logical operation (e.g. creating a user or assigning a role) and is fully self-contained.

## ✅ File Placement

Place your step definition in: `./app/workflow/steps/{step-id}.ts`

Use `kebab-case` for filenames. The `step-id` must match one of the values in `StepId` (see `./types.ts`).

There is an `AGENTS.md` file in `./app/workflow/steps` that will provide the API contracts you can expect.

## ✅ Required Format

Each file must export a `createStep()` call:

```ts
createStep({
  id: StepId.X,
  requires: [Var.X],
  provides: [Var.Y],

  async check(vars, ctx): Promise<StepCheckResult> {
    ...
  },

  async execute(vars, ctx, prev): Promise<StepExecuteResult<typeof provides[number]>> {
    ...
  }
})
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

Use `ctx.fetch(...)` and `.json()` explicitly:

```ts
const res = await ctx.fetch("https://...", { headers: { ... } });
const json = await res.json();
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
- No default exports other than `createStep()`
