import type {
  StepCheckContext,
  StepExecuteContext,
  StepId,
  Var
} from "@/types";

export function createStep<TCheck = Record<string, never>>({
  id,
  requires,
  provides,
  check,
  execute
}: {
  id: StepId;
  requires: readonly Var[];
  provides: readonly Var[];
  check: (ctx: StepCheckContext<TCheck>) => Promise<void>;
  execute: (ctx: StepExecuteContext<TCheck>) => Promise<void>;
}) {
  return { id, requires, provides, check, execute };
}
