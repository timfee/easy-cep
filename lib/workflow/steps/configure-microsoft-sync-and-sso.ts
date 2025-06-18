import { ApiEndpoint, SyncTemplateId } from "@/constants";
import { EmptyResponseSchema } from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CheckData {}

export default createStep<CheckData>({
  id: StepId.ConfigureMicrosoftSyncAndSso,
  requires: [
    Var.MsGraphToken,
    Var.ProvisioningServicePrincipalId,
    Var.GeneratedPassword
  ],
  provides: [],

  /**
   * GET https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs
   *
   * Completed step example response
   *
   * 200
   * { "value": [ { "status": { "code": "Active" } } ] }
   *
   * Incomplete step example response
   *
   * 200
   * { "value": [] }
   */

  async check({
    vars,
    fetchMicrosoft,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const spId = getVar(vars, Var.ProvisioningServicePrincipalId);

      const JobsSchema = z.object({
        value: z.array(z.object({ status: z.object({ code: z.string() }) }))
      });

      const { value } = await fetchMicrosoft(
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
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({ vars, fetchMicrosoft, markSucceeded, markFailed, log }) {
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
      const spId = getVar(vars, Var.ProvisioningServicePrincipalId);
      const password = getVar(vars, Var.GeneratedPassword);

      const baseAddress = ApiEndpoint.Google.Users.replace("/users", "");

      const CreateJobSchema = z.object({
        id: z.string(),
        templateId: z.string(),
        status: z.object({ code: z.string() }).optional()
      });

      const job = await fetchMicrosoft(
        ApiEndpoint.Microsoft.SyncJobs(spId),
        CreateJobSchema,
        {
          method: "POST",
          body: JSON.stringify({ templateId: SyncTemplateId.GoogleWorkspace })
        }
      );

      await fetchMicrosoft(
        ApiEndpoint.Microsoft.SyncSecrets(spId),
        EmptyResponseSchema,
        {
          method: "PUT",
          body: JSON.stringify({
            value: [
              { key: "BaseAddress", value: baseAddress },
              { key: "SecretToken", value: password }
            ]
          })
        }
      );

      await fetchMicrosoft(
        ApiEndpoint.Microsoft.StartSync(spId, job.id),
        EmptyResponseSchema,
        { method: "POST" }
      );

      markSucceeded({});
    } catch (error) {
      log(LogLevel.Error, "Failed to configure sync", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  },
  undo: async ({ vars, fetchMicrosoft, markReverted, markFailed, log }) => {
    try {
      const spId = vars[Var.ProvisioningServicePrincipalId] as string | undefined;
      if (!spId) {
        markFailed("Missing service principal id");
        return;
      }

      const JobsSchema = z.object({ value: z.array(z.object({ id: z.string() })) });
      const { value } = await fetchMicrosoft(
        ApiEndpoint.Microsoft.SyncJobs(spId),
        JobsSchema,
        { flatten: true }
      );

      for (const job of value) {
        await fetchMicrosoft(
          `${ApiEndpoint.Microsoft.SyncJobs(spId)}/${job.id}`,
          EmptyResponseSchema,
          { method: "DELETE" }
        );
      }

      markReverted();
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to remove sync job", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
