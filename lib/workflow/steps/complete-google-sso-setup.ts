import { StepId, Var } from "@/types";
import { createStep } from "../create-step";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CheckData {}

export default createStep<CheckData>({
  id: StepId.CompleteGoogleSsoSetup,
  requires: [Var.SamlProfileId, Var.EntityId, Var.AcsUrl, Var.IsDomainVerified],
  provides: [],

  async check({ markIncomplete }) {
    try {
      markIncomplete("Manual configuration required", {});
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
  },
  undo: async ({ markFailed }) => {
    markFailed("Manual configuration cannot be reverted automatically");
  }
});
