import { StepDefinition, StepUIState, VarName, WorkflowVars } from "@/types";
import { STEP_DETAILS } from "../step-details";
import type { StepStatusValue } from "../step-status";
import { StepStatus } from "../step-status";
import { WORKFLOW_VARIABLES } from "../variables";

export interface StatusInfo {
  status: StepStatusValue;
  blockReason?: string;
}

export function computeEffectiveStatus(
  step: StepDefinition,
  currentState: StepUIState | undefined,
  vars: Partial<WorkflowVars>,
  allStates: Record<string, StepUIState>
): StatusInfo {
  const missing = step.requires.filter(
    (varName: VarName) => vars[varName] === undefined
  );

  if (missing.length > 0) {
    const provider = WORKFLOW_VARIABLES[missing[0]]?.producedBy;
    let blockReason: string | undefined;
    if (provider) {
      const providerState = allStates[provider];
      const providerTitle = STEP_DETAILS[provider]?.title || provider;
      if (providerState?.status === StepStatus.Stale) {
        blockReason = `Waiting for '${providerTitle}' to be re-run`;
      } else {
        blockReason = `Complete '${providerTitle}' first`;
      }
    }
    return { status: StepStatus.Blocked, blockReason };
  }

  if (currentState?.status === StepStatus.Complete) {
    const missingOutputs = step.provides.some(
      (varName) => vars[varName] === undefined
    );
    return { status: missingOutputs ? StepStatus.Stale : StepStatus.Complete };
  }

  if (currentState?.status === StepStatus.Stale) {
    return { status: StepStatus.Stale };
  }

  return { status: StepStatus.Ready };
}
