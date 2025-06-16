"use server";
import "server-only";

import {
  StepContext,
  StepId,
  StepOutcome,
  StepRunResult,
  Var,
  WorkflowVars
} from "@/types";
import { getStep } from "./step-registry";

type Vars = Partial<WorkflowVars>;

export async function runWorkflow(
  steps: StepId[],
  inputVars: Vars,
  createCtx = defaultContext
): Promise<StepRunResult[]> {
  const vars: Vars = { ...inputVars };
  const results: StepRunResult[] = [];

  for (const id of steps) {
    const step = getStep(id);
    const ctx = createCtx(id);
    const scoped = getVars(vars, step.requires);

    const checkResult = await step.check(scoped, ctx);
    if (checkResult.isComplete) {
      results.push({
        id,
        outcome: StepOutcome.Skipped,
        summary: checkResult.summary,
        vars: {}
      });
      continue;
    }

    const execResult = await step.execute(scoped, ctx, checkResult);
    if (execResult.status === StepOutcome.Succeeded && execResult.output) {
      Object.assign(vars, execResult.output);
    }

    results.push({
      id,
      outcome: execResult.status,
      summary: execResult.notes ?? execResult.error ?? checkResult.summary,
      vars: execResult.output ?? {}
    });

    if (execResult.status === StepOutcome.Failed) break;
  }

  return results;
}

function getVars<T extends readonly Var[]>(
  vars: Vars,
  keys: T
): Pick<WorkflowVars, T[number]> {
  const out: Partial<WorkflowVars> = {};
  for (const k of keys) {
    if (!(k in vars)) throw new Error(`Missing var: ${k}`);
    out[k] = vars[k];
  }
  return out as Pick<WorkflowVars, T[number]>;
}

function defaultContext(step: StepId): StepContext {
  return {
    fetch,
    refreshAuth: undefined,
    log: (level, msg) => {
      console.log(`[step:${step}] [${level.toUpperCase()}] ${msg}`);
    }
  };
}
