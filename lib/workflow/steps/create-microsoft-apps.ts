import { TemplateId } from "@/constants";
import { isNotFoundError } from "@/lib/workflow/core/errors";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";
import type { MicrosoftClient } from "../http/microsoft-client";
import { defineStep } from "../step-builder";

const createProvisioningApp = async (
  microsoft: MicrosoftClient,
  displayName: string
) => {
  const res = (await microsoft.applications
    .instantiate(TemplateId.GoogleWorkspaceConnector)
    .post({ displayName })) as {
    servicePrincipal: { id: string };
    application: { id: string };
  };
  return {
    provisioningSpId: res.servicePrincipal.id,
    provisioningAppId: res.application.id,
  };
};

const createSsoApp = async (
  microsoft: MicrosoftClient,
  displayName: string
) => {
  const res = (await microsoft.applications
    .instantiate(TemplateId.GoogleWorkspaceConnector)
    .post({ displayName })) as {
    servicePrincipal: { id: string };
    application: { appId: string };
  };
  return { ssoSpId: res.servicePrincipal.id, ssoAppId: res.application.appId };
};

const cleanupProvisioningApp = async (
  microsoft: MicrosoftClient,
  provisioningSpId: string | undefined,
  provisioningAppId: string | undefined
) => {
  if (provisioningSpId) {
    await microsoft.servicePrincipals.delete(provisioningSpId).delete();
  }

  if (provisioningAppId) {
    await microsoft.applications.delete(provisioningAppId).delete();
  }
};

const removeResource = async (
  label: string,
  action: () => Promise<void>,
  log: (level: LogLevel, message: string, data?: unknown) => void,
  onFailure: (message: string) => void
) => {
  try {
    await action();
  } catch (error) {
    if (isNotFoundError(error)) {
      log(LogLevel.Info, `${label} already deleted or not found`);
      return true;
    }
    log(LogLevel.Error, `Failed to delete ${label}`, { error });
    onFailure(error instanceof Error ? error.message : "Undo failed");
    return false;
  }
  return true;
};

const reportCleanupFailure = (error: unknown, cleanupError: unknown) => {
  const baseMessage =
    error instanceof Error ? error.message : "SSO creation failed";
  return `${baseMessage}. Cleanup failed: ${cleanupError}`;
};

const handleAppCreateFailure = async (
  microsoft: MicrosoftClient,
  provisioningSpId: string | undefined,
  provisioningAppId: string | undefined,
  error: unknown,
  log: (level: LogLevel, message: string, data?: unknown) => void,
  markFailed: (message: string) => void
) => {
  log(LogLevel.Error, "Failed to create Microsoft apps", { error });

  if (!(provisioningSpId || provisioningAppId)) {
    markFailed(error instanceof Error ? error.message : "Execute failed");
    return;
  }

  log(LogLevel.Error, "SSO app creation failed, attempting cleanup", { error });
  try {
    await cleanupProvisioningApp(
      microsoft,
      provisioningSpId,
      provisioningAppId
    );
  } catch (cleanupError) {
    markFailed(reportCleanupFailure(error, cleanupError));
    return;
  }

  markFailed(error instanceof Error ? error.message : "Execute failed");
};

export default defineStep(StepId.CreateMicrosoftApps)
  .requires(
    Var.MsGraphToken,
    Var.ProvisioningAppDisplayName,
    Var.SsoAppDisplayName
  )
  .provides(
    Var.ProvisioningServicePrincipalId,
    Var.SsoServicePrincipalId,
    Var.SsoAppId
  )

  .check(
    async ({
      microsoft,
      markComplete,
      markIncomplete,
      markCheckFailed,
      log,
    }) => {
      try {
        const provFilter = `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`;
        const ssoFilter = `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`;

        const { value: provApps } = (await microsoft.applications
          .list()
          .query({ $filter: provFilter })
          .get()) as { value: Array<{ id: string; appId: string }> };

        const { value: ssoApps } = (await microsoft.applications
          .list()
          .query({ $filter: ssoFilter })
          .get()) as { value: Array<{ id: string; appId: string }> };

        const findAppWithSp = async (
          apps: Array<{ id: string; appId: string }>
        ) => {
          for (const app of apps) {
            const filter = `appId eq '${app.appId}'`;
            const { value } = (await microsoft.servicePrincipals
              .list()
              .query({ $filter: filter })
              .get()) as { value: Array<{ id: string }> };
            const spId = value[0]?.id;
            if (spId) {
              return { app, spId };
            }
          }
          return undefined;
        };

        const provPair = await findAppWithSp(provApps);
        const ssoPair = await findAppWithSp(ssoApps);

        const provApp = provPair?.app;
        const provId = provPair?.spId;
        const ssoApp = ssoPair?.app ?? provApp;
        const ssoId = ssoPair?.spId;

        const sameApp = provApp?.appId === ssoApp?.appId;

        if (!(provApp && ssoApp)) {
          log(LogLevel.Info, "Microsoft apps not found");
          markIncomplete("Microsoft apps not found", {});
          return;
        }

        if (!(provId && ssoId)) {
          log(LogLevel.Info, "Microsoft service principals not found");
          markIncomplete("Microsoft service principals not found", {});
          return;
        }

        log(
          LogLevel.Info,
          sameApp
            ? "Provisioning and SSO use the same app"
            : "Provisioning and SSO use separate apps"
        );
        log(LogLevel.Info, "Microsoft apps already exist");
        markComplete({
          provisioningServicePrincipalId: provId,
          ssoServicePrincipalId: ssoId,
          ssoAppId: ssoApp.appId,
        });
      } catch (error) {
        log(LogLevel.Error, "Failed to check Microsoft apps", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )

  .execute(async ({ vars, microsoft, output, markFailed, log }) => {
    let provisioningSpId: string | undefined;
    let provisioningAppId: string | undefined;
    let ssoSpId: string | undefined;
    let ssoAppId: string | undefined;

    const provisioningDisplayName = vars.require(
      Var.ProvisioningAppDisplayName
    );
    const ssoDisplayName = vars.require(Var.SsoAppDisplayName);

    try {
      log(LogLevel.Info, "Creating provisioning app");
      const provisioning = await createProvisioningApp(
        microsoft,
        provisioningDisplayName
      );
      provisioningSpId = provisioning.provisioningSpId;
      provisioningAppId = provisioning.provisioningAppId;

      log(LogLevel.Info, "Creating SSO app");
      const sso = await createSsoApp(microsoft, ssoDisplayName);
      ssoSpId = sso.ssoSpId;
      ssoAppId = sso.ssoAppId;

      output({
        provisioningServicePrincipalId: provisioningSpId,
        ssoServicePrincipalId: ssoSpId,
        ssoAppId,
      });
    } catch (error) {
      await handleAppCreateFailure(
        microsoft,
        provisioningSpId,
        provisioningAppId,
        error,
        log,
        markFailed
      );
    }
  })
  .undo(async ({ vars, microsoft, markReverted, markFailed, log }) => {
    try {
      const provSpId = vars.get(Var.ProvisioningServicePrincipalId);
      const ssoSpId = vars.get(Var.SsoServicePrincipalId);
      const appId = vars.get(Var.SsoAppId);

      if (provSpId) {
        const removed = await removeResource(
          "Service Principal",
          () =>
            microsoft.servicePrincipals
              .delete(provSpId)
              .delete()
              .then(() => undefined),
          log,
          markFailed
        );
        if (!removed) {
          return;
        }
      }

      if (ssoSpId && ssoSpId !== provSpId) {
        const removed = await removeResource(
          "Service Principal",
          () =>
            microsoft.servicePrincipals
              .delete(ssoSpId)
              .delete()
              .then(() => undefined),
          log,
          markFailed
        );
        if (!removed) {
          return;
        }
      }

      if (appId) {
        const removed = await removeResource(
          "Application",
          () =>
            microsoft.applications
              .delete(appId)
              .delete()
              .then(() => undefined),
          log,
          markFailed
        );
        if (!removed) {
          return;
        }
      }

      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete Microsoft apps", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
