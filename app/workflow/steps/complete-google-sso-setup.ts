import { StepId, Var } from "@/types";
import { createStep } from "../create-step";

/* eslint-disable @typescript-eslint/no-empty-object-type */
interface CheckData {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export default createStep<CheckData>({
  id: StepId.CompleteGoogleSsoSetup,
  requires: [Var.SamlProfileId, Var.EntityId, Var.AcsUrl],
  provides: [],

  async check({ markIncomplete, markComplete }) {
    try {
      if (process.env.SSO_CONFIGURED === "true") {
        markComplete({});
      } else {
        markIncomplete("Manual configuration required", {});
      }
    } catch {
      markIncomplete("Manual configuration required", {});
    }
  },

  async execute({ markSucceeded }) {
    try {
      markSucceeded({});
    } catch {
      /* no-op */
    }
  }
});
