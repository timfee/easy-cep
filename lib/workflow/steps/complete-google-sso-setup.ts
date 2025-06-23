import { isNotFoundError } from "@/lib/workflow/errors";
import { LogLevel, StepId, Var } from "@/types";
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

        const profile = await google.samlProfiles.get(profileId).get();

        const { idpCredentials = [] } = await google.samlProfiles
          .credentials(profileId)
          .list()
          .get();

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
          log(LogLevel.Info, "Google SSO configuration incomplete");
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

      const updateMask =
        "idpConfig.entityId,idpConfig.singleSignOnServiceUri,idpConfig.signOutUri,idpConfig.changePasswordUri";

      const updateOp = await google.samlProfiles
        .update(profileId)
        .query({ updateMask })
        .patch({
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

      const certOp = await google.samlProfiles
        .credentials(profileId)
        .add()
        .post({ pemData: pemCert });

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

      const { idpCredentials = [] } = await google.samlProfiles
        .credentials(profileId)
        .list()
        .get();

      for (const cred of idpCredentials) {
        try {
          const credId = cred.name.split("/").pop();
          if (credId) {
            await google.samlProfiles
              .credentials(profileId)
              .delete(credId)
              .delete();
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
