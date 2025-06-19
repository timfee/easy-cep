import { ApiEndpoint } from "@/constants";
import {
  EmptyResponseSchema,
  findInTree,
  isConflictError,
  isNotFoundError
} from "@/lib/workflow/utils";
import { LogLevel, StepId, Var } from "@/types";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

interface CheckData {
  adminRoleId?: string;
  directoryServiceId?: string;
}

interface AdminPrivilege {
  serviceId: string;
  privilegeName: string;
  childPrivileges?: AdminPrivilege[];
}

const REQUIRED_PRIVS = [
  "ORGANIZATION_UNITS_RETRIEVE",
  "USERS_RETRIEVE",
  "USERS_CREATE",
  "USERS_UPDATE",
  "GROUPS_ALL"
];

export default createStep<CheckData>({
  id: StepId.CreateAdminRoleAndAssignUser,
  requires: [
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.ProvisioningUserId,
    Var.AdminRoleName
  ],
  provides: [Var.AdminRoleId, Var.DirectoryServiceId],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
   *
   * Example success (200)
   * {
   *   "kind": "admin#directory#roles",
   *   "items": [
   *     {
   *       "roleId": "91447453409034818",
   *       "roleName": "_GROUPS_ADMIN_ROLE",
   *       "roleDescription": "Grou..."
   *     }
   *   ]
   * }
   *
   * Example incomplete (200)
   * {
   *   "kind": "admin#directory#roles",
   *   "items": [],
   *   "nextPageToken": "..."
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
      const RolesSchema = z.object({
        items: z
          .array(
            z.object({
              roleId: z.string(),
              roleName: z.string(),
              rolePrivileges: z.array(
                z.object({ serviceId: z.string(), privilegeName: z.string() })
              )
            })
          )
          .optional(),
        nextPageToken: z.string().optional()
      });

      const { items = [] } = await fetchGoogle(
        ApiEndpoint.Google.Roles,
        RolesSchema,
        { flatten: true }
      );
      const roleName = getVar(vars, Var.AdminRoleName);
      const role = items.find((r) => r.roleName === roleName);
      if (role) {
        const privNames = role.rolePrivileges.map((p) => p.privilegeName);
        const hasPrivs = REQUIRED_PRIVS.every((p) => privNames.includes(p));
        if (!hasPrivs) {
          log(LogLevel.Info, "Role missing required privileges");
          markIncomplete("Role privileges incorrect", {
            adminRoleId: role.roleId,
            directoryServiceId: role.rolePrivileges[0]?.serviceId
          });
          return;
        }
        const userId = getVar(vars, Var.ProvisioningUserId);
        const AssignmentsSchema = z.object({
          items: z
            .array(z.object({ roleId: z.string(), assignedTo: z.string() }))
            .optional()
        });
        const assignUrl = `${ApiEndpoint.Google.RoleAssignments}?userKey=${encodeURIComponent(
          userId
        )}`;
        const { items: assignments = [] } = await fetchGoogle(
          assignUrl,
          AssignmentsSchema
        );

        const exists = assignments.some((a) => a.roleId === role.roleId);

        if (exists) {
          log(LogLevel.Info, "Role and assignment exist");
          markComplete({
            adminRoleId: role.roleId,
            directoryServiceId: role.rolePrivileges[0]?.serviceId
          });
        } else {
          log(LogLevel.Info, "Role exists without assignment");
          markIncomplete("Role assignment missing", {
            adminRoleId: role.roleId,
            directoryServiceId: role.rolePrivileges[0]?.serviceId
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
     * Example success
     *
     * 200
     * {
     *   "items": [
     *     {
     *       "privilegeName": "USERS_ALL",
     *       "serviceId": "00haapch16h1ysv",
     *       "childPrivileges": [ { "privilegeName": "USERS_RETRIEVE" } ]
     *     }
     *   ]
     * }
     *
     * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
     * {
     *   "roleName": "Microsoft Entra Provisioning",
     *   "roleDescription": "Custom role for Microsoft provisioning",
     *   "rolePrivileges": [
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "ORGANIZATION_UNITS_RETRIEVE" },
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_RETRIEVE" },
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_CREATE" },
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "USERS_UPDATE" },
     *     { "serviceId": "{directoryServiceId}", "privilegeName": "GROUPS_ALL" }
     *   ]
     * }
     *
     * Success response
     *
     * 200
     * {
     *   "roleId": "91447453409035734",
     *   "roleName": "TempRole_1750182467"
     * }
     *
     * Conflict response
     *
     * 409
     * {
     *   "error": {
     *     "message": "Another role exists with the same role name"
     *   }
     * }
     */
    try {
      const PrivilegeSchema: z.ZodType<AdminPrivilege> = z.lazy(() =>
        z.object({
          serviceId: z.string(),
          privilegeName: z.string(),
          childPrivileges: z.array(PrivilegeSchema).optional()
        })
      );

      const PrivListSchema = z.object({ items: z.array(PrivilegeSchema) });

      const { items } = await fetchGoogle(
        ApiEndpoint.Google.RolePrivileges,
        PrivListSchema
      );

      const serviceId = findInTree(
        items,
        (priv) => priv.privilegeName === "USERS_RETRIEVE",
        (priv) => priv.childPrivileges
      )?.serviceId;

      if (!serviceId)
        throw new Error("Service ID not found in role privileges");

      const CreateSchema = z.object({ roleId: z.string() });

      let roleId = checkData.adminRoleId;
      try {
        const res = await fetchGoogle(ApiEndpoint.Google.Roles, CreateSchema, {
          method: "POST",
          body: JSON.stringify({
            roleName: getVar(vars, Var.AdminRoleName),
            roleDescription: "Custom role for Microsoft provisioning",
            rolePrivileges: [
              { serviceId, privilegeName: "ORGANIZATION_UNITS_RETRIEVE" },
              { serviceId, privilegeName: "USERS_RETRIEVE" },
              { serviceId, privilegeName: "USERS_CREATE" },
              { serviceId, privilegeName: "USERS_UPDATE" },
              { serviceId, privilegeName: "GROUPS_ALL" }
            ]
          })
        });
        roleId = res.roleId;
      } catch (error) {
        if (isConflictError(error)) {
          if (!roleId) {
            const RolesSchema = z.object({
              items: z
                .array(
                  z.object({
                    roleId: z.string(),
                    roleName: z.string(),
                    rolePrivileges: z.array(
                      z.object({
                        serviceId: z.string(),
                        privilegeName: z.string()
                      })
                    )
                  })
                )
                .optional()
            });
            const { items: rolesList = [] } = await fetchGoogle(
              ApiEndpoint.Google.Roles,
              RolesSchema,
              { flatten: true }
            );
            const roleName = getVar(vars, Var.AdminRoleName);
            roleId = rolesList.find((r) => r.roleName === roleName)?.roleId;
          }
        } else {
          throw error;
        }
      }

      if (!roleId) throw new Error("Role ID unavailable after create");

      const userId = getVar(vars, Var.ProvisioningUserId);
      const AssignSchema = z.object({ kind: z.string().optional() });
      try {
        /**
         * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments
         * {
         *   "roleId": "91447453409035734",
         *   "assignedTo": "103898700330622175095",
         *   "scopeType": "CUSTOMER"
         * }
         *
         * Success response
         *
         * 200
         * {
         *   "roleAssignmentId": "91447453409034880",
         *   "roleId": "91447453409035734",
         *   "assignedTo": "103898700330622175095"
         * }
         *
         * Conflict response
         *
         * 409
         * { "error": { "message": "Role assignment already exists for the role" } }
         */
        await fetchGoogle(ApiEndpoint.Google.RoleAssignments, AssignSchema, {
          method: "POST",
          body: JSON.stringify({
            roleId,
            assignedTo: userId,
            scopeType: "CUSTOMER"
          })
        });
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
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
  },
  undo: async ({ vars, fetchGoogle, markReverted, markFailed, log }) => {
    try {
      const roleId = vars[Var.AdminRoleId] as string | undefined;
      const userId = vars[Var.ProvisioningUserId] as string | undefined;
      if (!roleId || !userId) {
        markFailed("Missing role or user id");
        return;
      }
      const AssignSchema = z.object({
        items: z
          .array(
            z.object({
              roleAssignmentId: z.string(),
              roleId: z.string(),
              assignedTo: z.string()
            })
          )
          .optional()
      });

      const { items = [] } = await fetchGoogle(
        `${ApiEndpoint.Google.RoleAssignments}?userKey=${encodeURIComponent(userId)}`,
        AssignSchema
      );
      const assignment = items.find((a) => a.roleId === roleId);
      if (assignment) {
        await fetchGoogle(
          `${ApiEndpoint.Google.RoleAssignments}/${assignment.roleAssignmentId}`,
          EmptyResponseSchema,
          { method: "DELETE" }
        );
      }

      await fetchGoogle(
        `${ApiEndpoint.Google.Roles}/${roleId}`,
        EmptyResponseSchema,
        { method: "DELETE" }
      );
      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to undo admin role", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
