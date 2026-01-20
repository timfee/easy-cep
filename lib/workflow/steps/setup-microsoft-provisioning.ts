import { ApiEndpoint, SyncTemplateTag } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";

import { defineStep } from "../step-builder";

interface SyncJob {
  id?: string;
  templateId?: string;
  status?: { code?: string };
  value?: { id: string }[];
}

export default defineStep(StepId.SetupMicrosoftProvisioning)
  .requires(
    Var.MsGraphToken,
    Var.ProvisioningServicePrincipalId,
    Var.GeneratedPassword
  )
  .provides()

  .check(
    async ({
      vars,
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log,
    }) => {
      try {
        const spId = vars.require(Var.ProvisioningServicePrincipalId);

        const { value = [] } = (await microsoft.synchronization
          .jobs(spId)
          .list()
          .get()) as {
          value?: { id: string; status?: { code?: string } }[];
        };

        const active = value.some((job: SyncJob) => {
          const status = job.status?.code;
          return status ? status !== "Paused" : false;
        });

        if (active) {
          log(LogLevel.Info, "Synchronization already active");
          markComplete({});
        } else {
          log(LogLevel.Info, "Synchronization not started");
          markIncomplete("Synchronization not started", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check sync jobs", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    try {
      const spId = vars.require(Var.ProvisioningServicePrincipalId);
      const password = vars.require(Var.GeneratedPassword);
      const baseAddress = ApiEndpoint.Google.Users.replace("/users", "");

      const { value: templates } = (await microsoft.synchronization
        .templates(spId)
        .get()) as { value?: { id: string; factoryTag: string }[] };

      console.log("Templates", templates);
      const templateId =
        templates?.find(
          (template) => template.factoryTag === SyncTemplateTag.GoogleWorkspace
        )?.id ?? SyncTemplateTag.GoogleWorkspace;

      const { value: jobs = [] } = (await microsoft.synchronization
        .jobs(spId)
        .list()
        .get()) as { value?: { id: string; templateId?: string }[] };

      for (const job of jobs) {
        if (job.id) {
          await microsoft.synchronization.jobs(spId).delete(job.id).delete();
        }
      }

      console.log("Trying to create job", { templateId });
      const job = (await microsoft.synchronization
        .jobs(spId)
        .create()
        .post({ templateId })) as { id?: string };

      await microsoft.synchronization.secrets(spId).put({
        value: [
          { key: "BaseAddress", value: baseAddress },
          { key: "SecretToken", value: password },
        ],
      });

      if (!job.id) {
        throw new Error("Synchronization job id missing");
      }
      await microsoft.synchronization.jobs(spId).start(job.id).post();

      log(LogLevel.Info, "Microsoft provisioning setup completed");
      output({});
    } catch (error) {
      log(LogLevel.Error, "Failed to setup Microsoft provisioning", { error });
      markFailed(error instanceof Error ? error.message : "Execute failed");
    }
  })
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const spId = vars.require(Var.ProvisioningServicePrincipalId);

      const { value = [] } = (await microsoft.synchronization
        .jobs(spId)
        .list()
        .get()) as { value?: { id: string }[] };

      for (const job of value) {
        await microsoft.synchronization.jobs(spId).delete(job.id).delete();
      }

      markReverted();
    } catch (error) {
      if (isNotFoundError(error)) {
        markReverted();
      } else {
        log(LogLevel.Error, "Failed to remove sync job", { error });
        markFailed(error instanceof Error ? error.message : "Undo failed");
      }
    }
  })
  .build();
