import { ApiEndpoint, SyncTemplateId } from "@/constants";
import { EmptyResponseSchema, isNotFoundError } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { defineStep } from "../step-builder";

export default defineStep(StepId.ConfigureMicrosoftSyncAndSso)
  .requires(
    Var.MsGraphToken,
    Var.ProvisioningServicePrincipalId,
    Var.GeneratedPassword
  )
  .provides()

  /**
   * GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
   *
   * Example success (200)
   * { "value": [ { "status": { "code": "Active" } } ] }
   *
   * Example none found (200)
   * { "value": [] }
   *
   * Example invalid token (401)
   * { "error": { "code": "InvalidAuthenticationToken" } }
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
        if (!spId) {
          markIncomplete("Missing provisioning service principal ID", {});
          return;
        }

        const JobsSchema = z.object({
          value: z.array(z.object({ status: z.object({ code: z.string() }) }))
        });

        const { value } = await microsoft.get(
          ApiEndpoint.Microsoft.SyncJobs(spId),
          JobsSchema,
          { flatten: true }
        );

        const active = value.some((v) => v.status.code !== "Paused");

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
  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    /**
     * POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
     * { "templateId": "google2provisioningV2" }
     *
     * PUT https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/secrets
     * { "value": [ { "key": "BaseAddress", "value": "https://admin.googleapis.com/admin/directory/v1" }, { "key": "SecretToken", "value": "{generatedPassword}" } ] }
     *
     * POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}/start
     */
    try {
      const spId = vars.require(Var.ProvisioningServicePrincipalId);
      const password = vars.require(Var.GeneratedPassword);

      const baseAddress = ApiEndpoint.Google.Users.replace("/users", "");

      const CreateJobSchema = z.object({
        id: z.string(),
        templateId: z.string(),
        status: z.object({ code: z.string() }).optional()
      });
      if (!spId) {
        markFailed("Missing provisioning service principal ID");
        return;
      }

      const job = await microsoft.post(
        ApiEndpoint.Microsoft.SyncJobs(spId),
        CreateJobSchema,
        { templateId: SyncTemplateId.GoogleWorkspace }
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

      output({});
    } catch (error) {
      log(LogLevel.Error, "Failed to configure sync", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
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
        { flatten: true }
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
