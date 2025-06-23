import { StepDefinition, StepUIState, VarName, WorkflowVars } from "@/types";
import type { StepStatusValue } from "../step-status";
import { StepStatus } from "../step-status";

export function computeEffectiveStatus(
  step: StepDefinition,
  currentState: StepUIState | undefined,
  vars: Partial<WorkflowVars>
): StepStatusValue {
  if (
    currentState?.status === StepStatus.Executing
    || currentState?.status === StepStatus.Checking
  ) {
    return currentState.status;
  }

  const missingPrerequisites = step.requires.filter(
    (varName: VarName) => vars[varName] === undefined
  );

  if (missingPrerequisites.length > 0) {
    return StepStatus.Blocked;
  }

  if (currentState?.status && currentState.status !== StepStatus.Idle) {
    return currentState.status;
  }

  return StepStatus.Ready;
}
