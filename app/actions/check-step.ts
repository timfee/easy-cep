"use server";
import "server-only";

import { StepId } from "@/types";
import { getStep } from "../workflow/step-registry";

export async function checkStep(stepId: StepId) {
  const step = getStep(stepId);
  return await step.check(
    {},
    { fetch, log: (lvl, msg) => console.log(`[CHECK:${stepId}]`, lvl, msg) }
  );
}
