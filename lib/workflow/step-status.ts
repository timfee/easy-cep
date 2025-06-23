export enum StepStatus {
  Blocked = "blocked",
  Ready = "ready",
  Complete = "complete",
  Stale = "stale"
}

export type StepStatusValue = `${StepStatus}`;
