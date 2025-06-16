import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

/* eslint-disable @typescript-eslint/no-empty-object-type */
interface CheckData {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export default createStep<CheckData>({
  id: StepId.CreateAutomationOU,
  requires: [Var.GoogleAccessToken, Var.CustomerId],
  provides: [],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits?orgUnitPath=/Automation
   *
   * Completed step example response
   *
   * 200
   * {
   *   "organizationUnits": [
   *     { "orgUnitPath": "/Automation" }
   *   ]
   * }
   *
   * Incomplete step example response
   *
   * 200
   * { "kind": "admin#directory#orgUnits" }
   */

  async check({
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const OrgUnitsSchema = z.object({
        organizationUnits: z
          .array(z.object({ orgUnitPath: z.string() }))
          .optional()
      });

      const { organizationUnits = [] } = await fetchGoogle(
        `${ApiEndpoint.Google.OrgUnits}?orgUnitPath=/Automation`,
        OrgUnitsSchema
      );

      const exists = organizationUnits.some(
        (ou) => ou.orgUnitPath === "/Automation"
      );

      if (exists) {
        log(LogLevel.Info, "Automation OU already exists");
        markComplete({});
      } else {
        markIncomplete("Automation OU missing", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check OU", { error });
      markCheckFailed(
        error instanceof Error ? error.message : "Failed to check OU"
      );
    }
  },

  async execute({ fetchGoogle, markSucceeded, markFailed, log }) {
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
      const CreateSchema = z.object({ orgUnitPath: z.string() }).passthrough();

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
