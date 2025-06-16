import { ApiEndpoint } from "@/constants";
import { LogLevel, StepId, Var } from "@/types";
import crypto from "crypto";
import { z } from "zod";
import { createStep } from "../create-step";

interface CheckData {
  provisioningUserId?: string;
  provisioningUserEmail?: string;
}

export default createStep<CheckData>({
  id: StepId.CreateServiceUser,
  requires: [Var.GoogleAccessToken, Var.PrimaryDomain],
  provides: [
    Var.ProvisioningUserId,
    Var.ProvisioningUserEmail,
    Var.GeneratedPassword
  ],

  async check({
    fetchGoogle,
    markComplete,
    markIncomplete,
    markCheckFailed,
    log
  }) {
    try {
      const domain = process.env.PRIMARY_DOMAIN;
      if (!domain) {
        markCheckFailed("Primary domain not available");
        return;
      }

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
    fetchGoogle,
    checkData: _checkData,
    markSucceeded,
    markFailed,
    log
  }) {
    try {
      const domain = process.env.PRIMARY_DOMAIN;
      if (!domain) {
        markFailed("Primary domain not available");
        return;
      }

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
            orgUnitPath: "/Automation"
          })
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("409")) {
          user = await fetchGoogle(
            `${ApiEndpoint.Google.Users}/azuread-provisioning@${domain}`,
            CreateSchema
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
  }
});

/* eslint-disable tsdoc/syntax */
/**
Sample check output:
{ "kind": "admin#directory#user", "id": "117839542198896213400", "primaryEmail": "azuread-provisioning@cep-netnew.cc", ... }

Sample create attempt output (user exists):
{ "error": { "code": 409, "message": "Entity already exists.", "errors": [ { "message": "Entity already exists.", "domain": "global", "reason": "duplicate" } ] } }
*/
/* eslint-enable tsdoc/syntax */
