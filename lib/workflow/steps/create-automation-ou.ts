import { isConflictError, isNotFoundError } from "@/lib/workflow/errors";
import { safeDelete } from "@/lib/workflow/utils";

import { LogLevel, StepId, Var } from "@/types";
import { defineStep } from "../step-builder";

export default defineStep(StepId.CreateAutomationOU)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.AutomationOuName,
    Var.AutomationOuPath
  )
  .provides()

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * {
   *   "orgUnitPath": "/Automation",
   *   "name": "Automation",
   *   "orgUnitId": "id:03ph8a2z1s3ovsg"
   * }
   *
   * Error response (404)
   * {
   *   "error": { "code": 404, "message": "Org unit not found" }
   * }
   */

  .check(
    async ({
      vars,
      google,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log
    }) => {
      try {
        const ouName = vars.require(Var.AutomationOuName);
        const ouPath = vars.require(Var.AutomationOuPath);

        const ou = await google.orgUnits.get(ouPath).get();

        if (ou.orgUnitPath === ouPath && ou.name === ouName) {
          log(LogLevel.Info, "Automation OU already exists");
          markComplete({});
        } else {
          log(LogLevel.Info, "Automation OU missing");
          markIncomplete("Automation OU missing", {});
        }
      } catch (error) {
        if (isNotFoundError(error)) {
          log(LogLevel.Info, "Automation OU missing");
          markIncomplete("Automation OU missing", {});
        } else {
          log(LogLevel.Error, "Failed to check OU", { error });
          markCheckFailed(
            error instanceof Error ? error.message : "Failed to check OU"
          );
        }
      }
    }
  )

  .execute(async ({ vars, google, output, markFailed, log }) => {
    /**
     * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits
     * Headers: { Authorization: Bearer {googleAccessToken} }
     * Body:
     * {
     *   "name": "Automation",
     *   "parentOrgUnitPath": "/"
     * }
     *
     * Success response (201)
     * { "orgUnitPath": "/Automation" }
     *
     * Error response (409)
     * { "error": { "code": 409, "message": "Invalid Ou Id" } }
     */
    try {
      await google.orgUnits
        .create()
        .post({
          name: vars.require(Var.AutomationOuName),
          parentOrgUnitPath: "/"
        });
      // isConflictError handles: 409

      log(LogLevel.Info, "Automation OU created or already exists");
      output({});
    } catch (error) {
      log(LogLevel.Error, "Failed to create Automation OU", { error });
      if (isConflictError(error)) {
        output({});
      } else {
        markFailed(error instanceof Error ? error.message : "Create failed");
      }
    }
  })
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const path = vars.require(Var.AutomationOuPath);
      if (!path) {
        markFailed("Missing Automation OU name");
        return;
      }

      await safeDelete(
        () => google.orgUnits.delete(path).delete(),
        log,
        "Organizational Unit"
      );
      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete OU", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
