import { createHash } from "node:crypto";
import {
  isConflictError,
  isNotFoundError,
  isPreconditionFailedError,
} from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";
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

  .check(
    async ({
      vars,
      google,
      markComplete,
      markIncomplete,
      markCheckFailed,
      markStale,
      log,
    }) => {
      try {
        vars.require(Var.PrimaryDomain);
        vars.require(Var.ProvisioningUserPrefix);

        const email = vars.build("{provisioningUserPrefix}@{primaryDomain}");
        const user = (await google.users.get(email).get()) as {
          id?: string;
          primaryEmail?: string;
        };

        if (user.id && user.primaryEmail) {
          log(LogLevel.Info, "Service user already exists", {
            provisioningUserId: user.id,
            provisioningUserEmail: user.primaryEmail,
          });
          const existingPassword = vars.get(Var.GeneratedPassword);
          if (existingPassword) {
            markComplete({
              provisioningUserId: user.id,
              provisioningUserEmail: user.primaryEmail,
              generatedPassword: existingPassword,
            });
          } else {
            markStale("Service user password missing", {
              provisioningUserId: user.id,
              provisioningUserEmail: user.primaryEmail,
            });
          }
        } else {
          log(LogLevel.Error, "Unexpected user response", { user });
          markCheckFailed("Malformed user object returned");
        }
      } catch (error) {
        if (isNotFoundError(error)) {
          log(LogLevel.Debug, "Service user missing");
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
      log,
    }) => {
      try {
        const primaryDomain = vars.require(Var.PrimaryDomain);
        const existingPassword = vars.get(Var.GeneratedPassword);
        const password =
          existingPassword ??
          createHash("md5")
            .update(`${primaryDomain}cep${new Date().getFullYear()}`)
            .digest("hex")
            .slice(0, 11);

        let user: { id: string; primaryEmail: string };
        try {
          vars.require(Var.ProvisioningUserPrefix);
          const ouPath = vars.require(Var.AutomationOuPath);
          user = (await google.users.create().post({
            primaryEmail: vars.build(
              "{provisioningUserPrefix}@{primaryDomain}"
            ),
            name: { givenName: "Microsoft", familyName: "Provisioning" },
            password,
            orgUnitPath: ouPath,
          })) as { id: string; primaryEmail: string };
        } catch (error) {
          if (!isConflictError(error)) {
            throw error;
          }

          const fallbackEmail = vars.build(
            "{provisioningUserPrefix}@{primaryDomain}"
          );
          const existingUser = (await google.users
            .get(fallbackEmail)
            .get()) as { id?: string; primaryEmail?: string };
          const userId = existingUser.id;
          const userEmail = existingUser.primaryEmail;
          if (!(userId && userEmail)) {
            throw new Error("User lookup missing identifiers");
          }
          await google.users.update(userId).put({ password });
          user = { id: userId, primaryEmail: userEmail };
        }

        output({
          provisioningUserId: user.id,
          provisioningUserEmail: user.primaryEmail,
          generatedPassword: password,
        });
      } catch (error) {
        log(LogLevel.Error, "Failed to create service user", { error });
        markFailed(error instanceof Error ? error.message : "Create failed");
      }
    }
  )
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const id = vars.require(Var.ProvisioningUserId);
      await google.users.delete(id).delete();
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
