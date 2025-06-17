import { StepId, Var } from "@/types";
import { createStep, getVar } from "../create-step";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CheckData {}

export default createStep<CheckData>({
  id: StepId.CompleteGoogleSsoSetup,
  requires: [Var.SamlProfileId, Var.EntityId, Var.AcsUrl, Var.IsDomainVerified],
  provides: [],

  async check({ vars: _vars, markIncomplete, markComplete }) {
    try {
      if (
        getVar(_vars, Var.SsoAppId) /* placeholder: use correct var */
        === "true"
      ) {
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
