import { ApiEndpoint, OrgUnit } from "@/constants";
import { EmptyResponseSchema, isConflictError } from "@/lib/workflow/utils";
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
  requires: [Var.GoogleAccessToken, Var.IsDomainVerified, Var.PrimaryDomain],
  provides: [
    Var.ProvisioningUserId,
    Var.ProvisioningUserEmail,
    Var.GeneratedPassword
  ],

  /**
   * GET https://admin.googleapis.com/admin/directory/v1/users/azuread-provisioning@{primaryDomain}
   *
   * Completed step example response
   *
   * 200
   * {
   *   "id": "103898700330622175095",
   *   "primaryEmail": "azuread-provisioning@cep-netnew.cc"
   * }
   *
   * Incomplete step example response
   *
   * 404
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

      const UserSchema = z.object({ id: z.string(), primaryEmail: z.string() });
      const url = `${ApiEndpoint.Google.Users}/azuread-provisioning@${domain}`;

      const user = await fetchGoogle(url, UserSchema);

      log(LogLevel.Info, "Service user already exists");
      markComplete({
        provisioningUserId: user.id,
        provisioningUserEmail: user.primaryEmail
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("HTTP 404")) {
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
        user = await fetchGoogle(ApiEndpoint.Google.Users, CreateSchema, {
          method: "POST",
          body: JSON.stringify({
            primaryEmail: `azuread-provisioning@${domain}`,
            name: { givenName: "Microsoft", familyName: "Provisioning" },
            password,
            orgUnitPath: OrgUnit.AutomationPath
          })
        });
      } catch (error) {
        if (isConflictError(error)) {
          user = await fetchGoogle(
            `${ApiEndpoint.Google.Users}/azuread-provisioning@${domain}`,
            CreateSchema
          );

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
      if (error instanceof Error && error.message.startsWith("HTTP 404")) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete service user", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  }
});
