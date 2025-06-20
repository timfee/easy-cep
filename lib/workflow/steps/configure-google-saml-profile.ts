import { ApiEndpoint } from "@/constants";
import { EmptyResponseSchema, isNotFoundError } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
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

        const { inboundSamlSsoProfiles = [] } = await google.get(
          ApiEndpoint.Google.SsoProfiles,
          ProfilesSchema,
          { flatten: "inboundSamlSsoProfiles" }
        );
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
      const op = await google.post(createUrl, opSchema, {
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

      const profile = op.response;

      if (!profile) {
        markFailed("Missing profile in response");
        return;
      }

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
      await google.delete(
        ApiEndpoint.Google.SamlProfile(id),
        EmptyResponseSchema
      );
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
