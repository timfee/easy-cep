import { isConflictError, isNotFoundError } from "@/lib/workflow/core/errors";
import { LogLevel, StepId, Var } from "@/types";
import { GOOGLE_ADMIN_PRIVILEGES } from "../constants/google-admin";
import { defineStep } from "../step-builder";

export default defineStep(StepId.CreateAdminRoleAndAssignUser)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.ProvisioningUserId,
    Var.AdminRoleName
  )
  .provides(Var.AdminRoleId, Var.DirectoryServiceId)

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * {
   *   "kind": "admin#directory#roles",
   *   "items": [ { "roleId": "91447453409034818" } ]
   * }
   *
   * Success response (200) – paginated
   * {
   *   "kind": "admin#directory#roles",
   *   "items": [],
   *   "nextPageToken": "token"
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
        const { items = [] } = await google.roles.list().flatten(true).get();
        // Extract: adminRoleId = role.roleId when found
        const roleName = vars.require(Var.AdminRoleName);
        const role = items.find((roleItem) => roleItem.roleName === roleName);
        if (role) {
          const privilegeNames = role.rolePrivileges.map(
            (privilege) => privilege.privilegeName
          );
          const hasPrivs = GOOGLE_ADMIN_PRIVILEGES.REQUIRED.every((priv) =>
            privilegeNames.includes(priv)
          );
          if (!hasPrivs) {
            log(LogLevel.Info, "Role missing required privileges");
            markIncomplete("Role privileges incorrect", {
              adminRoleId: role.roleId,
              directoryServiceId: role.rolePrivileges[0]?.serviceId
            });
            return;
          }
          const userId = vars.require(Var.ProvisioningUserId);

          const { items: assignments = [] } = await google.roleAssignments
            .list()
            .query({ userKey: userId })
            .get();
          // Extract: existing assignment = assignments.some(...)

          const exists = assignments.some(
            (assignment) => assignment.roleId === role.roleId
          );

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
          log(LogLevel.Info, "Custom admin role missing");
          markIncomplete("Custom admin role missing", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check custom role", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, google, checkData, output, markFailed, log }) => {
    /**
     * GET https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/ALL/privileges
     * Headers: { Authorization: Bearer {googleAccessToken} }
     *
     * Success response (200)
     * { "items": [ { "privilegeName": "USERS_ALL", "serviceId": "00haapch16h1ysv" } ] }
     *
     * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles
     * Headers: { Authorization: Bearer {googleAccessToken} }
     * Body:
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
     * Success response (200)
     * { "roleId": "91447453409035734" }
     *
     * Error response (409)
     * { "error": { "code": 409, "message": "Another role exists with the same role name" } }
     */
    try {
      const { items: privileges } = await google.roles.privileges().get();

      let serviceId: string | undefined;
      const stack = [...privileges];
      while (stack.length > 0) {
        const priv = stack.shift()!;
        if (priv.privilegeName === "USERS_RETRIEVE") {
          serviceId = priv.serviceId;
          break;
        }
        if (priv.childPrivileges) {
          stack.push(...priv.childPrivileges);
        }
      }
      // Extract: directoryServiceId = serviceId

      if (!serviceId)
        throw new Error("Service ID not found in role privileges");

      let roleId = checkData.adminRoleId;
      try {
        const res = await google.roles.create().post({
          roleName: vars.require(Var.AdminRoleName),
          roleDescription: "Custom role for Microsoft provisioning",
          rolePrivileges: [
            { serviceId, privilegeName: "ORGANIZATION_UNITS_RETRIEVE" },
            { serviceId, privilegeName: "USERS_RETRIEVE" },
            { serviceId, privilegeName: "USERS_CREATE" },
            { serviceId, privilegeName: "USERS_UPDATE" },
            { serviceId, privilegeName: "GROUPS_ALL" }
          ]
        });
        roleId = res.roleId;
        // Extract: adminRoleId = res.roleId
      } catch (error) {
        if (isConflictError(error)) {
          if (!roleId) {
            const { items: rolesList = [] } = await google.roles
              .list()
              .flatten(true)
              .get();
            const roleName = vars.require(Var.AdminRoleName);
            roleId = rolesList.find(
              (roleItem) => roleItem.roleName === roleName
            )?.roleId;
          }
        } else {
          throw error;
        }
      }

      if (!roleId) throw new Error("Role ID unavailable after create");

      const userId = vars.require(Var.ProvisioningUserId);
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
        /**
         * POST https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments
         * Headers: { Authorization: Bearer {googleAccessToken} }
         * Body: { "roleId": "{roleId}", "assignedTo": "{userId}", "scopeType": "CUSTOMER" }
         *
         * Success response (200)
         * { "roleAssignmentId": "..." }
         *
         * Error response (409)
         * { "error": { "code": 409, "message": "Role assignment already exists for the role" } }
         */
        log(LogLevel.Info, "Assigning role to user (with retry)");

        await google.roleAssignments
          .create()
          .retry(3)
          .post({ roleId, assignedTo: userId, scopeType: "CUSTOMER" });

        log(LogLevel.Info, "Role assignment succeeded");
      } catch (error) {
        // isConflictError handles: 409
        if (!isConflictError(error)) {
          throw error;
        }
        log(LogLevel.Info, "Role already assigned");
      }

      output({ adminRoleId: roleId, directoryServiceId: serviceId });
    } catch (error) {
      log(LogLevel.Error, "Failed to create custom role", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const roleId = vars.get(Var.AdminRoleId);
      const userId = vars.get(Var.ProvisioningUserId);

      if (!roleId) {
        markReverted();
        return;
      }

      try {
        const builder = google.roleAssignments.list();
        const { items: assignments = [] } = await (userId ?
          builder.query({ userKey: userId }).get()
        : builder.query({ roleId }).get());

        const toRemove = assignments.filter(
          (assignment) =>
            assignment.roleId === roleId
            && (!userId || assignment.assignedTo === userId)
        );

        for (const assignment of toRemove) {
          try {
            await google.roleAssignments
              .delete(assignment.roleAssignmentId)
              .delete();
            log(
              LogLevel.Info,
              `Removed role assignment ${assignment.roleAssignmentId}`
            );
          } catch (error) {
            log(
              LogLevel.Info,
              `Failed to remove assignment ${assignment.roleAssignmentId}`,
              { error }
            );
          }
        }
      } catch (error) {
        log(LogLevel.Info, "Could not query role assignments", { error });
      }

      try {
        await google.roles.delete(roleId).delete();
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to undo admin role", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
