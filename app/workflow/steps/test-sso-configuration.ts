import { StepId } from "@/types";
import { createStep } from "../create-step";

/* eslint-disable @typescript-eslint/no-empty-object-type */
interface CheckData {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export default createStep<CheckData>({
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
  }
});
