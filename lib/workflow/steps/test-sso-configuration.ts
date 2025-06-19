import { StepId } from "@/types";
import { createStep } from "../create-step";

export default createStep({
  id: StepId.TestSsoConfiguration,
  requires: [],
  provides: [],

  async check({ markIncomplete }) {
    try {
      markIncomplete("Manual test required", {});
    } catch {
      markIncomplete("Manual test required", {});
    }
  },

  async execute({ markPending }) {
    try {
      markPending("Complete login flow manually");
    } catch {
      markPending("Complete login flow manually");
    }
  },
  undo: async ({ markReverted }) => {
    markReverted();
  }
});
