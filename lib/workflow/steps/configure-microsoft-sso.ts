import { isNotFoundError } from "@/lib/workflow/core/errors";
import { LogLevel, StepId, Var } from "@/types";
import { TIME } from "../constants/workflow-limits";
import { defineStep } from "../step-builder";

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
      markStale,
      markCheckFailed,
      log
    }) => {
      try {
        const spId = vars.require(Var.SsoServicePrincipalId);

        const sp = await microsoft.servicePrincipals
          .getPartial(spId)
          .query({
            $select: "preferredSingleSignOnMode,samlSingleSignOnSettings"
          })
          .get();

        if (sp.preferredSingleSignOnMode === "saml") {
          log(LogLevel.Info, "Microsoft SSO already configured");

          // Need to fetch certificate to pass to Google
          let certs;
          try {
            certs = await microsoft.servicePrincipals
              .tokenSigningCertificates(spId)
              .list()
              .get();
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
            const tenantInfo = await microsoft.organization.get();
            const tenantId = tenantInfo.value[0]?.id;

            markComplete({
              msSigningCertificate: activeCert.key,
              msSsoLoginUrl: `https://login.microsoftonline.com/${tenantId}/saml2`,
              msSsoEntityId: `https://sts.windows.net/${tenantId}/`
            });
          } else {
            log(LogLevel.Info, "SSO configured but certificate missing");
            if (
              vars.get(Var.MsSigningCertificate)
              && vars.get(Var.MsSsoLoginUrl)
              && vars.get(Var.MsSsoEntityId)
            ) {
              markIncomplete("SSO configured but certificate missing", {});
            } else {
              markStale(
                "SSO configured but certificate lost. Re-run to regenerate."
              );
            }
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
    interface RollbackOperation {
      description: string;
      rollback: () => Promise<void>;
    }

    const completedOps: RollbackOperation[] = [];

    try {
      const spId = vars.require(Var.SsoServicePrincipalId);
      const appId = vars.require(Var.SsoAppId);
      const entityId = vars.require(Var.EntityId);
      const acsUrl = vars.require(Var.AcsUrl);

      log(LogLevel.Info, "Setting SSO mode to SAML");

      // 1. Set preferred SSO mode on service principal
      await microsoft.servicePrincipals
        .update(spId)
        .patch({ preferredSingleSignOnMode: "saml" });
      completedOps.push({
        description: "Reset SSO mode",
        rollback: async () => {
          await microsoft.servicePrincipals
            .update(spId)
            .patch({ preferredSingleSignOnMode: null });
        }
      });

      // 2. Get tenant ID for URLs
      const tenantInfo = await microsoft.organization.get();
      const tenantId = tenantInfo.value[0]?.id;
      if (!tenantId) {
        throw new Error("Unable to determine Microsoft tenant ID");
      }

      const loginUrl = `https://login.microsoftonline.com/${tenantId}/saml2`;
      const msSsoEntityId = `https://sts.windows.net/${tenantId}/`;

      // 3. Configure SAML settings on service principal
      await microsoft.servicePrincipals
        .update(spId)
        .patch({ samlSingleSignOnSettings: { relayState: "" } });
      completedOps.push({
        description: "Clear SAML settings",
        rollback: async () => {
          await microsoft.servicePrincipals
            .update(spId)
            .patch({ samlSingleSignOnSettings: null });
        }
      });

      // 4. Get the application object ID (different from appId)
      const apps = await microsoft.applications
        .list()
        .query({ $filter: `appId eq '${appId}'` })
        .get();
      const applicationObjectId = apps.value[0]?.id;
      if (!applicationObjectId) {
        throw new Error("Unable to find application object");
      }

      // 5. Set identifier URIs and reply URLs on APPLICATION object
      log(LogLevel.Info, "Configuring application URLs");
      await microsoft.applications
        .update(applicationObjectId)
        .patch({ identifierUris: [entityId], web: { redirectUris: [acsUrl] } });
      completedOps.push({
        description: "Reset application URLs",
        rollback: async () => {
          await microsoft.applications
            .update(applicationObjectId)
            .patch({ identifierUris: [], web: { redirectUris: [] } });
        }
      });

      // 6. Create signing certificate
      log(LogLevel.Info, "Creating SAML signing certificate");
      const certResponse = await microsoft.servicePrincipals
        .addTokenSigningCertificate(spId)
        .post({
          displayName: "CN=Google Workspace SSO",
          endDateTime: new Date(Date.now() + TIME.YEAR).toISOString()
        });
      completedOps.push({
        description: "Delete token signing certificate",
        rollback: async () => {
          await microsoft.servicePrincipals
            .tokenSigningCertificates(spId)
            .delete(certResponse.keyId)
            .delete();
        }
      });

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
      log(LogLevel.Error, "SSO configuration failed, attempting rollback", {
        error
      });

      for (const op of completedOps.reverse()) {
        try {
          await op.rollback();
          log(LogLevel.Info, `Rolled back: ${op.description}`);
        } catch (rollbackError) {
          log(LogLevel.Info, `Failed to rollback: ${op.description}`, {
            rollbackError
          });
        }
      }

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
        await microsoft.servicePrincipals
          .update(spId)
          .patch({ preferredSingleSignOnMode: null });
      } catch (error) {
        log(LogLevel.Info, "Failed to reset SSO mode", { error });
      }

      // Remove signing certificates
      try {
        const certs = await microsoft.servicePrincipals
          .tokenSigningCertificates(spId)
          .list()
          .get();

        for (const cert of certs.value) {
          await microsoft.servicePrincipals
            .tokenSigningCertificates(spId)
            .delete(cert.keyId)
            .delete();
        }
      } catch (error) {
        log(LogLevel.Info, "Failed to remove certificates", { error });
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
