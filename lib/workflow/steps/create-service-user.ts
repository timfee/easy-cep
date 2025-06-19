import { ApiEndpoint, OrgUnit } from "@/constants";
import {
  EmptyResponseSchema,
  isConflictError,
  isNotFoundError,
  isPreconditionFailedError
} from "@/lib/workflow/utils";

import { LogLevel, StepId, Var } from "@/types";
import crypto from "crypto";
import { z } from "zod";
import { createStep, getVar } from "../create-step";

interface CheckData {
  provisioningUserId?: string;
  provisioningUserEmail?: string;
}

export default createStep<CheckData>({
  id: StepId.CreateServiceUser,
  requires: [
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.PrimaryDomain,
    Var.ProvisioningUserPrefix,
    Var.AutomationOuPath
  ],
  provides: [
    Var.ProvisioningUserId,
    Var.ProvisioningUserEmail,
    Var.GeneratedPassword
  ],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/users/azuread-provisioning@{primaryDomain}
   *
   * Example success (200)
   * {
   *   "id": "102354298977995584115",
   *   "primaryEmail": "azuread-provisioning@cep-netnew.cc"
   * }
   *
   * Example not found (404)
   * { "error": { "code": 404 } }
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
      const domain = getVar(vars, Var.PrimaryDomain);
      const prefix = getVar(vars, Var.ProvisioningUserPrefix);

      const UserSchema = z
        .object({
          id: z.string().optional(),
          primaryEmail: z.string().optional(),
          orgUnitPath: z.string().optional()
        })
        .passthrough();
      const email = `${prefix}@${domain}`;
      const url = `${ApiEndpoint.Google.Users}/${encodeURIComponent(email)}?fields=id,primaryEmail`;
      const user = await fetchGoogle(url, UserSchema);

      if (user.id && user.primaryEmail) {
        log(LogLevel.Info, "Service user already exists");
        markComplete({
          provisioningUserId: user.id,
          provisioningUserEmail: user.primaryEmail
        });
      } else {
        log(LogLevel.Error, "Unexpected user response", { user });
        markCheckFailed("Malformed user object returned");
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        markIncomplete("Service user missing", {});
      } else {
        log(LogLevel.Error, "Failed to check service user", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Failed to check user"
        );
      }
    }
  },

  async execute({
    vars,
    fetchGoogle,
    checkData: _checkData,
    markSucceeded,
    markFailed,
    log
  }) {
    /**
     * POST https://admin.googleapis.com/admin/directory/v1/users
     * {
     *   "primaryEmail": "azuread-provisioning@{primaryDomain}",
     *   "name": { "givenName": "Microsoft", "familyName": "Provisioning" },
     *   "password": "TempXXXX!",
     *   "orgUnitPath": "/Automation"
     * }
     *
     * Success response
     *
     * 201
     * { "id": "...", "primaryEmail": "azuread-provisioning@cep-netnew.cc" }
     *
     * Conflict response
     *
     * 409
     * { "error": { "message": "Entity already exists." } }
     */
    try {
      const domain = getVar(vars, Var.PrimaryDomain);

      const BYTES = 4;
      const password = `Temp${crypto.randomBytes(BYTES).toString("hex")}!`;
      const CreateSchema = z.object({
        id: z.string(),
        primaryEmail: z.string()
      });

      let user;
      try {
        const prefix = getVar(vars, Var.ProvisioningUserPrefix);
        const ouPath = getVar(vars, Var.AutomationOuPath);
        user = await fetchGoogle(ApiEndpoint.Google.Users, CreateSchema, {
          method: "POST",
          body: JSON.stringify({
            primaryEmail: `${prefix}@${domain}`,
            name: { givenName: "Microsoft", familyName: "Provisioning" },
            password,
            orgUnitPath: ouPath
          })
        });
      } catch (error) {
        if (isConflictError(error)) {
          const fallbackEmail = `${getVar(vars, Var.ProvisioningUserPrefix)}@${domain}`;
          const getUrl = `${ApiEndpoint.Google.Users}/${encodeURIComponent(fallbackEmail)}?fields=id,primaryEmail`;
          user = await fetchGoogle(getUrl, CreateSchema);

          await fetchGoogle(
            `${ApiEndpoint.Google.Users}/${user.id}`,
            z.object({}),
            { method: "PUT", body: JSON.stringify({ password }) }
          );
        } else {
          throw error;
        }
      }

      markSucceeded({
        [Var.ProvisioningUserId]: user.id,
        [Var.ProvisioningUserEmail]: user.primaryEmail,
        [Var.GeneratedPassword]: password
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to create service user", { error });
      markFailed(error instanceof Error ? error.message : "Create failed");
    }
  },
  undo: async ({ vars, fetchGoogle, markReverted, markFailed, log }) => {
    try {
      const id = vars[Var.ProvisioningUserId] as string | undefined;
      if (!id) {
        markFailed("Missing provisioning user id");
        return;
      }
      await fetchGoogle(
        `${ApiEndpoint.Google.Users}/${id}`,
        EmptyResponseSchema,
        { method: "DELETE" }
      );
      markReverted();
    } catch (error) {
      if (isNotFoundError(error) || isPreconditionFailedError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete service user", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
