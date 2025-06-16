import type {
  StepCheckResult,
  StepContext,
  StepExecuteResult,
  StepId,
  Var,
  WorkflowVars,
} from "@/types";

/**
 * Validates that a step only returns declared vars,
 * and enforces required/optional var shape at compile time.
 */
export function createStep<
  R extends readonly Var[],
  P extends readonly Var[]
>(step: {
  id: StepId;
  requires: R;
  provides: P;
  check: (
    vars: Pick<WorkflowVars, R[number]>,
    ctx: StepContext
  ) => Promise<StepCheckResult>;
  execute: (
    vars: Pick<WorkflowVars, R[number]>,
    ctx: StepContext,
    checkResult: StepCheckResult
  ) => Promise<StepExecuteResult<P[number]>>;
}) {
  return step;
}
