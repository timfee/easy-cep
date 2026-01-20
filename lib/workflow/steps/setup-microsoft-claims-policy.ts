import { isConflictError, isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";

import { defineStep } from "../step-builder";

export default defineStep(StepId.SetupMicrosoftClaimsPolicy)
  .requires(
    Var.MsGraphToken,
    Var.SsoServicePrincipalId,
    Var.ClaimsPolicyDisplayName
  )
  .provides(Var.ClaimsPolicyId)

  .check(
    async ({
      vars,
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log,
    }) => {
      try {
        const spId = vars.require(Var.SsoServicePrincipalId);

        const { value } = (await microsoft.servicePrincipals
          .claimsMappingPolicies(spId)
          .list()
          .get()) as { value: { id: string }[] };

        if (value.length > 0) {
          log(LogLevel.Info, "Claims policy already assigned");
          markComplete({ claimsPolicyId: value[0].id });
        } else {
          log(LogLevel.Info, "Claims policy not assigned");
          markIncomplete("Claims policy not assigned", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check claims policy", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    try {
      const spId = vars.require(Var.SsoServicePrincipalId);

      let policyId: string | undefined;
      try {
        const created = (await microsoft.claimsPolicies.create().post({
          definition: [
            '{"ClaimsMappingPolicy":{"Version":1,"IncludeBasicClaimSet":true,"ClaimsSchema":[]}}',
          ],
          displayName: vars.require(Var.ClaimsPolicyDisplayName),
          isOrganizationDefault: false,
        })) as { id?: string };
        policyId = created.id;
      } catch (error) {
        if (isConflictError(error)) {
          const { value } = (await microsoft.claimsPolicies.list().get()) as {
            value: { id: string }[];
          };
          policyId = value[0]?.id;
        } else {
          throw error;
        }
      }

      if (!policyId) {
        throw new Error("Policy ID unavailable");
      }

      try {
        await microsoft.servicePrincipals
          .claimsMappingPolicies(spId)
          .assign()
          .post({
            "@odata.id": `https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/${policyId}`,
          });
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
      }

      output({ claimsPolicyId: policyId });
    } catch (error) {
      log(LogLevel.Error, "Failed to setup claims policy", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const policyId = vars.require(Var.ClaimsPolicyId);
      const spId = vars.get(Var.SsoServicePrincipalId);

      if (spId) {
        await microsoft.servicePrincipals
          .claimsMappingPolicies(spId)
          .unassign(policyId)
          .delete();
      }

      await microsoft.claimsPolicies.delete(policyId).delete();

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete claims policy", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
