import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

interface CheckData {
  samlProfileId?: string;
  entityId?: string;
  acsUrl?: string;
}

export default createStep<CheckData>({
  id: StepId.ConfigureGoogleSamlProfile,
  requires: [Var.GoogleAccessToken, Var.IsDomainVerified],
  provides: [Var.SamlProfileId, Var.EntityId, Var.AcsUrl],

  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles
   *
   * Completed step example response
   *
   * 200
   * {
   *   "inboundSamlSsoProfiles": [
   *     { "name": "inboundSamlSsoProfiles/01vopt8u1nhy22o" }
   *   ]
   * }
   *
   * Incomplete step example response
   *
   * 200
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

  async execute({ fetchGoogle, markSucceeded, markFailed, markPending, log }) {
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
          displayName: "Azure AD",
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
  }
});
