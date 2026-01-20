import type { StepDefinition, StepUIState } from "@/types";

import type { StepStatusValue } from "../step-status";
import type { WorkflowVars } from "../variables";

import { STEP_DETAILS } from "../step-details";
import { StepStatus } from "../step-status";
import { WORKFLOW_VARIABLES, getMissingRequiredVars } from "../variables";

/**
 * Status details computed for a workflow step.
 */
export interface StatusInfo {
  status: StepStatusValue;
  blockReason?: string;
}

/**
 * Compute step status based on requirements and state.
 */
export function computeEffectiveStatus(
  step: StepDefinition,
  currentState: StepUIState | undefined,
  vars: Partial<WorkflowVars>,
  allStates: Record<string, StepUIState>
): StatusInfo {
  const missing = getMissingRequiredVars(step.requires, vars);

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
    return { blockReason, status: StepStatus.Blocked };
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

  if (currentState?.status === StepStatus.Blocked) {
    return {
      blockReason: currentState.blockReason,
      status: StepStatus.Blocked,
    };
  }

  if (currentState?.status === StepStatus.Pending) {
    return { status: StepStatus.Pending };
  }

  if (currentState?.status === StepStatus.Ready) {
    return { status: StepStatus.Ready };
  }

  if (!currentState) {
    return { status: StepStatus.Pending };
  }

  return { status: StepStatus.Pending };
}
