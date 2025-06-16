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

/* eslint-disable tsdoc/syntax */
/**
Sample check output:
{ "kind": "admin#directory#orgUnit", "etag": "\"gxO1bXSFNeWqC3FiQQ6XLAXOpbF19C45texsy8ljSPo/9sjtqUintVa0VWRSFDje_b_Y_tI\"", "name": "Automation", "description": "Automation users", "orgUnitPath": "/Automation", "orgUnitId": "id:03ph8a2z1s3ovsg", "parentOrgUnitPath": "/", "parentOrgUnitId": "id:03ph8a2z23yjui6" }

Sample create attempt output (existing OU):
{ "error": { "code": 400, "message": "Invalid Ou Id", "errors": [ { "message": "Invalid Ou Id", "domain": "global", "reason": "invalid" } ] } }
*/
/* eslint-enable tsdoc/syntax */
