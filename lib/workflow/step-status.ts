export type StepStatus = "blocked" | "ready" | "complete" | "stale";
export const StepStatus: Record<
  "Blocked" | "Ready" | "Complete" | "Stale",
  StepStatus
> = {
  Blocked: "blocked",
  Ready: "ready",
  Complete: "complete",
  Stale: "stale",
};

export type StepStatusValue = StepStatus;
