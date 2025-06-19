import { StepId } from "@/types";
import { defineStep } from "../step-builder";

export default defineStep(StepId.TestSsoConfiguration)
  .requires()
  .provides()

  .check(async ({ markIncomplete }) => {
    try {
      markIncomplete("Manual test required", {});
    } catch {
      markIncomplete("Manual test required", {});
    }
  })
  .execute(async ({ markPending }) => {
    try {
      markPending("Complete login flow manually");
    } catch {
      markPending("Complete login flow manually");
    }
  })
  .undo(async ({ markReverted }) => {
    markReverted();
  })
  .build();
