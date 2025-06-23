import { ApiEndpoint } from "@/constants";
import {
  EmptyResponseSchema,
  isConflictError,
  isHttpError,
  isNotFoundError
} from "@/lib/workflow/utils";

import {
  extractResourceId,
  ResourceTypes
} from "@/lib/workflow/utils/resource-ids";

import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

interface HttpClient {
  get<R>(
    url: string,
    schema: z.ZodSchema<R>,
    options?: { flatten?: boolean | string }
  ): Promise<R>;
}

async function getRootOrgUnitId(google: HttpClient) {
  const OrgUnitsSchema = z.object({
    organizationUnits: z
      .array(
        z.object({
          orgUnitId: z.string(),
          parentOrgUnitId: z.string().optional(),
          orgUnitPath: z.string()
        })
      )
      .optional()
  });

  const { organizationUnits = [] } = await google.get(
    `${ApiEndpoint.Google.OrgUnits}?orgUnitPath=%2F&type=allIncludingParent`,
    OrgUnitsSchema,
    { flatten: "organizationUnits" }
  );

  if (organizationUnits.length === 0) {
    throw new Error("No org units found");
  }

  const root = organizationUnits.find((ou) => ou.orgUnitPath === "/");
  const id =
    root ? root.orgUnitId : (organizationUnits[0].parentOrgUnitId ?? "");
  return extractResourceId(id, ResourceTypes.OrgUnitId);
}

export default defineStep(StepId.AssignUsersToSso)
  .requires(
    Var.GoogleAccessToken,
    Var.SamlProfileId,
    Var.IsDomainVerified,
    Var.AutomationOuPath
  )
  .provides()

  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * {
   *   "inboundSsoAssignments": [
   *     { "name": "assignment/1", "ssoMode": "SAML_SSO" },
   *     { "name": "assignment/2", "ssoMode": "OFF" }
   *   ]
   * }
   *
   * Success response (200) – empty
   * { "inboundSsoAssignments": [] }
   */

  .check(
    async ({
      vars,
      google,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log
    }) => {
      try {
        const AssignSchema = z.object({
          inboundSsoAssignments: z
            .array(
              z.object({
                targetGroup: z.string().optional(),
                targetOrgUnit: z.string().optional(),
                ssoMode: z.string().optional(),
                samlSsoInfo: z
                  .object({ inboundSamlSsoProfile: z.string() })
                  .optional()
              })
            )
            .optional()
        });

        const profileId = vars.require(Var.SamlProfileId);
        const automationOuPath = vars.require(Var.AutomationOuPath);

        const { inboundSsoAssignments = [] } = await google.get(
          ApiEndpoint.Google.SsoAssignments,
          AssignSchema,
          { flatten: "inboundSsoAssignments" }
        );
        // Extract: assignmentExists = inboundSsoAssignments.some(...)

        const rootId = await getRootOrgUnitId(google);
        const rootAssigned = inboundSsoAssignments.some(
          (assignment) =>
            assignment.targetOrgUnit === `orgUnits/${rootId}`
            && assignment.samlSsoInfo?.inboundSamlSsoProfile === profileId
            && assignment.ssoMode === "SAML_SSO"
        );

        const automationExcluded = inboundSsoAssignments.some(
          (assignment) =>
            assignment.targetOrgUnit === automationOuPath
            && assignment.ssoMode === "SSO_OFF"
        );

        if (rootAssigned && automationExcluded) {
          log(LogLevel.Info, "All users already assigned to SSO");
          markComplete({});
        } else {
          markIncomplete("Users not assigned to SSO", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check SSO assignment", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, google, output, markFailed, markPending, log }) => {
    /**
     * POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
     * {
     *   "targetGroup": "groups/allUsers",
     *   "samlSsoInfo": { "inboundSamlSsoProfile": "{samlProfileId}" },
     *   "ssoMode": "SAML_SSO"
     * }
     *
     * Success response
     *
     * 200
     * {}
     *
     * Error response
     *
     * 409
     * { "error": { "message": "Assignment already exists" } }
     */
    try {
      const profileId = vars.require(Var.SamlProfileId);
      const automationOuPath = vars.require(Var.AutomationOuPath);

      const OpSchema = z.object({
        name: z.string(),
        done: z.boolean(),
        error: z
          .object({
            message: z.string(),
            code: z.number().optional(),
            status: z.string().optional()
          })
          .optional()
      });

      /**
       * POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
       * Headers: { Authorization: Bearer {googleAccessToken} }
       * Body:
       * {
       *   "targetGroup": "groups/allUsers",
       *   "samlSsoInfo": { "inboundSamlSsoProfile": "{profileId}" },
       *   "ssoMode": "SAML_SSO"
       * }
       *
       * Success response (200)
       * { "done": true }
       *
       * Error response (409)
       * { "error": { "code": 409, "message": "Assignment exists" } }
       */
      const rootId = await getRootOrgUnitId(google);
      const op = await google.post(
        ApiEndpoint.Google.SsoAssignments,
        OpSchema,
        {
          targetOrgUnit: `orgUnits/${rootId}`,
          samlSsoInfo: { inboundSamlSsoProfile: profileId },
          ssoMode: "SAML_SSO"
        }
      );
      if (!op.done) {
        markPending("User assignment operation in progress");
        return;
      }

      if (op.error) {
        log(LogLevel.Error, "Assignment failed", { error: op.error });
        markFailed(op.error.message);
        return;
      }

      // Exclude automation OU from SSO
      await google.post(ApiEndpoint.Google.SsoAssignments, OpSchema, {
        targetOrgUnit: automationOuPath,
        ssoMode: "SSO_OFF"
      });

      output({});
    } catch (error) {
      // isConflictError handles: 409
      if (isConflictError(error)) {
        output({});
      } else if (isNotFoundError(error)) {
        log(LogLevel.Error, "SAML profile not found", { error });
        markFailed(
          "SAML profile missing. Run 'Complete Google SSO setup' first."
        );
      } else if (isHttpError(error, 400)) {
        log(LogLevel.Error, "Invalid SSO profile", { error });
        markFailed(
          "SSO profile incomplete or missing. Run 'Complete Google SSO setup' first."
        );
      } else {
        log(LogLevel.Error, "Failed to assign users to SSO", { error });
        markFailed(error instanceof Error ? error.message : "Execute failed");
      }
    }
  })
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const profileId = vars.get(Var.SamlProfileId);
      if (!profileId) {
        markFailed("Missing samlProfileId");
        return;
      }
      const AssignSchema = z.object({
        inboundSsoAssignments: z
          .array(
            z.object({
              name: z.string(),
              targetGroup: z.string().optional(),
              targetOrgUnit: z.string().optional(),
              ssoMode: z.string().optional(),
              samlSsoInfo: z
                .object({ inboundSamlSsoProfile: z.string() })
                .optional()
            })
          )
          .optional()
      });

      const { inboundSsoAssignments = [] } = await google.get(
        ApiEndpoint.Google.SsoAssignments,
        AssignSchema,
        { flatten: "inboundSsoAssignments" }
      );
      // Extract: assignmentName = inboundSsoAssignments.find(...).name

      const automationOuPath = vars.require(Var.AutomationOuPath);

      const rootId = await getRootOrgUnitId(google);
      const rootAssignment = inboundSsoAssignments.find(
        (item) =>
          item.targetOrgUnit === `orgUnits/${rootId}`
          && item.samlSsoInfo?.inboundSamlSsoProfile === profileId
          && item.ssoMode === "SAML_SSO"
      );

      if (rootAssignment) {
        const id = extractResourceId(
          rootAssignment.name,
          ResourceTypes.InboundSsoAssignments
        );
        await google.delete(
          `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(id)}`,
          EmptyResponseSchema
        );
      }

      const automationAssignment = inboundSsoAssignments.find(
        (item) =>
          item.targetOrgUnit === automationOuPath && item.ssoMode === "SSO_OFF"
      );

      if (automationAssignment) {
        const id = extractResourceId(
          automationAssignment.name,
          ResourceTypes.InboundSsoAssignments
        );
        await google.delete(
          `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(id)}`,
          EmptyResponseSchema
        );
      }

      markReverted();
    } catch (error) {
      // isNotFoundError handles: 404
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete SSO assignment", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
