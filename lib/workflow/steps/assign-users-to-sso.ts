import { isConflictError } from "@/lib/workflow/utils";
import { ApiEndpoint, GroupId } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CheckData {}

export default createStep<CheckData>({
  id: StepId.AssignUsersToSso,
  requires: [Var.GoogleAccessToken, Var.SamlProfileId, Var.IsDomainVerified],
  provides: [],

  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
   *
   * Completed step example response
   *
   * 200
   * { "inboundSsoAssignments": [ { "targetGroup": "groups/allUsers" } ] }
   *
   * Incomplete step example response
   *
   * 200
   * { "inboundSsoAssignments": [] }
   */

  async check({
    vars,
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const AssignSchema = z.object({
        inboundSsoAssignments: z
          .array(
            z.object({
              targetGroup: z.string().optional(),
              targetOrgUnit: z.string().optional(),
              samlSsoInfo: z
                .object({ inboundSamlSsoProfile: z.string() })
                .optional()
            })
          )
          .optional()
      });

      const profileId = getVar(vars, Var.SamlProfileId);

      const { inboundSsoAssignments = [] } = await fetchGoogle(
        ApiEndpoint.Google.SsoAssignments,
        AssignSchema,
        { flatten: true }
      );

      const target = `groups/${GroupId.AllUsers}`;
      const exists = inboundSsoAssignments.some(
        (a) =>
          a.targetGroup === target
          && a.samlSsoInfo?.inboundSamlSsoProfile === profileId
      );

      if (exists) {
        log(LogLevel.Info, "All users already assigned to SSO");
        markComplete({});
      } else {
        markIncomplete("Users not assigned to SSO", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check SSO assignment", { error });
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({
    vars,
    fetchGoogle,
    markSucceeded,
    markFailed,
    markPending,
    log
  }) {
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
      const profileId = getVar(vars, Var.SamlProfileId);

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

      const op = await fetchGoogle(
        ApiEndpoint.Google.SsoAssignments,
        OpSchema,
        {
          method: "POST",
          body: JSON.stringify({
            targetGroup: `groups/${GroupId.AllUsers}`,
            samlSsoInfo: { inboundSamlSsoProfile: profileId },
            ssoMode: "SAML_SSO"
          })
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

      markSucceeded({});
    } catch (error) {
      if (isConflictError(error)) {
        markSucceeded({});
      } else {
        log(LogLevel.Error, "Failed to assign users to SSO", { error });
        markFailed(error instanceof Error ? error.message : "Execute failed");
      }
    }
  }
});
