import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

interface CheckData {
  adminRoleId?: string;
  directoryServiceId?: string;
  hasAssignment?: boolean;
}

export default createStep<CheckData>({
  id: StepId.CreateRoleAndAssignUser,
  requires: [
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.ProvisioningUserId
  ],
  provides: [Var.AdminRoleId, Var.DirectoryServiceId],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
   *
   * Completed step example response
   *
   * 200
   * {
   *   "items": [
   *     {
   *       "roleId": "123",
   *       "roleName": "Microsoft Entra Provisioning",
   *       "rolePrivileges": [ { "serviceId": "00haapch16h1ysv" } ]
   *     }
   *   ]
   * }
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
      const RolesSchema = z.object({
        items: z
          .array(
            z.object({
              roleId: z.string(),
              roleName: z.string(),
              rolePrivileges: z.array(z.object({ serviceId: z.string() }))
            })
          )
          .optional()
      });

      const { items = [] } = await fetchGoogle(
        ApiEndpoint.Google.Roles,
        RolesSchema
      );

      const role = items.find(
        (r) => r.roleName === "Microsoft Entra Provisioning"
      );
      if (role) {
        const userId = vars.provisioningUserId;
        if (!userId) {
          markCheckFailed("Provisioning user ID missing");
          return;
        }

        const AssignSchema = z.object({
          items: z.array(z.unknown()).optional()
        });
        const url = `${ApiEndpoint.Google.RoleAssignments}?roleId=${encodeURIComponent(role.roleId)}&userKey=${encodeURIComponent(userId)}`;
        const { items: assigns = [] } = await fetchGoogle(url, AssignSchema);

        if (assigns.length > 0) {
          log(LogLevel.Info, "Role already assigned");
          markComplete({
            adminRoleId: role.roleId,
            directoryServiceId: role.rolePrivileges[0]?.serviceId,
            hasAssignment: true
          });
        } else {
          markIncomplete("Role exists without assignment", {
            adminRoleId: role.roleId,
            directoryServiceId: role.rolePrivileges[0]?.serviceId,
            hasAssignment: false
          });
        }
      } else {
        markIncomplete("Custom admin role missing", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check custom role", { error });
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({
    vars,
    fetchGoogle,
    checkData,
    markSucceeded,
    markFailed,
    log
  }) {
    /**
     * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/ALL/privileges
     *
     * Completed step example response
     *
     * 200
     * {
     *   "items": [
     *     { "serviceId": "00haapch16h1ysv", "privilegeName": "USERS_RETRIEVE" }
     *   ]
     * }
     *
     * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
     * {
     *   "roleName": "Microsoft Entra Provisioning",
     *   "roleDescription": "Custom role for Microsoft provisioning",
     *   "rolePrivileges": [
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_RETRIEVE" },
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_CREATE" },
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_UPDATE" }
     *   ]
     * }
     *
     * Success response
     *
     * 201
     * { "roleId": "123" }
     *
     * Conflict response
     *
     * 409
     * { "error": { "message": "Entity already exists" } }
     */
    try {
      const PrivSchema = z.object({
        items: z.array(
          z.object({ serviceId: z.string(), privilegeName: z.string() })
        )
      });

      const { items } = await fetchGoogle(
        ApiEndpoint.Google.RolePrivileges,
        PrivSchema
      );
      const serviceId = items.find(
        (p) => p.privilegeName === "USERS_RETRIEVE"
      )?.serviceId;
      if (!serviceId) throw new Error("Service ID not found");

      const CreateSchema = z.object({ roleId: z.string() });

      let roleId = checkData.adminRoleId;
      try {
        if (!roleId) {
          const res = await fetchGoogle(
            ApiEndpoint.Google.Roles,
            CreateSchema,
            {
              method: "POST",
              body: JSON.stringify({
                roleName: "Microsoft Entra Provisioning",
                roleDescription: "Custom role for Microsoft provisioning",
                rolePrivileges: [
                  { serviceId, privilegeName: "ORGANIZATION_UNITS_READ" },
                  { serviceId, privilegeName: "USERS_RETRIEVE" },
                  { serviceId, privilegeName: "USERS_CREATE" },
                  { serviceId, privilegeName: "USERS_UPDATE" },
                  { serviceId, privilegeName: "GROUPS_RETRIEVE" },
                  { serviceId, privilegeName: "GROUPS_CREATE" },
                  { serviceId, privilegeName: "GROUPS_UPDATE" }
                ]
              })
            }
          );
          roleId = res.roleId;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("409")) {
          if (!roleId) {
            const RolesSchema = z.object({
              items: z.array(z.object({ roleId: z.string(), roleName: z.string() })).optional()
            });
            const { items: roles = [] } = await fetchGoogle(
              ApiEndpoint.Google.Roles,
              RolesSchema,
              { flatten: true }
            );
            roleId = roles.find(
              (r) => r.roleName === "Microsoft Entra Provisioning"
            )?.roleId;
          }
        } else {
          throw error;
        }
      }

      if (!roleId) throw new Error("Role ID unavailable after create");

      if (!checkData.hasAssignment) {
        const AssignSchema = z.object({ kind: z.string().optional() });
        const userId = getVar(vars, Var.ProvisioningUserId);
        try {
          await fetchGoogle(ApiEndpoint.Google.RoleAssignments, AssignSchema, {
            method: "POST",
            body: JSON.stringify({
              roleId,
              assignedTo: userId,
              scopeType: "CUSTOMER"
            })
          });
        } catch (error) {
          if (!(error instanceof Error && error.message.includes("409"))) {
            throw error;
          }
        }
      }

      markSucceeded({
        [Var.AdminRoleId]: roleId,
        [Var.DirectoryServiceId]: serviceId
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to create custom role", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  }
});
