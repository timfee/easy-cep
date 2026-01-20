/**
 * String values for workflow status states.
 */
export type StepStatus = "blocked" | "ready" | "complete" | "stale" | "pending";

/**
 * PascalCase lookup map for step statuses.
 */
export const StepStatus: Record<
  "Blocked" | "Ready" | "Complete" | "Stale" | "Pending",
  StepStatus
> = {
  Blocked: "blocked",
  Complete: "complete",
  Pending: "pending",
  Ready: "ready",
  Stale: "stale",
};

/**
 * Alias for step status values.
 */
export type StepStatusValue = StepStatus;
