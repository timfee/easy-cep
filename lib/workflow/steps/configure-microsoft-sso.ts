import { ApiEndpoint } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/errors";
import { EmptyResponseSchema } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { TIME } from "../constants/workflow-limits";
import { defineStep } from "../step-builder";
import { ServicePrincipalIdSchema } from "../types/api-schemas";

export default defineStep(StepId.ConfigureMicrosoftSso)
  .requires(
    Var.MsGraphToken,
    Var.SsoServicePrincipalId,
    Var.SsoAppId,
    Var.EntityId,
    Var.AcsUrl
  )
  .provides(Var.MsSigningCertificate, Var.MsSsoLoginUrl, Var.MsSsoEntityId)
  /**
   * GET https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}?$select=preferredSingleSignOnMode,samlSingleSignOnSettings
   * Headers: { Authorization: Bearer {msGraphToken} }
   *
   * Success response (200)
   * { "preferredSingleSignOnMode": "saml", "samlSingleSignOnSettings": { "relayState": "" } }
   *
   * GET https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/tokenSigningCertificates
   * Headers: { Authorization: Bearer {msGraphToken} }
   *
   * Success response (200)
   * { "value": [ { "keyId": "...", "key": "MII...", "startDateTime": "2024-01-01T00:00:00Z", "endDateTime": "2025-01-01T00:00:00Z" } ] }
   * Error response (404)
   * { "error": { "code": "Request_ResourceNotFound" } }
   */

  .check(
    async ({
      vars,
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log
    }) => {
      try {
        const spId = vars.require(Var.SsoServicePrincipalId);

        const SpSchema = z.object({
          preferredSingleSignOnMode: z.string().nullable(),
          samlSingleSignOnSettings: z
            .object({ relayState: z.string().nullable() })
            .nullable()
        });

        const sp = await microsoft.get(
          `${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}?$select=preferredSingleSignOnMode,samlSingleSignOnSettings`,
          SpSchema
        );

        if (sp.preferredSingleSignOnMode === "saml") {
          log(LogLevel.Info, "Microsoft SSO already configured");

          // Need to fetch certificate to pass to Google
          const CertSchema = z.object({
            value: z.array(
              z.object({
                keyId: z.string(),
                startDateTime: z.string(),
                endDateTime: z.string(),
                key: z.string().nullable()
              })
            )
          });

          let certs: z.infer<typeof CertSchema>;
          try {
            certs = await microsoft.get(
              ApiEndpoint.Microsoft.TokenSigningCertificates(spId),
              CertSchema
            );
          } catch (error) {
            // isNotFoundError handles: 404
            if (isNotFoundError(error)) {
              certs = { value: [] };
            } else {
              throw error;
            }
          }

          const now = new Date();
          const activeCert = certs.value.find((cert) => {
            const start = new Date(cert.startDateTime);
            const end = new Date(cert.endDateTime);
            return start <= now && now <= end && cert.key;
          });

          if (activeCert?.key) {
            const TenantSchema = ServicePrincipalIdSchema;
            const tenantInfo = await microsoft.get(
              ApiEndpoint.Microsoft.Organization,
              TenantSchema
            );
            const tenantId = tenantInfo.value[0]?.id;

            markComplete({
              msSigningCertificate: activeCert.key,
              msSsoLoginUrl: `https://login.microsoftonline.com/${tenantId}/saml2`,
              msSsoEntityId: `https://sts.windows.net/${tenantId}/`
            });
          } else {
            log(LogLevel.Info, "SSO configured but certificate missing");
            markIncomplete("SSO configured but certificate missing", {});
          }
        } else {
          log(LogLevel.Info, "Microsoft SSO not configured");
          markIncomplete("Microsoft SSO not configured", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check SSO configuration", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
    /**
     * PATCH https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}
     * Body: { preferredSingleSignOnMode: "saml" }
     *
     * GET https://graph.microsoft.com/v1.0/organization
     *
     * PATCH https://graph.microsoft.com/v1.0/servicePrincipals/{ssoServicePrincipalId}
     * Body: { samlSingleSignOnSettings: { relayState: "" } }
     *
     * GET https://graph.microsoft.com/v1.0/applications?$filter=appId eq {ssoAppId}
     *
     * PATCH https://graph.microsoft.com/v1.0/applications/{applicationObjectId}
     * Body: { identifierUris: [entityId], web: { redirectUris: [acsUrl] } }
     *
     * POST https://graph.microsoft.com/beta/servicePrincipals/{ssoServicePrincipalId}/addTokenSigningCertificate
     * Body: { displayName: "CN=Google Workspace SSO", endDateTime: "{iso}" }
     * Success response (201) { "key": "MII..." }
     */
  )
  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    try {
      const spId = vars.require(Var.SsoServicePrincipalId);
      const appId = vars.require(Var.SsoAppId);
      const entityId = vars.require(Var.EntityId);
      const acsUrl = vars.require(Var.AcsUrl);

      log(LogLevel.Info, "Setting SSO mode to SAML");

      // 1. Set preferred SSO mode on service principal
      await microsoft.patch(
        `${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`,
        EmptyResponseSchema,
        { preferredSingleSignOnMode: "saml" }
      );

      // 2. Get tenant ID for URLs
      const TenantSchema = ServicePrincipalIdSchema;
      const tenantInfo = await microsoft.get(
        ApiEndpoint.Microsoft.Organization,
        TenantSchema
      );
      const tenantId = tenantInfo.value[0]?.id;
      if (!tenantId) {
        throw new Error("Unable to determine Microsoft tenant ID");
      }

      const loginUrl = `https://login.microsoftonline.com/${tenantId}/saml2`;
      const msSsoEntityId = `https://sts.windows.net/${tenantId}/`;

      // 3. Configure SAML settings on service principal
      await microsoft.patch(
        `${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`,
        EmptyResponseSchema,
        { samlSingleSignOnSettings: { relayState: "" } }
      );

      // 4. Get the application object ID (different from appId)
      const AppFilterSchema = ServicePrincipalIdSchema;
      const apps = await microsoft.get(
        `${ApiEndpoint.Microsoft.Applications}?$filter=appId eq '${appId}'`,
        AppFilterSchema
      );
      const applicationObjectId = apps.value[0]?.id;
      if (!applicationObjectId) {
        throw new Error("Unable to find application object");
      }

      // 5. Set identifier URIs and reply URLs on APPLICATION object
      log(LogLevel.Info, "Configuring application URLs");
      await microsoft.patch(
        `${ApiEndpoint.Microsoft.Applications}/${applicationObjectId}`,
        EmptyResponseSchema,
        { identifierUris: [entityId], web: { redirectUris: [acsUrl] } }
      );

      // 6. Create signing certificate
      log(LogLevel.Info, "Creating SAML signing certificate");
      const CertSchema = z.object({
        keyId: z.string(),
        type: z.string(),
        usage: z.string(),
        key: z.string().nullable()
      });

      const certResponse = await microsoft.post(
        ApiEndpoint.Microsoft.AddTokenSigningCertificate(spId),
        CertSchema,
        {
          displayName: "CN=Google Workspace SSO",
          endDateTime: new Date(Date.now() + TIME.YEAR).toISOString()
        }
      );

      if (!certResponse.key) {
        throw new Error("Failed to generate signing certificate");
      }

      log(LogLevel.Info, "Microsoft SSO configuration completed");
      output({
        msSigningCertificate: certResponse.key,
        msSsoLoginUrl: loginUrl,
        msSsoEntityId: msSsoEntityId
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to configure Microsoft SSO", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  /**
   * Undo SSO configuration by resetting mode and removing certificates
   */
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const spId = vars.get(Var.SsoServicePrincipalId);
      if (!spId) {
        markReverted();
        return;
      }

      // Reset SSO mode
      try {
        await microsoft.patch(
          `${ApiEndpoint.Microsoft.ServicePrincipals}/${spId}`,
          EmptyResponseSchema,
          { preferredSingleSignOnMode: null }
        );
      } catch (error) {
        log(LogLevel.Warn, "Failed to reset SSO mode", { error });
      }

      // Remove signing certificates
      try {
        const CertSchema = z.object({
          value: z.array(z.object({ keyId: z.string() }))
        });
        const certs = await microsoft.get(
          ApiEndpoint.Microsoft.TokenSigningCertificates(spId),
          CertSchema
        );

        for (const cert of certs.value) {
          await microsoft.delete(
            `${ApiEndpoint.Microsoft.TokenSigningCertificates(spId)}/${cert.keyId}`,
            EmptyResponseSchema
          );
        }
      } catch (error) {
        log(LogLevel.Warn, "Failed to remove certificates", { error });
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to undo SSO configuration", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
