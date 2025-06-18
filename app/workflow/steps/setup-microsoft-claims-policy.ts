import { EmptyResponseSchema, isConflictError } from "@/app/workflow/utils";
import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

interface CheckData {
  claimsPolicyId?: string;
}

export default createStep<CheckData>({
  id: StepId.SetupMicrosoftClaimsPolicy,
  requires: [Var.MsGraphToken, Var.SsoServicePrincipalId],
  provides: [Var.ClaimsPolicyId],

  /**
   * GET https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies
   *
   * Completed step example response
   *
   * 200
   * { "value": [ { "id": "policy123" } ] }
   *
   * Incomplete step example response
   *
   * 200
   * { "value": [] }
   */

  async check({
    vars,
    fetchMicrosoft,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const spId = getVar(vars, Var.SsoServicePrincipalId);

      const PoliciesSchema = z.object({
        value: z.array(z.object({ id: z.string() }))
      });

      const { value } = await fetchMicrosoft(
        ApiEndpoint.Microsoft.ReadClaimsPolicy(spId),
        PoliciesSchema,
        { flatten: true }
      );

      if (value.length > 0) {
        log(LogLevel.Info, "Claims policy already assigned");
        markComplete({ claimsPolicyId: value[0].id });
      } else {
        markIncomplete("Claims policy not assigned", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check claims policy", { error });
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({ vars, fetchMicrosoft, markSucceeded, markFailed, log }) {
    /**
     * POST https://graph.microsoft.com/beta/policies/claimsMappingPolicies
     * { "displayName": "Google Workspace Basic Claims", ... }
     *
     * Success response
     *
     * 201
     * { "id": "policy123" }
     *
     * POST https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies/$ref
     * { "@odata.id": "https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/{policyId}" }
     *
     * Success response
     * 204
     */
    try {
      const spId = getVar(vars, Var.SsoServicePrincipalId);

      const PolicySchema = z.object({ id: z.string() });

      let policyId: string | undefined;
      try {
        const created = await fetchMicrosoft(
          ApiEndpoint.Microsoft.ClaimsPolicies,
          PolicySchema,
          {
            method: "POST",
            body: JSON.stringify({
              definition: [
                '{"ClaimsMappingPolicy":{"Version":1,"IncludeBasicClaimSet":true,"ClaimsSchema":[]}}'
              ],
              displayName: "Google Workspace Basic Claims",
              isOrganizationDefault: false
            })
          }
        );
        policyId = created.id;
      } catch (error) {
        if (isConflictError(error)) {
          const listSchema = z.object({
            value: z.array(z.object({ id: z.string() }))
          });
          const { value } = await fetchMicrosoft(
            ApiEndpoint.Microsoft.ClaimsPolicies,
            listSchema,
            { flatten: true }
          );
          policyId = value[0]?.id;
        } else {
          throw error;
        }
      }

      if (!policyId) throw new Error("Policy ID unavailable");

      try {
        await fetchMicrosoft(
          ApiEndpoint.Microsoft.AssignClaimsPolicy(spId),
          EmptyResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({
              "@odata.id": `https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/${policyId}`
            })
          }
        );
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
        // Policy already assigned
      }

      markSucceeded({ [Var.ClaimsPolicyId]: policyId });
    } catch (error) {
      log(LogLevel.Error, "Failed to setup claims policy", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  }
});
