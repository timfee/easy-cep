"use server";
import "server-only";

import type { StepCheckResult, StepId } from "@/types";
import { getStep } from "../workflow/step-registry";

export async function executeStep(stepId: StepId, checkData: StepCheckResult) {
  const step = getStep(stepId);
  return await step.execute(
    {},
    { fetch, log: (lvl, msg) => console.log(`[EXEC:${stepId}]`, lvl, msg) },
    checkData
  );
}
