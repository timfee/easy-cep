import { isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";

import { WORKFLOW_LIMITS } from "../constants/workflow-limits";
import { defineStep } from "../step-builder";

export default defineStep(StepId.ConfigureGoogleSamlProfile)
  .requires(
    Var.GoogleAccessToken,
    Var.IsDomainVerified,
    Var.SamlProfileDisplayName
  )
  .provides(Var.SamlProfileId, Var.EntityId, Var.AcsUrl)

  .check(
    async ({ google, markComplete, markIncomplete, markCheckFailed, log }) => {
      try {
        const { inboundSamlSsoProfiles = [] } = (await google.samlProfiles
          .list()
          .get()) as {
          inboundSamlSsoProfiles?: {
            name: string;
            spConfig: { entityId: string; assertionConsumerServiceUri: string };
          }[];
        };

        if (
          inboundSamlSsoProfiles.length >
          WORKFLOW_LIMITS.SAML_PROFILES_WARNING_THRESHOLD
        ) {
          log(
            LogLevel.Info,
            `Found ${inboundSamlSsoProfiles.length} SAML profiles - nearing API limits`
          );
        }

        if (inboundSamlSsoProfiles.length > 0) {
          const profile = inboundSamlSsoProfiles[0];
          log(LogLevel.Info, "SAML profile already exists");
          markComplete({
            acsUrl: profile.spConfig.assertionConsumerServiceUri,
            entityId: profile.spConfig.entityId,
            samlProfileId: profile.name,
          });
        } else {
          log(LogLevel.Info, "SAML profile missing");
          markIncomplete("SAML profile missing", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check SAML profiles", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, google, output, markFailed, markPending, log }) => {
    try {
      const op = (await google.samlProfiles.create().post({
        displayName: vars.require(Var.SamlProfileDisplayName),
        idpConfig: { entityId: "", singleSignOnServiceUri: "" },
      })) as {
        done: boolean;
        error?: { message: string };
        response?: { name?: string };
      };

      if (!op.done) {
        markPending("SAML profile creation in progress");
        return;
      }

      if (op.error) {
        log(LogLevel.Error, "Operation failed", { error: op.error });
        markFailed(op.error.message);
        return;
      }

      const profileName = op.response?.name;

      if (!profileName) {
        markFailed("Missing profile in response");
        return;
      }

      const profile = (await google.samlProfiles.get(profileName).get()) as {
        name: string;
        spConfig: { entityId: string; assertionConsumerServiceUri: string };
      };

      output({
        acsUrl: profile.spConfig.assertionConsumerServiceUri,
        entityId: profile.spConfig.entityId,
        samlProfileId: profile.name,
      });
    } catch (error) {
      log(LogLevel.Error, "Failed to create SAML profile", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const id = vars.require(Var.SamlProfileId);
      await google.samlProfiles.delete(id).delete();
      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to delete SAML profile", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
