import { ApiEndpoint, TemplateId } from "@/constants";
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
   * Completed step example response
   *
   * 200
   * { "value": [ { "servicePrincipalId": "004f09c3-8e2b-4308-bfb5-38f2f2a83980", "appId": "7b33..." } ] }
   *
   * Incomplete step example response
   *
   * 200
   * { "value": [] }
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
        value: z
          .array(
            z.object({ servicePrincipalId: z.string(), appId: z.string() })
          )
          .optional()
      });

      const filter = encodeURIComponent(
        `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`
      );
      const { value = [] } = await fetchMicrosoft(
        `${ApiEndpoint.Microsoft.Applications}?$filter=${filter}`,
        AppsSchema
      );

      if (value.length > 0) {
        const first = value[0];
        log(LogLevel.Info, "Microsoft apps already exist");
        markComplete({
          provisioningServicePrincipalId: first.servicePrincipalId,
          ssoServicePrincipalId: first.servicePrincipalId,
          ssoAppId: first.appId
        });
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
     * Success response
     *
     * 201
     * { "servicePrincipal": { "id": "..." }, "application": { "appId": "..." } }
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
        ApiEndpoint.Microsoft.Templates(TemplateId.GoogleWorkspaceConnector),
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
  }
});
