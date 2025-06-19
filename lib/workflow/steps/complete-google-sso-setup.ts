import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

export default defineStep(StepId.CompleteGoogleSsoSetup)
  .requires(
    Var.GoogleAccessToken,
    Var.MsGraphToken,
    Var.SamlProfileId,
    Var.SsoServicePrincipalId
  )
  .provides()

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
        const profileId = vars.require("samlProfileId");

        if (!profileId) {
          markIncomplete("SAML profile ID not provided", {});
          return;
        }

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
  )
  .execute(async ({ vars, google, microsoft, output, markFailed, log }) => {
    try {
      const profileId = vars.require("samlProfileId");
      const ssoSpId = vars.require("ssoServicePrincipalId");

      log(LogLevel.Info, "Fetching SAML metadata from Microsoft");

      const AppDetailsSchema = z.object({
        samlSingleSignOnSettings: z
          .object({
            loginUrl: z.string().nullable(),
            logoutUrl: z.string().nullable(),
            relayState: z.string().nullable()
          })
          .nullable(),
        preferredSingleSignOnMode: z.string().nullable(),
        identifierUris: z.array(z.string())
      });

      await microsoft.get(
        `${ApiEndpoint.Microsoft.ServicePrincipals}/${ssoSpId}?$select=samlSingleSignOnSettings,preferredSingleSignOnMode,identifierUris`,
        AppDetailsSchema
      );

      const TenantSchema = z.object({
        value: z.array(
          z.object({
            id: z.string(),
            verifiedDomains: z.array(
              z.object({ name: z.string(), isDefault: z.boolean() })
            )
          })
        )
      });

      const tenantInfo = await microsoft.get(
        ApiEndpoint.Microsoft.Organization,
        TenantSchema
      );

      // Example tenantInfo structure:
      // {
      //   id: "ef36b7bd-231b-421e-ac50-8f2995a39eee",
      //   verifiedDomains: [
      //     { name: "timcepnetnew.onmicrosoft.com", isDefault: false },
      //     { name: "cep-netnew.cc", isDefault: true }
      //   ]
      // }

      const tenantId = tenantInfo.value[0]?.id;
      if (!tenantId) {
        throw new Error("Unable to determine Microsoft tenant ID");
      }

      const idpEntityId = `https://sts.windows.net/${tenantId}/`;
      const ssoServiceUri = `https://login.microsoftonline.com/${tenantId}/saml2`;
      const signOutUri = `https://login.microsoftonline.com/${tenantId}/saml2`;

      log(LogLevel.Info, "Fetching SAML certificate from Microsoft");

      const CertSchema = z.object({
        value: z.array(
          z.object({
            customKeyIdentifier: z.string(),
            displayName: z.string().nullable(),
            endDateTime: z.string(),
            key: z.string().nullable(),
            keyId: z.string(),
            startDateTime: z.string(),
            type: z.string(),
            usage: z.string()
          })
        )
      });
      if (!ssoSpId) {
        throw new Error("SAML Service Principal ID not provided");
      }

      const certs = await microsoft.get(
        ApiEndpoint.Microsoft.TokenSigningCertificates(ssoSpId),
        CertSchema
      );

      // Example certs value (when certificates exist):
      // {
      //   value: [
      //     {
      //       keyId: "...",
      //       startDateTime: "2024-01-01T00:00:00Z",
      //       endDateTime: "2025-01-01T00:00:00Z",
      //       key: "MII...base64...",
      //       usage: "Signing"
      //     }
      //   ]
      // }

      const now = new Date();
      const activeCert = certs.value.find((cert) => {
        const start = new Date(cert.startDateTime);
        const end = new Date(cert.endDateTime);
        return start <= now && now <= end && cert.key;
      });

      if (!activeCert || !activeCert.key) {
        throw new Error("No active SAML signing certificate found");
      }

      const certData = activeCert.key;
      const pemCert =
        certData.includes("BEGIN CERTIFICATE") ? certData : (
          `-----BEGIN CERTIFICATE-----\n${certData}\n-----END CERTIFICATE-----`
        );

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

      if (!profileId) {
        throw new Error("SAML profile ID not provided");
      }

      const patchUrl = `${ApiEndpoint.Google.SamlProfile(profileId)}?updateMask=${encodeURIComponent(updateMask)}`;

      const updateOp = await google.patch(patchUrl, UpdateSchema, {
        idpConfig: {
          entityId: idpEntityId,
          singleSignOnServiceUri: ssoServiceUri,
          signOutUri: signOutUri,
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
  .undo(async ({ markReverted }) => {
    markReverted();
  })
  .build();
