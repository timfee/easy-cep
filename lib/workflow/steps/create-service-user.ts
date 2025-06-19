import { ApiEndpoint } from "@/constants";
import {
  EmptyResponseSchema,
  isConflictError,
  isNotFoundError,
  isPreconditionFailedError
} from "@/lib/workflow/utils";

import { LogLevel, StepId, Var } from "@/types";
import crypto from "crypto";
import { z } from "zod";
import { defineStep } from "../step-builder";

export default defineStep(StepId.CreateServiceUser)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.PrimaryDomain,
    Var.ProvisioningUserPrefix,
    Var.AutomationOuPath
  )
  .provides(
    Var.ProvisioningUserId,
    Var.ProvisioningUserEmail,
    Var.GeneratedPassword
  )

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
        vars.require(Var.PrimaryDomain);
        vars.require(Var.ProvisioningUserPrefix);

        const UserSchema = z
          .object({
            id: z.string().optional(),
            primaryEmail: z.string().optional(),
            orgUnitPath: z.string().optional()
          })
          .passthrough();
        const email = vars.build("{provisioningUserPrefix}@{primaryDomain}");
        const url = `${ApiEndpoint.Google.Users}/${encodeURIComponent(email)}?fields=id,primaryEmail`;
        const user = await google.get(url, UserSchema);

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
    }
  )

  .execute(
    async ({
      vars,
      google,
      checkData: _checkData,
      output,
      markFailed,
      log
    }) => {
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
        vars.require(Var.PrimaryDomain);

        const BYTES = 4;
        const password = `Temp${crypto.randomBytes(BYTES).toString("hex")}!`;
        const CreateSchema = z.object({
          id: z.string(),
          primaryEmail: z.string()
        });

        let user;
        try {
          vars.require(Var.ProvisioningUserPrefix);
          const ouPath = vars.require(Var.AutomationOuPath);
          user = await google.post(ApiEndpoint.Google.Users, CreateSchema, {
            primaryEmail: vars.build(
              "{provisioningUserPrefix}@{primaryDomain}"
            ),
            name: { givenName: "Microsoft", familyName: "Provisioning" },
            password,
            orgUnitPath: ouPath
          });
        } catch (error) {
          if (isConflictError(error)) {
            const fallbackEmail = vars.build(
              "{provisioningUserPrefix}@{primaryDomain}"
            );
            const getUrl = `${ApiEndpoint.Google.Users}/${encodeURIComponent(
              fallbackEmail
            )}?fields=id,primaryEmail`;
            user = await google.get(getUrl, CreateSchema);

            await google.put(
              `${ApiEndpoint.Google.Users}/${user.id}`,
              z.object({}),
              { password }
            );
          } else {
            throw error;
          }
        }

        output({
          provisioningUserId: user.id,
          provisioningUserEmail: user.primaryEmail,
          generatedPassword: password
        });
      } catch (error) {
        log(LogLevel.Error, "Failed to create service user", { error });
        markFailed(error instanceof Error ? error.message : "Create failed");
      }
    }
  )
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const id = vars.get(Var.ProvisioningUserId);
      if (!id) {
        markFailed("Missing provisioning user id");
        return;
      }
      await google.delete(
        `${ApiEndpoint.Google.Users}/${id}`,
        EmptyResponseSchema
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
  })
  .build();
