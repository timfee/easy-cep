import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

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

        if (
          profile.idpConfig?.entityId
          && profile.idpConfig.singleSignOnServiceUri
          && profile.idpConfig.entityId !== ""
          && profile.idpConfig.singleSignOnServiceUri !== ""
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

      const UpdateSchema = z.object({
        name: z.string(),
        done: z.boolean(),
        error: z
          .object({ message: z.string(), code: z.number().optional() })
          .optional(),
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

      const CertUploadSchema = z.object({
        name: z.string(),
        done: z.boolean(),
        error: z.object({ message: z.string() }).optional()
      });

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
   * No revert actions for Google configuration
   */
  .undo(async ({ markReverted }) => {
    markReverted();
  })
  .build();
