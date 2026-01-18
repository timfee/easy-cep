import { isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";
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

  .check(
    async ({
      vars,
      google,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log,
    }) => {
      try {
        const profileId = vars.require(Var.SamlProfileId);

        const profile = (await google.samlProfiles.get(profileId).get()) as {
          idpConfig?: {
            entityId?: string;
            singleSignOnServiceUri?: string;
            signOutUri?: string;
          };
        };

        const { idpCredentials = [] } = (await google.samlProfiles
          .credentials(profileId)
          .list()
          .get()) as { idpCredentials?: Array<{ name: string }> };

        if (
          profile.idpConfig?.entityId &&
          profile.idpConfig.singleSignOnServiceUri &&
          profile.idpConfig.signOutUri &&
          profile.idpConfig.entityId !== "" &&
          profile.idpConfig.singleSignOnServiceUri !== "" &&
          profile.idpConfig.signOutUri !== "" &&
          idpCredentials.length > 0
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

      const updateOp = (await google.samlProfiles
        .update(profileId)
        .query({ updateMask })
        .patch({
          idpConfig: {
            entityId,
            singleSignOnServiceUri: loginUrl,
            signOutUri: loginUrl,
            changePasswordUri:
              "https://account.activedirectory.windowsazure.com/ChangePassword.aspx",
          },
        })) as { done: boolean; error?: { message: string } };

      if (!updateOp.done) {
        markFailed("SAML profile update operation not completed");
        return;
      }

      if (updateOp.error) {
        log(LogLevel.Error, "SAML profile update failed", {
          error: updateOp.error,
        });
        markFailed(updateOp.error.message);
        return;
      }

      log(LogLevel.Info, "Uploading SAML certificate to Google");

      const pemCert = signingCert.includes("BEGIN CERTIFICATE")
        ? signingCert
        : `-----BEGIN CERTIFICATE-----\n${signingCert}\n-----END CERTIFICATE-----`;

      const certOp = (await google.samlProfiles
        .credentials(profileId)
        .add()
        .post({ pemData: pemCert })) as {
        done: boolean;
        error?: { message: string };
      };

      if (!certOp.done) {
        markFailed("Certificate upload operation not completed");
        return;
      }

      if (certOp.error) {
        log(LogLevel.Error, "Certificate upload failed", {
          error: certOp.error,
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
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const profileId = vars.require(Var.SamlProfileId);

      const { idpCredentials = [] } = (await google.samlProfiles
        .credentials(profileId)
        .list()
        .get()) as { idpCredentials?: Array<{ name: string }> };

      for (const cred of idpCredentials) {
        try {
          const credId = cred.name.split("/").pop();
          if (!credId) {
            continue;
          }
          await google.samlProfiles
            .credentials(profileId)
            .delete(credId)
            .delete();
          log(LogLevel.Info, `Deleted certificate ${credId}`);
        } catch (error) {
          log(LogLevel.Info, "Failed to delete certificate", { error });
        }
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
        return;
      }
      log(LogLevel.Error, "Failed to cleanup certificates", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
