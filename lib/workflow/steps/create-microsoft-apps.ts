import { ApiEndpoint, TemplateId } from "@/constants";
import { EmptyResponseSchema, isNotFoundError } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
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
        const AppsSchema = z.object({
          value: z.array(
            z.object({
              id: z.string(),
              appId: z.string(),
              displayName: z.string()
            })
          )
        });

        const provFilter = encodeURIComponent(
          `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`
        );
        const ssoFilter = encodeURIComponent(
          `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`
        );

        const { value: provApps } = await microsoft.get(
          `${ApiEndpoint.Microsoft.Applications}?$filter=${provFilter}`,
          AppsSchema,
          { flatten: "value" }
        );
        // Extract: provisioning app info from provApps[0]

        const { value: ssoApps } = await microsoft.get(
          `${ApiEndpoint.Microsoft.Applications}?$filter=${ssoFilter}`,
          AppsSchema,
          { flatten: "value" }
        );
        // Extract: ssoAppId = ssoApps[0]?.appId

        const SpSchema = z.object({
          value: z.array(z.object({ id: z.string() }))
        });

        async function findAppWithSp(
          apps: Array<{ id: string; appId: string }>
        ) {
          for (const app of apps) {
            const filter = encodeURIComponent(`appId eq '${app.appId}'`);
            const { value } = await microsoft.get(
              `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${filter}`,
              SpSchema,
              { flatten: "value" }
            );
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
            markIncomplete("Microsoft service principals not found", {});
          }
        } else {
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
    /**
     * POST https://graph.microsoft.com/v1.0/applicationTemplates/{templateId}/instantiate
     * Headers: { Authorization: Bearer {msGraphToken} }
     * Body: { "displayName": "Google Workspace Provisioning" }
     *
     * POST https://graph.microsoft.com/v1.0/applicationTemplates/{templateId}/instantiate
     * Headers: { Authorization: Bearer {msGraphToken} }
     * Body: { "displayName": "Google Workspace SSO" }
     *
     * Success response (201)
     * {
     *   "servicePrincipal": { "id": "..." },
     *   "application": { "appId": "..." }
     * }
     *
     * Error response (400)
     * { "error": { "code": 400, "message": "Invalid template" } }
     */
    try {
      const CreateSchema = z.object({
        servicePrincipal: z.object({ id: z.string() }),
        application: z.object({ appId: z.string() })
      });

      const res1 = await microsoft.post(
        ApiEndpoint.Microsoft.Templates(TemplateId.GoogleWorkspaceConnector),
        CreateSchema,
        { displayName: vars.require(Var.ProvisioningAppDisplayName) }
      );
      // Extract: provisioningServicePrincipalId = res1.servicePrincipal.id

      const res2 = await microsoft.post(
        ApiEndpoint.Microsoft.Templates(TemplateId.GoogleWorkspaceConnector),
        CreateSchema,
        { displayName: vars.require(Var.SsoAppDisplayName) }
      );
      // Extract: ssoServicePrincipalId = res2.servicePrincipal.id; ssoAppId = res2.application.appId

      output({
        provisioningServicePrincipalId: res1.servicePrincipal.id,
        ssoServicePrincipalId: res2.servicePrincipal.id,
        ssoAppId: res2.application.appId
      });
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
        await microsoft.delete(
          `${ApiEndpoint.Microsoft.ServicePrincipals}/${provSpId}`,
          EmptyResponseSchema
        );
      }

      if (ssoSpId && ssoSpId !== provSpId) {
        await microsoft.delete(
          `${ApiEndpoint.Microsoft.ServicePrincipals}/${ssoSpId}`,
          EmptyResponseSchema
        );
      }

      if (appId) {
        await microsoft.delete(
          `${ApiEndpoint.Microsoft.Applications}/${appId}`,
          EmptyResponseSchema
        );
      }

      markReverted();
    } catch (error) {
      // isNotFoundError handles: 404
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete Microsoft apps", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
