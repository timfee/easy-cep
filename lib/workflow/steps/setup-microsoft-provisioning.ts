import { ApiEndpoint, SyncTemplateTag } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/core/errors";
import { LogLevel, StepId, Var } from "@/types";
import { defineStep } from "../step-builder";

interface SyncJob {
  id?: string;
  templateId?: string;
  status?: { code?: string };
}

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

        const { value = [] } = await microsoft.synchronization
          .jobs(spId)
          .list()
          .get();

        const active = value.some(
          (job: SyncJob) => job.status?.code !== "Paused"
        );

        if (active) {
          log(LogLevel.Info, "Synchronization already active");
          markComplete({});
        } else {
          log(LogLevel.Info, "Synchronization not started");
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

      const { value: templates } = await microsoft.synchronization
        .templates(spId)
        .get();

      const templateId =
        templates.find(
          (template) => template.factoryTag === SyncTemplateTag.GoogleWorkspace
        )?.id ?? SyncTemplateTag.GoogleWorkspace;

      const job = await microsoft.synchronization
        .jobs(spId)
        .create()
        .post({ templateId });

      await microsoft.synchronization.secrets(spId).put({
        value: [
          { key: "BaseAddress", value: baseAddress },
          { key: "SecretToken", value: password }
        ]
      });

      const jobId = job.id ?? job.value?.[0]?.id;
      if (jobId) {
        await microsoft.synchronization.jobs(spId).start(jobId).post();
      }

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

      const { value = [] } = await microsoft.synchronization
        .jobs(spId)
        .list()
        .get();

      for (const job of value) {
        await microsoft.synchronization.jobs(spId).delete(job.id).delete();
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
