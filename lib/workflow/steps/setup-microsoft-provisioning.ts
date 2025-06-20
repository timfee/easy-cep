import { ApiEndpoint, SyncTemplateTag } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/errors";
import { EmptyResponseSchema } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

// Empty object type - this step doesn't extract data during check phase
type CheckData = Record<string, never>;

export default defineStep(StepId.SetupMicrosoftProvisioning)
  .requires(
    Var.MsGraphToken,
    Var.ProvisioningServicePrincipalId,
    Var.GeneratedPassword
  )
  .provides()
  /**
   * GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
   * Headers: { Authorization: Bearer {msGraphToken} }
   *
   * Success response (200)
   * { "value": [ { "status": { "code": "Active" } } ] }
   *
   * Success response (200) - empty
   * { "value": [] }
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
        const spId = vars.require(Var.ProvisioningServicePrincipalId);

        const JobsSchema = z.object({
          value: z.array(z.object({ status: z.object({ code: z.string() }) }))
        });

        const { value } = await microsoft.get(
          ApiEndpoint.Microsoft.SyncJobs(spId),
          JobsSchema,
          { flatten: "value" }
        );

        const active = value.some((job) => job.status.code !== "Paused");

        if (active) {
          log(LogLevel.Info, "Synchronization already active");
          markComplete({});
        } else {
          markIncomplete("Synchronization not started", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check sync jobs", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  /**
   * GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/templates
   * Headers: { Authorization: Bearer {msGraphToken} }
   *
   * Success response (200)
   * { "value": [ { "id": "templateId", "factoryTag": "gsuite" } ] }
   *
   * POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
   * Headers: { Authorization: Bearer {msGraphToken} }
   * Body: { "templateId": "{templateId}" }
   *
   * PUT https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/secrets
   * Headers: { Authorization: Bearer {msGraphToken} }
   * Body:
   * {
   *   "value": [
   *     { "key": "BaseAddress", "value": "https://admin.googleapis.com/admin/directory/v1" },
   *     { "key": "SecretToken", "value": "{generatedPassword}" }
   *   ]
   * }
   *
   * POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}/start
   * Headers: { Authorization: Bearer {msGraphToken} }
   * Success response (204) {}
   */
  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    try {
      const spId = vars.require(Var.ProvisioningServicePrincipalId);
      const password = vars.require(Var.GeneratedPassword);
      const baseAddress = ApiEndpoint.Google.Users.replace("/users", "");

      const TemplatesSchema = z.object({
        value: z.array(z.object({ id: z.string(), factoryTag: z.string() }))
      });

      const { value: templates } = await microsoft.get(
        ApiEndpoint.Microsoft.SyncTemplates(spId),
        TemplatesSchema,
        { flatten: "value" }
      );

      const templateId =
        templates.find(
          (template) => template.factoryTag === SyncTemplateTag.GoogleWorkspace
        )?.id ?? SyncTemplateTag.GoogleWorkspace;

      const CreateJobSchema = z.object({
        id: z.string(),
        templateId: z.string(),
        status: z.object({ code: z.string() }).optional()
      });

      const job = await microsoft.post(
        ApiEndpoint.Microsoft.SyncJobs(spId),
        CreateJobSchema,
        { templateId }
      );

      await microsoft.put(
        ApiEndpoint.Microsoft.SyncSecrets(spId),
        EmptyResponseSchema,
        {
          value: [
            { key: "BaseAddress", value: baseAddress },
            { key: "SecretToken", value: password }
          ]
        }
      );

      await microsoft.post(
        ApiEndpoint.Microsoft.StartSync(spId, job.id),
        EmptyResponseSchema
      );

      log(LogLevel.Info, "Microsoft provisioning setup completed");
      output({});
    } catch (error) {
      log(LogLevel.Error, "Failed to setup Microsoft provisioning", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  /**
   * GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
   * DELETE https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}
   */
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const spId = vars.get(Var.ProvisioningServicePrincipalId);
      if (!spId) {
        markFailed("Missing service principal id");
        return;
      }

      const JobsSchema = z.object({
        value: z.array(z.object({ id: z.string() }))
      });
      const { value } = await microsoft.get(
        ApiEndpoint.Microsoft.SyncJobs(spId),
        JobsSchema,
        { flatten: "value" }
      );

      for (const job of value) {
        await microsoft.delete(
          `${ApiEndpoint.Microsoft.SyncJobs(spId)}/${job.id}`,
          EmptyResponseSchema
        );
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to remove sync job", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
