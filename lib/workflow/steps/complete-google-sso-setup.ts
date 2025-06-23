import { ApiEndpoint } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/errors";
import { EmptyResponseSchema } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";
import { GoogleOperationSchema } from "../types/api-schemas";

export default defineStep(StepId.CompleteGoogleSsoSetup)
  .requires(
    Var.GoogleAccessToken,
    Var.SamlProfileId,
    Var.MsSigningCertificate,
    Var.MsSsoLoginUrl,
    Var.MsSsoEntityId
  )
  .provides()
  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles/{samlProfileId}
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * { "name": "profiles/{id}", "idpConfig": { ... }, "spConfig": { ... } }
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
        const profileId = vars.require(Var.SamlProfileId);

        const ProfileSchema = z.object({
          name: z.string(),
          idpConfig: z
            .object({
              entityId: z.string(),
              singleSignOnServiceUri: z.string(),
              signOutUri: z.string().optional()
            })
            .optional(),
          spConfig: z.object({
            entityId: z.string(),
            assertionConsumerServiceUri: z.string()
          })
        });

        const profile = await google.get(
          ApiEndpoint.Google.SamlProfile(profileId),
          ProfileSchema
        );

        const CredsSchema = z.object({
          idpCredentials: z.array(z.object({ name: z.string() })).optional()
        });

        const { idpCredentials = [] } = await google.get(
          ApiEndpoint.Google.SamlProfileCredentialsList(profileId),
          CredsSchema,
          { flatten: "idpCredentials" }
        );

        if (
          profile.idpConfig?.entityId
          && profile.idpConfig.singleSignOnServiceUri
          && profile.idpConfig.signOutUri
          && profile.idpConfig.entityId !== ""
          && profile.idpConfig.singleSignOnServiceUri !== ""
          && profile.idpConfig.signOutUri !== ""
          && idpCredentials.length > 0
        ) {
          log(LogLevel.Info, "Google SSO already configured");
          markComplete({});
        } else {
          markIncomplete("Google SSO configuration incomplete", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check SSO configuration", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
    /**
     * PATCH https://cloudidentity.googleapis.com/v1/{samlProfile}?updateMask=idpConfig.entityId,idpConfig.singleSignOnServiceUri,idpConfig.signOutUri,idpConfig.changePasswordUri
     * Headers: { Authorization: Bearer {googleAccessToken} }
     * Body: { idpConfig: { entityId, singleSignOnServiceUri, signOutUri, changePasswordUri } }
     *
     * POST https://cloudidentity.googleapis.com/v1/{samlProfile}/certificates
     * Headers: { Authorization: Bearer {googleAccessToken} }
     * Body: { pemData: "-----BEGIN CERTIFICATE-----..." }
     * Success response: { "done": true }
     */
  )
  .execute(async ({ vars, google, output, markFailed, log }) => {
    try {
      const profileId = vars.require(Var.SamlProfileId);
      const signingCert = vars.require(Var.MsSigningCertificate);
      const loginUrl = vars.require(Var.MsSsoLoginUrl);
      const entityId = vars.require(Var.MsSsoEntityId);

      log(
        LogLevel.Info,
        "Updating Google SAML profile with Azure AD configuration"
      );

      const UpdateSchema = GoogleOperationSchema.extend({
        response: z.unknown().optional()
      });

      const updateMask =
        "idpConfig.entityId,idpConfig.singleSignOnServiceUri,idpConfig.signOutUri,idpConfig.changePasswordUri";

      const patchUrl = `${ApiEndpoint.Google.SamlProfile(profileId)}?updateMask=${encodeURIComponent(updateMask)}`;

      const updateOp = await google.patch(patchUrl, UpdateSchema, {
        idpConfig: {
          entityId: entityId,
          singleSignOnServiceUri: loginUrl,
          signOutUri: loginUrl,
          changePasswordUri: `https://account.activedirectory.windowsazure.com/ChangePassword.aspx`
        }
      });

      if (!updateOp.done) {
        markFailed("SAML profile update operation not completed");
        return;
      }

      if (updateOp.error) {
        log(LogLevel.Error, "SAML profile update failed", {
          error: updateOp.error
        });
        markFailed(updateOp.error.message);
        return;
      }

      log(LogLevel.Info, "Uploading SAML certificate to Google");

      const pemCert =
        signingCert.includes("BEGIN CERTIFICATE") ? signingCert : (
          `-----BEGIN CERTIFICATE-----\n${signingCert}\n-----END CERTIFICATE-----`
        );

      const CertUploadSchema = GoogleOperationSchema;

      const certUrl = ApiEndpoint.Google.SamlProfileCredentials(profileId);

      const certOp = await google.post(certUrl, CertUploadSchema, {
        pemData: pemCert
      });

      if (!certOp.done) {
        markFailed("Certificate upload operation not completed");
        return;
      }

      if (certOp.error) {
        log(LogLevel.Error, "Certificate upload failed", {
          error: certOp.error
        });
        markFailed(certOp.error.message);
        return;
      }

      log(LogLevel.Info, "Google SSO configuration completed successfully");
      output({});
    } catch (error) {
      log(LogLevel.Error, "Failed to configure Google SSO", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  /**
   * Delete any uploaded certificates when reverting
   */
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const profileId = vars.get(Var.SamlProfileId);
      if (!profileId) {
        markReverted();
        return;
      }

      const CredsSchema = z.object({
        idpCredentials: z
          .array(
            z.object({ name: z.string(), updateTime: z.string().optional() })
          )
          .optional()
      });

      const { idpCredentials = [] } = await google.get(
        ApiEndpoint.Google.SamlProfileCredentialsList(profileId),
        CredsSchema,
        { flatten: "idpCredentials" }
      );

      for (const cred of idpCredentials) {
        try {
          const credId = cred.name.split("/").pop();
          if (credId) {
            await google.delete(
              `${ApiEndpoint.Google.SamlProfileCredentialsList(profileId)}/${credId}`,
              EmptyResponseSchema
            );
            log(LogLevel.Info, `Deleted certificate ${credId}`);
          }
        } catch (error) {
          log(LogLevel.Warn, `Failed to delete certificate`, { error });
        }
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to cleanup certificates", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
