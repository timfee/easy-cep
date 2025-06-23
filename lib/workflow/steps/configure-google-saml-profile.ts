import { isNotFoundError } from "@/lib/workflow/core/errors";
import { LogLevel, StepId, Var } from "@/types";
import { WORKFLOW_LIMITS } from "../constants/workflow-limits";
import { defineStep } from "../step-builder";

export default defineStep(StepId.ConfigureGoogleSamlProfile)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.SamlProfileDisplayName
  )
  .provides(Var.SamlProfileId, Var.EntityId, Var.AcsUrl)

  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * {
   *   "inboundSamlSsoProfiles": [ { "name": "inboundSamlSsoProfiles/01" } ]
   * }
   *
   * Success response (200) – empty
   * { "inboundSamlSsoProfiles": [] }
   */

  .check(
    async ({ google, markComplete, markIncomplete, markCheckFailed, log }) => {
      try {
        const { inboundSamlSsoProfiles = [] } = await google.samlProfiles
          .list()
          .get();

        if (
          inboundSamlSsoProfiles.length
          > WORKFLOW_LIMITS.SAML_PROFILES_WARNING_THRESHOLD
        ) {
          log(
            LogLevel.Info,
            `Found ${inboundSamlSsoProfiles.length} SAML profiles - nearing API limits`
          );
        }
        // Extract: samlProfileId = inboundSamlSsoProfiles[0]?.name

        if (inboundSamlSsoProfiles.length > 0) {
          const profile = inboundSamlSsoProfiles[0];
          log(LogLevel.Info, "SAML profile already exists");
          markComplete({
            samlProfileId: profile.name,
            entityId: profile.spConfig.entityId,
            acsUrl: profile.spConfig.assertionConsumerServiceUri
          });
        } else {
          log(LogLevel.Info, "SAML profile missing");
          markIncomplete("SAML profile missing", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check SAML profiles", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, google, output, markFailed, markPending, log }) => {
    /**
     * POST https://cloudidentity.googleapis.com/v1/customers/my_customer/inboundSamlSsoProfiles
     * Headers: { Authorization: Bearer {googleAccessToken} }
     * Body:
     * {
     *   "displayName": "Azure AD",
     *   "idpConfig": { "entityId": "", "singleSignOnServiceUri": "" }
     * }
     *
     * Success response (200)
     * {
     *   "name": "operations/abc123",
     *   "done": true,
     *   "response": { "name": "inboundSamlSsoProfiles/010xi5tr1szon40" }
     * }
     *
     * Error response (400)
     * { "error": { "code": 400, "message": "Invalid request" } }
     */
    try {
      const op = await google.samlProfiles
        .create()
        .post({
          displayName: vars.require(Var.SamlProfileDisplayName),
          idpConfig: { entityId: "", singleSignOnServiceUri: "" }
        });
      // Extract: samlProfileId = op.response?.name

      if (!op.done) {
        markPending("SAML profile creation in progress");
        return;
      }

      if (op.error) {
        log(LogLevel.Error, "Operation failed", { error: op.error });
        markFailed(op.error.message);
        return;
      }

      const profileName = op.response?.name;

      if (!profileName) {
        markFailed("Missing profile in response");
        return;
      }

      const profile = await google.samlProfiles.get(profileName).get();

      output({
        samlProfileId: profile.name,
        entityId: profile.spConfig.entityId,
        acsUrl: profile.spConfig.assertionConsumerServiceUri
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to create SAML profile", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const id = vars.get(Var.SamlProfileId);
      if (!id) {
        markFailed("Missing samlProfileId");
        return;
      }
      await google.samlProfiles.delete(id).delete();
      markReverted();
    } catch (error) {
      // isNotFoundError handles: 404
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete SAML profile", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
