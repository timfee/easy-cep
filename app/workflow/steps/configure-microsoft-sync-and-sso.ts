import { ApiEndpoint } from "@/constants";
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
        JobsSchema
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
     * PATCH https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization
     * {
     *   "secrets": [
     *     { "key": "BaseAddress", "value": "https://admin.googleapis.com/admin/directory/v1" },
     *     { "key": "SecretKey", "value": "{generatedPassword}" }
     *   ]
     * }
     *
     * Success response
     *
     * 204
     *
     * POST https://graph.microsoft.com/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/Initial/start
     *
     * Success response
     * 204
     */
    try {
      const spId = getVar(vars, Var.ProvisioningServicePrincipalId);
      const password = getVar(vars, Var.GeneratedPassword);

      const PatchSchema = z.object({});

      const baseAddress = ApiEndpoint.Google.Users.replace("/users", "");
      await fetchMicrosoft(
        ApiEndpoint.Microsoft.Synchronization(spId),
        PatchSchema,
        {
          method: "PATCH",
          body: JSON.stringify({
            secrets: [
              { key: "BaseAddress", value: baseAddress },
              { key: "SecretKey", value: password }
            ]
          })
        }
      );

      await fetchMicrosoft(ApiEndpoint.Microsoft.StartSync(spId), PatchSchema, {
        method: "POST"
      });

      markSucceeded({});
    } catch (error) {
      log(LogLevel.Error, "Failed to configure sync", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  }
});
