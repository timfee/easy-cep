import { LogLevel, StepId, StepOutcome, Var } from "@/types";
import { createStep } from "../create-step";

export default createStep({
  id: StepId.DummyStep,
  requires: [],
  provides: [Var.CustomerId],

  async check(_, ctx) {
    ctx.log(LogLevel.Info, "Checking dummy step...");
    return {
      isComplete: false,
      summary: "Customer ID not yet set",
    };
  },

  async execute(_, ctx) {
    ctx.log(LogLevel.Info, "Executing dummy step...");
    return {
      status: StepOutcome.Succeeded,
      output: {
        [Var.CustomerId]: "C123456",
      },
      notes: "Customer ID assigned",
    };
  },
});
