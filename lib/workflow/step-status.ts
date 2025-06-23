export enum StepStatus {
  Idle = "idle",
  Ready = "ready",
  Blocked = "blocked",
  Checking = "checking",
  Executing = "executing",
  Complete = "complete",
  Failed = "failed",
  Pending = "pending",
  Undoing = "undoing",
  Reverted = "reverted"
}

export type StepStatusValue = `${StepStatus}`;
