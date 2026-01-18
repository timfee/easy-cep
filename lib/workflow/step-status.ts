/**
 * String values for workflow status states.
 */
export type StepStatus = "blocked" | "ready" | "complete" | "stale";

/**
 * PascalCase lookup map for step statuses.
 */
export const StepStatus: Record<
  "Blocked" | "Ready" | "Complete" | "Stale",
  StepStatus
> = {
  Blocked: "blocked",
  Ready: "ready",
  Complete: "complete",
  Stale: "stale",
};

/**
 * Alias for step status values.
 */
export type StepStatusValue = StepStatus;
