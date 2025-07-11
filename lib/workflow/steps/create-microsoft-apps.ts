import { TemplateId } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/core/errors";
import { LogLevel, StepId, Var } from "@/types";
import { defineStep } from "../step-builder";

export default defineStep(StepId.CreateMicrosoftApps)
  .requires(
    Var.MsGraphToken,
    Var.ProvisioningAppDisplayName,
    Var.SsoAppDisplayName
  )
  .provides(
    Var.ProvisioningServicePrincipalId,
    Var.SsoServicePrincipalId,
    Var.SsoAppId
  )

  /**
   * GET https://graph.microsoft.com/beta/applications?$filter=applicationTemplateId eq '{templateId}'
   * Headers: { Authorization: Bearer {msGraphToken} }
   *
   * Success response (200)
   * { "value": [ { "servicePrincipalId": "004f...", "appId": "7b33" } ] }
   *
   * Success response (200) – empty
   * { "value": [] }
   *
   * Error response (401)
   * { "error": { "code": "InvalidAuthenticationToken" } }
   */

  .check(
    async ({
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log
    }) => {
      try {
        const provFilter = `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`;
        const ssoFilter = `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`;

        const { value: provApps } = await microsoft.applications
          .list()
          .query({ $filter: provFilter })
          .get();
        // Extract: provisioning app info from provApps[0]

        const { value: ssoApps } = await microsoft.applications
          .list()
          .query({ $filter: ssoFilter })
          .get();
        // Extract: ssoAppId = ssoApps[0]?.appId

        async function findAppWithSp(
          apps: Array<{ id: string; appId: string }>
        ) {
          for (const app of apps) {
            const filter = `appId eq '${app.appId}'`;
            const { value } = await microsoft.servicePrincipals
              .list()
              .query({ $filter: filter })
              .get();
            const spId = value[0]?.id;
            if (spId) return { app, spId };
          }
          return undefined;
        }

        const provPair = await findAppWithSp(provApps);
        const ssoPair = await findAppWithSp(ssoApps);

        const provApp = provPair?.app;
        const provId = provPair?.spId;
        const ssoApp = ssoPair?.app ?? provApp;
        const ssoId = ssoPair?.spId;

        const sameApp = provApp?.appId === ssoApp?.appId;

        if (provApp && ssoApp) {
          if (provId && ssoId) {
            log(
              LogLevel.Info,
              sameApp ?
                "Provisioning and SSO use the same app"
              : "Provisioning and SSO use separate apps"
            );
            log(LogLevel.Info, "Microsoft apps already exist");
            markComplete({
              provisioningServicePrincipalId: provId,
              ssoServicePrincipalId: ssoId,
              ssoAppId: ssoApp.appId
            });
          } else {
            log(LogLevel.Info, "Microsoft service principals not found");
            markIncomplete("Microsoft service principals not found", {});
          }
        } else {
          log(LogLevel.Info, "Microsoft apps not found");
          markIncomplete("Microsoft apps not found", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check Microsoft apps", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )

  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    let provisioningSpId: string | undefined;
    let provisioningAppId: string | undefined;
    let ssoSpId: string | undefined;
    let ssoAppId: string | undefined;

    try {
      // Create provisioning app
      log(LogLevel.Info, "Creating provisioning app");
      const res1 = await microsoft.applications
        .instantiate(TemplateId.GoogleWorkspaceConnector)
        .post({ displayName: vars.require(Var.ProvisioningAppDisplayName) });
      provisioningSpId = res1.servicePrincipal.id;
      provisioningAppId = res1.application.id;

      // Create SSO app
      try {
        log(LogLevel.Info, "Creating SSO app");
        const res2 = await microsoft.applications
          .instantiate(TemplateId.GoogleWorkspaceConnector)
          .post({ displayName: vars.require(Var.SsoAppDisplayName) });
        ssoSpId = res2.servicePrincipal.id;
        ssoAppId = res2.application.appId;

        // Both succeeded, output the results
        output({
          provisioningServicePrincipalId: provisioningSpId,
          ssoServicePrincipalId: ssoSpId,
          ssoAppId: ssoAppId
        });
      } catch (ssoError) {
        log(LogLevel.Error, "SSO app creation failed, attempting cleanup", {
          ssoError
        });

        const cleanupErrors: string[] = [];

        try {
          if (provisioningSpId) {
            await microsoft.servicePrincipals.delete(provisioningSpId).delete();
          }
        } catch (err) {
          cleanupErrors.push(`Failed to delete service principal: ${err}`);
        }

        try {
          if (provisioningAppId) {
            await microsoft.applications.delete(provisioningAppId).delete();
          }
        } catch (err) {
          cleanupErrors.push(`Failed to delete application: ${err}`);
        }

        if (cleanupErrors.length > 0) {
          throw new Error(
            `SSO creation failed and cleanup was incomplete. Manual cleanup required for: ${cleanupErrors.join(
              "; "
            )}. Original error: ${ssoError}`
          );
        }

        throw ssoError;
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to create Microsoft apps", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const provSpId = vars.get(Var.ProvisioningServicePrincipalId);
      const ssoSpId = vars.get(Var.SsoServicePrincipalId);
      const appId = vars.get(Var.SsoAppId);

      if (provSpId) {
        try {
          await microsoft.servicePrincipals.delete(provSpId).delete();
        } catch (error) {
          if (isNotFoundError(error)) {
            log(
              LogLevel.Info,
              "Service Principal already deleted or not found"
            );
          } else {
            throw error;
          }
        }
      }

      if (ssoSpId && ssoSpId !== provSpId) {
        try {
          await microsoft.servicePrincipals.delete(ssoSpId).delete();
        } catch (error) {
          if (isNotFoundError(error)) {
            log(
              LogLevel.Info,
              "Service Principal already deleted or not found"
            );
          } else {
            throw error;
          }
        }
      }

      if (appId) {
        try {
          await microsoft.applications.delete(appId).delete();
        } catch (error) {
          if (isNotFoundError(error)) {
            log(LogLevel.Info, "Application already deleted or not found");
          } else {
            throw error;
          }
        }
      }

      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete Microsoft apps", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
