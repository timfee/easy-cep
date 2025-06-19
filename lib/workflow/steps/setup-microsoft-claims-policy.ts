import { ApiEndpoint } from "@/constants";
import {
  EmptyResponseSchema,
  isConflictError,
  isNotFoundError
} from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

export default defineStep(StepId.SetupMicrosoftClaimsPolicy)
  .requires(
    Var.MsGraphToken,
    Var.SsoServicePrincipalId,
    Var.ClaimsPolicyDisplayName
  )
  .provides(Var.ClaimsPolicyId)

  /**
   * GET https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies
   *
   * Example success (200)
   * { "value": [ { "id": "policy123" } ] }
   *
   * Example none found (200)
   * { "value": [] }
   *
   * Example invalid token (401)
   * { "error": { "code": "InvalidAuthenticationToken" } }
   */

  .check(
    async ({
      vars,
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log
    }) => {
      try {
        const spId = vars.require(Var.SsoServicePrincipalId);
        if (!spId) {
          markIncomplete("Missing SSO service principal ID", {});
          return;
        }

        const PoliciesSchema = z.object({
          value: z.array(z.object({ id: z.string() }))
        });

        const { value } = await microsoft.get(
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
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
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
      const spId = vars.require(Var.SsoServicePrincipalId);

      const PolicySchema = z.object({ id: z.string() });

      let policyId: string | undefined;
      try {
        const created = await microsoft.post(
          ApiEndpoint.Microsoft.ClaimsPolicies,
          PolicySchema,
          {
            definition: [
              '{"ClaimsMappingPolicy":{"Version":1,"IncludeBasicClaimSet":true,"ClaimsSchema":[]}}'
            ],
            displayName: vars.require(Var.ClaimsPolicyDisplayName),
            isOrganizationDefault: false
          }
        );
        policyId = created.id;
      } catch (error) {
        if (isConflictError(error)) {
          const listSchema = z.object({
            value: z.array(z.object({ id: z.string() }))
          });
          const { value } = await microsoft.get(
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
      if (!spId) {
        markFailed("Missing SSO service principal ID");
        return;
      }

      try {
        await microsoft.post(
          ApiEndpoint.Microsoft.AssignClaimsPolicy(spId),
          EmptyResponseSchema,
          {
            "@odata.id": `https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/${policyId}`
          }
        );
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
        // Policy already assigned
      }

      output({ claimsPolicyId: policyId });
    } catch (error) {
      log(LogLevel.Error, "Failed to setup claims policy", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const spId = vars.get(Var.SsoServicePrincipalId);
      const policyId = vars.get(Var.ClaimsPolicyId);
      if (!policyId) {
        markFailed("Missing claims policy id");
        return;
      }

      if (spId) {
        await microsoft.delete(
          ApiEndpoint.Microsoft.UnassignClaimsPolicy(spId, policyId),
          EmptyResponseSchema
        );
      }

      await microsoft.delete(
        `${ApiEndpoint.Microsoft.ClaimsPolicies}/${policyId}`,
        EmptyResponseSchema
      );

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
