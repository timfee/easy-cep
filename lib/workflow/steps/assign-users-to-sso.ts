import { ApiEndpoint, GroupId } from "@/constants";
import {
  EmptyResponseSchema,
  isConflictError,
  isNotFoundError
} from "@/lib/workflow/utils";
import type { WorkflowVars } from "@/types";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

type CheckData = Partial<Pick<WorkflowVars, never>>;

export default defineStep<CheckData>(StepId.AssignUsersToSso)
  .requires(Var.GoogleAccessToken, Var.SamlProfileId, Var.IsDomainVerified)
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

        const { inboundSsoAssignments = [] } = await google.get(
          ApiEndpoint.Google.SsoAssignments,
          AssignSchema,
          { flatten: "inboundSsoAssignments" }
        );
        // Extract: assignmentExists = inboundSsoAssignments.some(...)

        const exists = inboundSsoAssignments.some(
          (a) =>
            a.samlSsoInfo?.inboundSamlSsoProfile === profileId
            && a.ssoMode === "SAML_SSO"
        );

        if (exists) {
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
      const op = await google.post(
        ApiEndpoint.Google.SsoAssignments,
        OpSchema,
        {
          targetGroup: `groups/${GroupId.AllUsers}`,
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

      output({});
    } catch (error) {
      // isConflictError handles: 409
      if (isConflictError(error)) {
        output({});
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

      const assignment = inboundSsoAssignments.find(
        (a) =>
          a.samlSsoInfo?.inboundSamlSsoProfile === profileId
          && a.ssoMode === "SAML_SSO"
      );

      if (assignment) {
        const id = assignment.name.replace(
          /^(?:.*\/)?inboundSsoAssignments\//,
          ""
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
