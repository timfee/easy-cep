import { isConflictError, isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";

import {
  type AdminPrivilege,
  GOOGLE_ADMIN_PRIVILEGES,
} from "../constants/google-admin";
import { defineStep } from "../step-builder";

interface RoleItem {
  roleId: string;
  roleName: string;
  rolePrivileges: { serviceId: string; privilegeName: string }[];
}

interface RoleAssignment {
  roleAssignmentId: string;
  roleId: string;
  assignedTo: string;
}

const findPrivilegeServiceId = (privileges: AdminPrivilege[]) => {
  const stack = [...privileges];
  while (stack.length > 0) {
    const priv = stack.shift();
    if (!priv) {
      continue;
    }
    if (priv.privilegeName === "USERS_RETRIEVE") {
      return priv.serviceId;
    }
    if (priv.childPrivileges) {
      stack.push(...priv.childPrivileges);
    }
  }
  return;
};

export default defineStep(StepId.CreateAdminRoleAndAssignUser)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.ProvisioningUserId,
    Var.AdminRoleName
  )
  .provides(Var.AdminRoleId, Var.DirectoryServiceId)

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
        const { items = [] } = (await google.roles.list().get()) as {
          items?: RoleItem[];
        };
        const roleName = vars.require(Var.AdminRoleName);
        const role = items.find((roleItem) => roleItem.roleName === roleName);
        if (role) {
          const privilegeNames = new Set(
            role.rolePrivileges.map((privilege) => privilege.privilegeName)
          );
          const hasPrivs = GOOGLE_ADMIN_PRIVILEGES.REQUIRED.every((priv) =>
            privilegeNames.has(priv)
          );
          if (!hasPrivs) {
            log(LogLevel.Info, "Role missing required privileges");
            markIncomplete("Role privileges incorrect", {
              adminRoleId: role.roleId,
              directoryServiceId: role.rolePrivileges[0]?.serviceId,
            });
            return;
          }
          const userId = vars.require(Var.ProvisioningUserId);

          const { items: assignments = [] } = (await google.roleAssignments
            .list()
            .query({ userKey: userId })
            .get()) as { items?: RoleAssignment[] };

          const exists = assignments.some(
            (assignment) => assignment.roleId === role.roleId
          );

          if (exists) {
            log(LogLevel.Info, "Role and assignment exist");
            markComplete({
              adminRoleId: role.roleId,
              directoryServiceId: role.rolePrivileges[0]?.serviceId,
            });
          } else {
            log(LogLevel.Info, "Role exists without assignment");
            markIncomplete("Role assignment missing", {
              adminRoleId: role.roleId,
              directoryServiceId: role.rolePrivileges[0]?.serviceId,
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
    try {
      const { items: privileges } = (await google.roles.privileges().get()) as {
        items: AdminPrivilege[];
      };

      const serviceId = findPrivilegeServiceId(privileges);
      if (!serviceId) {
        throw new Error("Service ID not found in role privileges");
      }

      let roleId = checkData.adminRoleId;
      try {
        const res = (await google.roles.create().post({
          roleDescription: "Custom role for Microsoft provisioning",
          roleName: vars.require(Var.AdminRoleName),
          rolePrivileges: [
            { privilegeName: "ORGANIZATION_UNITS_RETRIEVE", serviceId },
            { privilegeName: "USERS_RETRIEVE", serviceId },
            { privilegeName: "USERS_CREATE", serviceId },
            { privilegeName: "USERS_UPDATE", serviceId },
            { privilegeName: "GROUPS_ALL", serviceId },
          ],
        })) as { roleId: string };
        ({ roleId } = res);
      } catch (error) {
        if (isConflictError(error)) {
          if (!roleId) {
            const { items: rolesList = [] } = (await google.roles
              .list()
              .get()) as { items?: RoleItem[] };
            const roleName = vars.require(Var.AdminRoleName);
            roleId = rolesList.find(
              (roleItem) => roleItem.roleName === roleName
            )?.roleId;
          }
        } else {
          throw error;
        }
      }

      if (!roleId) {
        throw new Error("Role ID unavailable after create");
      }

      const userId = vars.require(Var.ProvisioningUserId);
      try {
        await google.roleAssignments
          .create()
          .retry(3)
          .post({ assignedTo: userId, roleId, scopeType: "CUSTOMER" });

        log(LogLevel.Info, "Role assignment succeeded");
      } catch (error) {
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
        const { items: assignments = [] } = (await (userId
          ? builder.query({ userKey: userId }).get()
          : builder.query({ roleId }).get())) as { items?: RoleAssignment[] };

        const toRemove = assignments.filter(
          (assignment) =>
            assignment.roleId === roleId &&
            (!userId || assignment.assignedTo === userId)
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
