import { ApiEndpoint, OrgUnit } from "@/constants";
import {
  EmptyResponseSchema,
  isConflictError,
  isNotFoundError
} from "@/lib/workflow/utils";

import type { WorkflowVars } from "@/types";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

type CheckData = Partial<Pick<WorkflowVars, never>>;
export default createStep<CheckData>({
  id: StepId.CreateAutomationOU,
  requires: [
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.AutomationOuName,
    Var.AutomationOuPath
  ],
  provides: [],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation
   *
   * Example success (200)
   * {
   *   "orgUnitPath": "/Automation",
   *   "name": "Automation",
   *   "orgUnitId": "id:03ph8a2z1s3ovsg"
   * }
   *
   * Example not found (404)
   * {
   *   "error": {
   *     "code": 404,
   *     "message": "Org unit not found"
   *   }
   * }
   */

  async check({
    vars,
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const ouName = getVar(vars, Var.AutomationOuName);
      const OrgUnitSchema = z.object({ orgUnitPath: z.string() });
      await fetchGoogle(
        `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(ouName)}`,
        OrgUnitSchema
      );
      log(LogLevel.Info, "Automation OU already exists");
      markComplete({});
    } catch (error) {
      if (isNotFoundError(error)) {
        markIncomplete("Automation OU missing", {});
      } else {
        log(LogLevel.Error, "Failed to check OU", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Failed to check OU"
        );
      }
    }
  },

  async execute({ vars, fetchGoogle, markSucceeded, markFailed, log }) {
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
      const CreateSchema = z.object({
        orgUnitPath: z.string(),
        name: z.string(),
        parentOrgUnitId: z.string()
      });

      await fetchGoogle(ApiEndpoint.Google.OrgUnits, CreateSchema, {
        method: "POST",
        body: JSON.stringify({
          name: getVar(vars, Var.AutomationOuName),
          parentOrgUnitPath: "/"
        })
      });

      log(LogLevel.Info, "Automation OU created or already exists");
      markSucceeded({});
    } catch (error) {
      log(LogLevel.Error, "Failed to create Automation OU", { error });
      if (isConflictError(error)) {
        markSucceeded({});
      } else {
        markFailed(error instanceof Error ? error.message : "Create failed");
      }
    }
  },
  undo: async ({ vars, fetchGoogle, markReverted, markFailed, log }) => {
    try {
      const path = getVar(vars, Var.AutomationOuPath);
      await fetchGoogle(
        `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(path)}`,
        EmptyResponseSchema,
        { method: "DELETE" }
      );
      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete OU", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
