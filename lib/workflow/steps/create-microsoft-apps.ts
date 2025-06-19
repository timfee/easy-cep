import { ApiEndpoint, TemplateId } from "@/constants";
import { EmptyResponseSchema, isNotFoundError } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

interface CheckData {
  provisioningServicePrincipalId?: string;
  ssoServicePrincipalId?: string;
  ssoAppId?: string;
}

export default createStep<CheckData>({
  id: StepId.CreateMicrosoftApps,
  requires: [Var.MsGraphToken],
  provides: [
    Var.ProvisioningServicePrincipalId,
    Var.SsoServicePrincipalId,
    Var.SsoAppId
  ],

  /**
   * GET https://graph.microsoft.com/beta/applications?$filter=applicationTemplateId eq '{templateId}'
   *
   * Example success (200)
   * { "value": [ { "servicePrincipalId": "004f09c3-8e2b-4308-bfb5-38f2f2a83980", "appId": "7b33..." } ] }
   *
   * Example none found (200)
   * { "value": [] }
   *
   * Example invalid token (401)
   * { "error": { "code": "InvalidAuthenticationToken" } }
   */

  async check({
    fetchMicrosoft,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
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
        `applicationTemplateId eq '${TemplateId.GoogleWorkspaceSaml}'`
      );

      const { value: provApps } = await fetchMicrosoft(
        `${ApiEndpoint.Microsoft.Applications}?$filter=${provFilter}`,
        AppsSchema,
        { flatten: true }
      );

      const { value: ssoApps } = await fetchMicrosoft(
        `${ApiEndpoint.Microsoft.Applications}?$filter=${ssoFilter}`,
        AppsSchema,
        { flatten: true }
      );

      const provApp = provApps[0];
      const ssoApp = ssoApps[0] ?? provApp;
      const sameApp = provApp?.appId === ssoApp?.appId;

      if (provApp && ssoApp) {
        const SpSchema = z.object({
          value: z.array(z.object({ id: z.string() }))
        });

        const provFilter = encodeURIComponent(`appId eq '${provApp.appId}'`);
        const ssoFilter = encodeURIComponent(`appId eq '${ssoApp.appId}'`);

        const provRes = await fetchMicrosoft(
          `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${provFilter}`,
          SpSchema,
          { flatten: true }
        );

        const ssoRes = await fetchMicrosoft(
          `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${ssoFilter}`,
          SpSchema,
          { flatten: true }
        );

        const provId = provRes.value[0]?.id;
        const ssoId = ssoRes.value[0]?.id;

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
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({ fetchMicrosoft, markSucceeded, markFailed, log }) {
    /**
     * POST https://graph.microsoft.com/v1.0/applicationTemplates/{templateId}/instantiate
     * { "displayName": "Google Workspace Provisioning" }
     *
     * POST https://graph.microsoft.com/v1.0/applicationTemplates/{templateId}/instantiate
     * { "displayName": "Google Workspace SSO" }
     *
     * Success response
     *
     * 201
     * { "servicePrincipal": { "id": "..." }, "application": { "appId": "..." } }
     *
     * Error response
     *
     * 400
     * { "error": { "message": "Invalid template" } }
     */
    try {
      const CreateSchema = z.object({
        servicePrincipal: z.object({ id: z.string() }),
        application: z.object({ appId: z.string() })
      });

      const res1 = await fetchMicrosoft(
        ApiEndpoint.Microsoft.Templates(TemplateId.GoogleWorkspaceConnector),
        CreateSchema,
        {
          method: "POST",
          body: JSON.stringify({ displayName: "Google Workspace Provisioning" })
        }
      );

      const res2 = await fetchMicrosoft(
        ApiEndpoint.Microsoft.Templates(TemplateId.GoogleWorkspaceSaml),
        CreateSchema,
        {
          method: "POST",
          body: JSON.stringify({ displayName: "Google Workspace SSO" })
        }
      );

      markSucceeded({
        [Var.ProvisioningServicePrincipalId]: res1.servicePrincipal.id,
        [Var.SsoServicePrincipalId]: res2.servicePrincipal.id,
        [Var.SsoAppId]: res2.application.appId
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to create Microsoft apps", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  },
  undo: async ({ vars, fetchMicrosoft, markReverted, markFailed, log }) => {
    try {
      const provSpId = vars[Var.ProvisioningServicePrincipalId] as
        | string
        | undefined;
      const ssoSpId = vars[Var.SsoServicePrincipalId] as string | undefined;
      const appId = vars[Var.SsoAppId] as string | undefined;

      if (provSpId) {
        await fetchMicrosoft(
          `${ApiEndpoint.Microsoft.ServicePrincipals}/${provSpId}`,
          EmptyResponseSchema,
          { method: "DELETE" }
        );
      }

      if (ssoSpId && ssoSpId !== provSpId) {
        await fetchMicrosoft(
          `${ApiEndpoint.Microsoft.ServicePrincipals}/${ssoSpId}`,
          EmptyResponseSchema,
          { method: "DELETE" }
        );
      }

      if (appId) {
        await fetchMicrosoft(
          `${ApiEndpoint.Microsoft.Applications}/${appId}`,
          EmptyResponseSchema,
          { method: "DELETE" }
        );
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete Microsoft apps", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
