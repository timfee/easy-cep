import { StepDefinition, StepUIState, VarName, WorkflowVars } from "@/types";

export function computeEffectiveStatus(
  step: StepDefinition,
  currentState: StepUIState | undefined,
  vars: Partial<WorkflowVars>
): StepUIState["status"] {
  if (
    currentState?.status === "executing"
    || currentState?.status === "checking"
  ) {
    return currentState.status;
  }

  const missingPrerequisites = step.requires.filter(
    (varName: VarName) => vars[varName] === undefined
  );

  if (missingPrerequisites.length > 0) {
    return "blocked";
  }

  if (currentState?.status && currentState.status !== "idle") {
    return currentState.status;
  }

  return "ready";
}
