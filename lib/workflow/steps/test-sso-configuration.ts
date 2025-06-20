import { StepId } from "@/types";
import { defineStep } from "../step-builder";

export default defineStep(StepId.TestSsoConfiguration)
  .requires()
  .provides()

  .check(async ({ markIncomplete }) => {
    markIncomplete("Manual test required", {});
  })
  .execute(async ({ markPending }) => {
    markPending("Complete login flow manually");
  })
  .undo(async ({ markReverted }) => {
    markReverted();
  })
  .build();
