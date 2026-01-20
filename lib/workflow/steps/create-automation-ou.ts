import { isConflictError, isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";

import { defineStep } from "../step-builder";

export default defineStep(StepId.CreateAutomationOU)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.AutomationOuName,
    Var.AutomationOuPath
  )
  .provides()

  .check(
    async ({
      vars,
      google,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log,
    }) => {
      try {
        const ouName = vars.require(Var.AutomationOuName);
        const ouPath = vars.require(Var.AutomationOuPath);

        const ou = (await google.orgUnits.get(ouPath).get()) as {
          orgUnitPath: string;
          name: string;
        };

        if (ou.orgUnitPath === ouPath && ou.name === ouName) {
          log(LogLevel.Info, "Automation OU already exists");
          markComplete({});
        } else {
          log(LogLevel.Info, "Automation OU missing");
          markIncomplete("Automation OU missing", {});
        }
      } catch (error) {
        if (isNotFoundError(error)) {
          log(LogLevel.Debug, "Automation OU missing");
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
    try {
      await google.orgUnits.create().post({
        name: vars.require(Var.AutomationOuName),
        parentOrgUnitPath: "/",
      });

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

      try {
        await google.orgUnits.delete(path).delete();
      } catch (error) {
        if (isNotFoundError(error)) {
          log(
            LogLevel.Info,
            "Organizational Unit already deleted or not found"
          );
        } else {
          throw error;
        }
      }
      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete OU", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
