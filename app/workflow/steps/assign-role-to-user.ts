/**
 * @file assign-role-to-user.ts
 * @description Google Workspace – ensure the custom admin role is assigned to
 *              the automation service account.  If no assignment exists the
 *              step creates one via the Directory API.
 */

import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CheckData {}

export default createStep<CheckData>({
  id: StepId.AssignRoleToUser,
  requires: [
    Var.GoogleAccessToken,
    Var.AdminRoleId,
    Var.ProvisioningUserId,
    Var.IsDomainVerified
  ],
  provides: [],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments?roleId={adminRoleId}&userKey={provisioningUserId}
   *
   * Completed step example response
   *
   * 200
   * { "items": [ { "roleAssignmentId": "914..." } ] }
   *
   * Incomplete step example response
   *
   * 200
   * { "items": [] }
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
      const roleId = getVar(vars, Var.AdminRoleId);
      const userId = getVar(vars, Var.ProvisioningUserId);
      if (!roleId || !userId) {
        markCheckFailed("Role or user ID missing");
        return;
      }

      const AssignmentsSchema = z.object({
        items: z.array(z.unknown()).optional()
      });
      const url = `${ApiEndpoint.Google.RoleAssignments}?roleId=${encodeURIComponent(
        roleId
      )}&userKey=${encodeURIComponent(userId)}`;
      const { items = [] } = await fetchGoogle(url, AssignmentsSchema);

      if (items.length > 0) {
        log(LogLevel.Info, "Role already assigned");
        markComplete({});
      } else {
        markIncomplete("Role not assigned", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check role assignment", { error });
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({ vars, fetchGoogle, markSucceeded, markFailed, log }) {
    /**
     * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments
     * {
     *   "roleId": "{adminRoleId}",
     *   "assignedTo": "{provisioningUserId}",
     *   "scopeType": "CUSTOMER"
     * }
     *
     * Success response
     *
     * 200
     * {}
     *
     * Error response (already assigned)
     *
     * 409
     * { "error": { "message": "Entity already exists" } }
     */
    try {
      const roleId = getVar(vars, Var.AdminRoleId);
      const userId = getVar(vars, Var.ProvisioningUserId);
      if (!roleId || !userId) {
        markFailed("Role or user ID missing");
        return;
      }

      const CreateSchema = z
        .object({ kind: z.string().optional() })
        .passthrough();

      await fetchGoogle(ApiEndpoint.Google.RoleAssignments, CreateSchema, {
        method: "POST",
        body: JSON.stringify({
          roleId,
          assignedTo: userId,
          scopeType: "CUSTOMER"
        })
      });

      log(LogLevel.Info, "Role assigned to user or already exists");
      markSucceeded({});
    } catch (error) {
      if (error instanceof Error && error.message.includes("409")) {
        markSucceeded({});
      } else {
        log(LogLevel.Error, "Failed to assign role", { error });
        markFailed(error instanceof Error ? error.message : "Execute failed");
      }
    }
  }
});
