/**
 * @file create-step.ts
 * @description Convenience factory for defining strongly-typed workflow steps.
 *
 * The helper keeps each step definition fully type-safe while removing boilerplate:
 *  • `requires` and `provides` are inferred from the supplied arrays and preserved
 *    in the returned `StepDefinition` type.
 *  • A single generic parameter (`D`) is exposed to the caller so every step can
 *    share a structural type between its `check` and `execute` callbacks.
 *  • `R` and `P` – the literal `requires` / `provides` tuples – are still
 *    generics, but they are inferred automatically, therefore callers can simply
 *    write `createStep<MyCheckData>({ … })`.
 */

import type {
  StepCheckContext,
  StepDefinition,
  StepExecuteContext,
  StepUndoContext,
  StepIdValue,
  VarName,
  WorkflowVars
} from "@/types";

/**
 * Declare a new workflow step.
 *
 * @typeParam D  Arbitrary data that `check()` gathers and passes into
 *               `execute()`.  Provide this via the first generic argument.
 * @typeParam R  Tuple of `Var` items that **must** exist before the step can
 *               run.  Inferred from the `requires` property.
 * @typeParam P  Tuple of `Var` items that the step populates on success.
 *               Inferred from the `provides` property.
 */
export function createStep<
  D extends Partial<WorkflowVars>,
  R extends readonly VarName[] = VarName[],
  P extends readonly VarName[] = VarName[]
>(args: {
  /** Unique identifier for the step */
  id: StepIdValue;
  /** Variables that must be present before the step may execute */
  requires: R;
  /** Variables provided when the step has executed successfully */
  provides: P;
  /**
   * Determine whether the step is already completed.
   *
   * If the check finds the desired state, call `markComplete()` – the engine
   * will skip execution. Otherwise call `markIncomplete()` with a summary to
   * surface to the UI.
   */
  check: (ctx: StepCheckContext<D>) => Promise<void>;
  /**
   * Perform the actual side-effects to bring the external system into the
   * desired state.  Always report the outcome via one of the `mark*` helpers
   * on the context.
   */
  execute: (ctx: StepExecuteContext<D>) => Promise<void>;
  undo?: (ctx: StepUndoContext<D>) => Promise<void>;
}): StepDefinition<R, P> & {
  check(ctx: StepCheckContext<D>): Promise<void>;
  check<T2 extends Partial<WorkflowVars>>(
    ctx: StepCheckContext<T2>
  ): Promise<void>;
  execute(ctx: StepExecuteContext<D>): Promise<void>;
  execute<T2 extends Partial<WorkflowVars>>(
    ctx: StepExecuteContext<T2>
  ): Promise<void>;
  undo?(ctx: StepUndoContext<D>): Promise<void>;
  undo?<T2 extends Partial<WorkflowVars>>(
    ctx: StepUndoContext<T2>
  ): Promise<void>;
} {
  // The function merely re-emits the object so that TypeScript retains the
  // literal types of `requires` and `provides` for downstream consumers.
  return args;
}

/**
 * Safely extract a required workflow variable, or throw if missing.
 */
export function getVar<K extends VarName>(
  vars: Partial<WorkflowVars>,
  key: K
): WorkflowVars[K] {
  const value = vars[key];
  if (value === undefined) {
    throw new Error(`Required variable ${key} is not available`);
  }
  return value;
}
