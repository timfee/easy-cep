import { ApiEndpoint } from "@/constants";
import { EmptyResponseSchema, isNotFoundError } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

export default createStep({
  id: StepId.ConfigureGoogleSamlProfile,
  requires: [
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.SamlProfileDisplayName
  ],
  provides: [Var.SamlProfileId, Var.EntityId, Var.AcsUrl],

  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles
   *
   * Example success (200)
   * {
   *   "inboundSamlSsoProfiles": [
   *     {
   *       "name": "inboundSamlSsoProfiles/03rr0y8q3klp6gw",
   *       "displayName": "Test SAML 1750028141404"
   *     }
   *   ]
   * }
   *
   * Example none found (200)
   * { "inboundSamlSsoProfiles": [] }
   */

  async check({
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const ProfilesSchema = z.object({
        inboundSamlSsoProfiles: z
          .array(
            z.object({
              name: z.string(),
              spConfig: z.object({
                entityId: z.string(),
                assertionConsumerServiceUri: z.string()
              })
            })
          )
          .optional()
      });

      const { inboundSamlSsoProfiles = [] } = await fetchGoogle(
        ApiEndpoint.Google.SsoProfiles,
        ProfilesSchema,
        { flatten: true }
      );

      if (inboundSamlSsoProfiles.length > 0) {
        const profile = inboundSamlSsoProfiles[0];
        log(LogLevel.Info, "SAML profile already exists");
        markComplete({
          samlProfileId: profile.name,
          entityId: profile.spConfig.entityId,
          acsUrl: profile.spConfig.assertionConsumerServiceUri
        });
      } else {
        markIncomplete("SAML profile missing", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check SAML profiles", { error });
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
     * POST https://cloudidentity.googleapis.com/v1/customers/my_customer/inboundSamlSsoProfiles
     * {
     *   "displayName": "Azure AD",
     *   "idpConfig": { "entityId": "", "singleSignOnServiceUri": "" }
     * }
     *
     * Success response
     *
     * 200
     * { "response": { "name": "inboundSamlSsoProfiles/010xi5tr1szon40" } }
     *
     * Error response
     *
     * 400
     * { "error": { "message": "Invalid request" } }
     */
    try {
      const CreateSchema = z.object({
        name: z.string(),
        spConfig: z.object({
          entityId: z.string(),
          assertionConsumerServiceUri: z.string()
        })
      });

      const opSchema = z.object({
        name: z.string(),
        done: z.boolean(),
        response: CreateSchema.optional(),
        error: z
          .object({
            message: z.string(),
            code: z.number().optional(),
            status: z.string().optional()
          })
          .optional()
      });

      const createUrl = `${ApiEndpoint.Google.SsoProfiles.replace(
        "/inboundSamlSsoProfiles",
        "/customers/my_customer/inboundSamlSsoProfiles"
      )}`;
      const op = await fetchGoogle(createUrl, opSchema, {
        method: "POST",
        body: JSON.stringify({
          displayName: getVar(vars, Var.SamlProfileDisplayName),
          idpConfig: { entityId: "", singleSignOnServiceUri: "" }
        })
      });

      if (!op.done) {
        markPending("SAML profile creation in progress");
        return;
      }

      if (op.error) {
        log(LogLevel.Error, "Operation failed", { error: op.error });
        markFailed(op.error.message);
        return;
      }

      const profile = op.response;

      if (!profile) {
        markFailed("Missing profile in response");
        return;
      }

      markSucceeded({
        [Var.SamlProfileId]: profile.name,
        [Var.EntityId]: profile.spConfig.entityId,
        [Var.AcsUrl]: profile.spConfig.assertionConsumerServiceUri
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to create SAML profile", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  },
  undo: async ({ vars, fetchGoogle, markReverted, markFailed, log }) => {
    try {
      const id = vars[Var.SamlProfileId] as string | undefined;
      if (!id) {
        markFailed("Missing samlProfileId");
        return;
      }
      await fetchGoogle(
        `${ApiEndpoint.Google.SsoProfiles}/${encodeURIComponent(id)}`,
        EmptyResponseSchema,
        { method: "DELETE" }
      );
      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete SAML profile", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
