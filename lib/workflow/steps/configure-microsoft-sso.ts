import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";

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

  .check(
    async ({
      vars,
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log,
    }) => {
      try {
        const spId = vars.require(Var.SsoServicePrincipalId);

        const sp = (await microsoft.servicePrincipals
          .getPartial(spId)
          .query({
            $select: "preferredSingleSignOnMode,samlSingleSignOnSettings,keyCredentials",
          })
          .get()) as {
          preferredSingleSignOnMode?: string | null;
          samlSingleSignOnSettings?: { relayState: string | null } | null;
          keyCredentials?: {
            key?: string | null;
            startDateTime?: string | null;
            endDateTime?: string | null;
            usage?: string | null;
          }[];
        };

        if (sp.preferredSingleSignOnMode !== "saml") {
          log(LogLevel.Info, "Microsoft SSO not configured");
          markIncomplete("Microsoft SSO not configured", {});
          return;
        }

        log(LogLevel.Info, "Microsoft SSO already configured");
        const now = new Date();
        const activeCert = sp.keyCredentials?.find((cert) => {
          const start = cert.startDateTime ? new Date(cert.startDateTime) : null;
          const end = cert.endDateTime ? new Date(cert.endDateTime) : null;
          const isActive =
            (!start || start <= now) && (!end || now <= end);
          return isActive && cert.key && cert.usage === "Verify";
        });

        if (!activeCert?.key) {
          log(LogLevel.Info, "SSO configured but certificate missing");
          const existingCert = vars.get(Var.MsSigningCertificate);
          const existingLoginUrl = vars.get(Var.MsSsoLoginUrl);
          const existingEntityId = vars.get(Var.MsSsoEntityId);
          if (existingCert && existingLoginUrl && existingEntityId) {
            markComplete({
              msSigningCertificate: existingCert,
              msSsoEntityId: existingEntityId,
              msSsoLoginUrl: existingLoginUrl,
            });
          } else {
            markIncomplete(
              "SSO configured but certificate missing. Re-run will regenerate and reconfigure Google.",
              {}
            );
          }
          return;
        }

        const tenantInfo = (await microsoft.organization.get()) as {
          value: { id: string }[];
        };
        const tenantId = tenantInfo.value[0]?.id;
        if (!tenantId) {
          markCheckFailed("Microsoft tenant id missing");
          return;
        }

        markComplete({
          msSigningCertificate: activeCert.key,
          msSsoEntityId: `https://sts.windows.net/${tenantId}/`,
          msSsoLoginUrl: `https://login.microsoftonline.com/${tenantId}/saml2`,
        });
      } catch (error) {
        log(LogLevel.Error, "Failed to check SSO configuration", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
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
        },
      });

      // 2. Get tenant ID for URLs
      const tenantInfo = (await microsoft.organization.get()) as {
        value: { id: string }[];
      };
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
        },
      });

      // 4. Get the application object ID (different from appId)
      const apps = (await microsoft.applications
        .list()
        .query({ $filter: `appId eq '${appId}'` })
        .get()) as { value: { id: string }[] };
      const applicationObjectId = apps.value[0]?.id;
      if (!applicationObjectId) {
        throw new Error("Unable to find application object");
      }

      log(LogLevel.Info, "Configuring application URLs");
      const appResponse = (await microsoft.applications
        .get(applicationObjectId)
        .get()) as {
        identifierUris?: string[];
        web?: { redirectUris?: string[] } | null;
      };
      const existingRedirectUris = appResponse.web?.redirectUris ?? [];
      const redirectUriSet = new Set([acsUrl, ...existingRedirectUris]);
      const existingIdentifierUris = appResponse.identifierUris ?? [];
      const identifierUriSet = new Set([entityId, ...existingIdentifierUris]);
      await microsoft.applications.update(applicationObjectId).patch({
        identifierUris: [...identifierUriSet],
        web: { redirectUris: [...redirectUriSet] },
      });
      completedOps.push({
        description: "Reset application URLs",
        rollback: async () => {
          try {
            await microsoft.applications.update(applicationObjectId).patch({
              identifierUris: existingIdentifierUris,
              web: { redirectUris: existingRedirectUris },
            });
          } catch {
            // Ignore defaultRedirectUri constraints during rollback.
          }
        },
      });

      // 6. Create signing certificate
      log(LogLevel.Info, "Creating SAML signing certificate");
      const certResponse = (await microsoft.servicePrincipals
        .addTokenSigningCertificate(spId)
        .post({
          displayName: "CN=Google Workspace SSO",
          endDateTime: new Date(Date.now() + TIME.YEAR).toISOString(),
        })) as { keyId: string; key?: string };
      completedOps.push({
        description: "Delete token signing certificate",
        rollback: async () => {
          await microsoft.servicePrincipals
            .tokenSigningCertificates(spId)
            .delete(certResponse.keyId)
            .delete();
        },
      });

      if (!certResponse.key) {
        throw new Error("Failed to generate signing certificate");
      }

      log(LogLevel.Info, "Microsoft SSO configuration completed");
      output({
        msSigningCertificate: certResponse.key,
        msSsoEntityId,
        msSsoLoginUrl: loginUrl,
      });
    } catch (error) {
      log(LogLevel.Error, "SSO configuration failed, attempting rollback", {
        error,
      });

      for (const op of completedOps.toReversed()) {
        try {
          await op.rollback();
          log(LogLevel.Info, `Rolled back: ${op.description}`);
        } catch (error) {
          log(LogLevel.Info, `Failed to rollback: ${op.description}`, {
            error,
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

      await microsoft.servicePrincipals
        .update(spId)
        .patch({ preferredSingleSignOnMode: null })
        .catch((error) => {
          log(LogLevel.Info, "Failed to reset SSO mode", { error });
        });

      await microsoft.servicePrincipals
        .tokenSigningCertificates(spId)
        .list()
        .get()
        .then(async (certs) => {
          const typed = certs as { value: { keyId: string }[] };
          for (const cert of typed.value) {
            await microsoft.servicePrincipals
              .tokenSigningCertificates(spId)
              .delete(cert.keyId)
              .delete();
          }
        })
        .catch((error) => {
          log(LogLevel.Info, "Failed to remove certificates", { error });
        });

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
        return;
      }
      log(LogLevel.Error, "Failed to undo SSO configuration", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
