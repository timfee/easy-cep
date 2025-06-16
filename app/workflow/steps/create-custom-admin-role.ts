import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep } from "../create-step";

interface CheckData {
  adminRoleId?: string;
  directoryServiceId?: string;
}

export default createStep<CheckData>({
  id: StepId.CreateCustomAdminRole,
  requires: [Var.GoogleAccessToken, Var.CustomerId],
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
        log(LogLevel.Info, "Custom admin role exists");
        markComplete({
          adminRoleId: role.roleId,
          directoryServiceId: role.rolePrivileges[0]?.serviceId
        });
      } else {
        markIncomplete("Custom admin role missing", {});
      }
    } catch (error) {
      log(LogLevel.Error, "Failed to check custom role", { error });
      markCheckFailed(error instanceof Error ? error.message : "Check failed");
    }
  },

  async execute({ fetchGoogle, checkData, markSucceeded, markFailed, log }) {
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
        const res = await fetchGoogle(ApiEndpoint.Google.Roles, CreateSchema, {
          method: "POST",
          body: JSON.stringify({
            roleName: "Microsoft Entra Provisioning",
            roleDescription: "Custom role for Microsoft provisioning",
            rolePrivileges: [
              { serviceId, privilegeName: "USERS_RETRIEVE" },
              { serviceId, privilegeName: "USERS_CREATE" },
              { serviceId, privilegeName: "USERS_UPDATE" }
            ]
          })
        });
        roleId = res.roleId;
      } catch (error) {
        if (error instanceof Error && error.message.includes("409")) {
          if (!roleId) {
            const RolesSchema = z.object({
              items: z.array(
                z.object({ roleId: z.string(), roleName: z.string() })
              )
            });
            const { items: roles } = await fetchGoogle(
              ApiEndpoint.Google.Roles,
              RolesSchema
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
