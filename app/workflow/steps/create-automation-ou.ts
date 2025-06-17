import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CheckData {}
export default createStep<CheckData>({
  id: StepId.CreateAutomationOU,
  requires: [Var.GoogleAccessToken, Var.IsDomainVerified],
  provides: [],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation
   * Authorization: Bearer {googleAccessToken}
   *
   * Success response (`200 OK`):
   * {
   *   "orgUnitPath": "/Automation",
   *   "name": "Automation",
   *   …
   * }
   *
   * Not found response (`404 Not Found`):
   * {
   *   "error": {
   *     "code": 404,
   *     "message": "Org unit not found",
   *     "errors": [...]
   *   }
   * }
   */

  async check({
    vars: _vars,
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const ouName = "Automation";
      const OrgUnitSchema = z.object({ orgUnitPath: z.string() }).passthrough();
      await fetchGoogle(
        `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(ouName)}`,
        OrgUnitSchema
      );
      log(LogLevel.Info, "Automation OU already exists");
      markComplete({});
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("HTTP 404")) {
        markIncomplete("Automation OU missing", {});
      } else {
        log(LogLevel.Error, "Failed to check OU", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Failed to check OU"
        );
      }
    }
  },

  async execute({ vars: _vars, fetchGoogle, markSucceeded, markFailed, log }) {
    /**
     * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits
     * {
     *   "name": "Automation",
     *   "parentOrgUnitPath": "/"
     * }
     *
     * Success response
     *
     * 201
     * { "orgUnitPath": "/Automation" }
     *
     * Conflict response
     *
     * 409
     * { "error": { "message": "Invalid Ou Id" } }
     */
    try {
      const CreateSchema = z
        .object({
          orgUnitPath: z.string(),
          name: z.string(),
          parentOrgUnitId: z.string()
        })
        .passthrough();

      await fetchGoogle(ApiEndpoint.Google.OrgUnits, CreateSchema, {
        method: "POST",
        body: JSON.stringify({ name: "Automation", parentOrgUnitPath: "/" })
      });

      log(LogLevel.Info, "Automation OU created or already exists");
      markSucceeded({});
    } catch (error) {
      log(LogLevel.Error, "Failed to create Automation OU", { error });
      if (error instanceof Error && error.message.includes("409")) {
        markSucceeded({});
      } else {
        markFailed(error instanceof Error ? error.message : "Create failed");
      }
    }
  }
});
