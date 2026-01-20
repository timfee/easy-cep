import { isNotFoundError } from "@/lib/workflow/core/errors";
import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";
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
        const profileResourceId = extractResourceId(
          profileId,
          ResourceTypes.InboundSamlSsoProfiles
        );

        const profile = (await google.samlProfiles
          .get(profileResourceId)
          .get()) as {
          idpConfig?: {
            entityId?: string;
            singleSignOnServiceUri?: string;
            signOutUri?: string;
          };
        };

        let idpCredentials: { name: string }[] = [];
        try {
          const credsResponse = (await google.samlProfiles
            .credentials(profileResourceId)
            .list()
            .get()) as { idpCredentials?: { name: string }[] };
          idpCredentials = credsResponse.idpCredentials ?? [];
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }

        if (idpCredentials.length >= 2) {
          log(LogLevel.Info, "Google SSO already configured", {
            hasCredentials: true,
            hasEntityId: true,
            hasLoginUrl: true,
            hasSignOutUrl: true,
          });
          markComplete({});
          return;
        }

        const idpConfig = profile.idpConfig ?? {};
        const hasEntityId = Boolean(idpConfig.entityId);
        const hasLoginUrl = Boolean(idpConfig.singleSignOnServiceUri);
        const hasSignOutUrl = Boolean(idpConfig.signOutUri);
        const hasCredentials = idpCredentials.length > 0;

        if (hasEntityId && hasLoginUrl && hasSignOutUrl && hasCredentials) {
          log(LogLevel.Info, "Google SSO already configured");
          markComplete({});
        } else {
          log(LogLevel.Info, "Google SSO configuration incomplete", {
            hasCredentials,
            hasEntityId,
            hasLoginUrl,
            hasSignOutUrl,
          });
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
  .execute(async ({ vars, google, output, markFailed, markPending, log }) => {
    try {
      const profileId = vars.require(Var.SamlProfileId);
      const profileResourceId = extractResourceId(
        profileId,
        ResourceTypes.InboundSamlSsoProfiles
      );
      const signingCert = vars.require(Var.MsSigningCertificate);
      const loginUrl = vars.require(Var.MsSsoLoginUrl);
      const entityId = vars.require(Var.MsSsoEntityId);

      log(
        LogLevel.Info,
        "Updating Google SAML profile with Azure AD configuration"
      );

      const updateMask =
        "idpConfig.entityId,idpConfig.singleSignOnServiceUri,idpConfig.changePasswordUri";

      const updateOp = (await google.samlProfiles
        .update(profileResourceId)
        .query({ updateMask })
        .patch({
          idpConfig: {
            changePasswordUri:
              "https://account.activedirectory.windowsazure.com/ChangePassword.aspx",
            entityId,
            singleSignOnServiceUri: loginUrl,
          },
        })) as { done?: boolean; error?: { message: string } };

      if (!updateOp.done) {
        markPending("SAML profile update in progress");
        return;
      }

      if (updateOp.error) {
        log(LogLevel.Error, "SAML profile update failed", {
          error: updateOp.error,
        });
        markFailed(updateOp.error.message);
        return;
      }

      let idpCredentials: { name: string }[] = [];
      try {
        const credsResponse = (await google.samlProfiles
          .credentials(profileResourceId)
          .list()
          .get()) as { idpCredentials?: { name: string }[] };
        idpCredentials = credsResponse.idpCredentials ?? [];
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      if (idpCredentials.length >= 2) {
        log(LogLevel.Info, "Google SSO already has max certificates", {
          count: idpCredentials.length,
        });
        output({});
        return;
      }

      log(LogLevel.Info, "Uploading SAML certificate to Google", {
        existingCredentials: idpCredentials.length,
      });

      const pemCert = signingCert.includes("BEGIN CERTIFICATE")
        ? signingCert
        : `-----BEGIN CERTIFICATE-----\n${signingCert}\n-----END CERTIFICATE-----`;

      const certOp = (await google.samlProfiles
        .credentials(profileResourceId)
        .add()
        .post({ pemData: pemCert })) as {
        done?: boolean;
        error?: { message: string };
      };

      if (!certOp.done) {
        markPending("Certificate upload in progress");
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
      const profileResourceId = extractResourceId(
        profileId,
        ResourceTypes.InboundSamlSsoProfiles
      );

      const { idpCredentials = [] } = (await google.samlProfiles
        .credentials(profileResourceId)
        .list()
        .get()) as { idpCredentials?: { name: string }[] };

      for (const cred of idpCredentials) {
        try {
          const credId = cred.name.split("/").pop();
          if (!credId) {
            continue;
          }
          await google.samlProfiles
            .credentials(profileResourceId)
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
