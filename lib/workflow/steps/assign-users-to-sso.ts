import {
  isBadRequestError,
  isConflictError,
  isHttpError,
  isNotFoundError,
} from "@/lib/workflow/core/errors";
import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";
import { StepId } from "@/lib/workflow/step-ids";
import type { WorkflowVars } from "@/lib/workflow/variables";
import { Var } from "@/lib/workflow/variables";
import { LogLevel } from "@/types";
import type { GoogleClient } from "../http/google-client";
import { defineStep } from "../step-builder";

interface OrgUnit {
  orgUnitId: string;
  parentOrgUnitId?: string;
  orgUnitPath: string;
}

interface SsoAssignment {
  name: string;
  targetOrgUnit?: string;
  ssoMode?: string;
  samlSsoInfo?: { inboundSamlSsoProfile: string };
}

interface GoogleOperation {
  done: boolean;
  error?: { message: string };
}

type StepLogger = (level: LogLevel, message: string, data?: unknown) => void;

function normalizeOrgUnitId(orgUnitId: string): string {
  return orgUnitId.startsWith("id:") ? orgUnitId.slice(3) : orgUnitId;
}

async function deleteAssignment(
  google: GoogleClient,
  assignment: SsoAssignment,
  log: StepLogger
) {
  const assignmentId = extractResourceId(
    assignment.name,
    ResourceTypes.InboundSsoAssignments
  );
  try {
    await google.ssoAssignments.delete(assignmentId).delete();
    log(LogLevel.Info, "Deleted existing SSO assignment", {
      assignmentId,
      targetOrgUnit: assignment.targetOrgUnit,
      ssoMode: assignment.ssoMode,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    log(LogLevel.Info, "SSO assignment already deleted or missing", {
      assignmentId,
    });
  }
}

async function getRootOrgUnitId(google: GoogleClient) {
  const { organizationUnits = [] } = (await google.orgUnits
    .list()
    .query({ orgUnitPath: "/", type: "allIncludingParent" })
    .get()) as { organizationUnits?: OrgUnit[] };

  if (organizationUnits.length === 0) {
    throw new Error("No organizational units found");
  }

  const rootOU = organizationUnits.find(
    (ou) =>
      !ou.parentOrgUnitId ||
      ou.orgUnitPath === "/" ||
      ou.orgUnitId === ou.parentOrgUnitId
  );

  if (rootOU) {
    return extractResourceId(rootOU.orgUnitId, ResourceTypes.OrgUnitId);
  }

  const orphanOU = organizationUnits.find((ou) => {
    if (!ou.parentOrgUnitId) {
      return true;
    }
    return !organizationUnits.some(
      (parent) => parent.orgUnitId === ou.parentOrgUnitId
    );
  });

  if (!orphanOU) {
    throw new Error(
      "Cannot determine root organizational unit from available data"
    );
  }

  return extractResourceId(orphanOU.orgUnitId, ResourceTypes.OrgUnitId);
}

async function getOrgUnitResourceName(
  google: GoogleClient,
  orgUnitPath: string
) {
  const orgUnit = (await google.orgUnits.get(orgUnitPath).get()) as {
    orgUnitId?: string;
    orgUnitPath?: string;
  };

  if (!orgUnit.orgUnitId) {
    throw new Error(`Org unit id missing for ${orgUnitPath}`);
  }

  return `orgUnits/${normalizeOrgUnitId(
    extractResourceId(orgUnit.orgUnitId, ResourceTypes.OrgUnitId)
  )}`;
}

async function assertSamlProfileReady(google: GoogleClient, profileId: string) {
  const profileResourceId = extractResourceId(
    profileId,
    ResourceTypes.InboundSamlSsoProfiles
  );

  const profile = (await google.samlProfiles.get(profileResourceId).get()) as {
    idpConfig?: {
      entityId?: string;
      singleSignOnServiceUri?: string;
    };
  };

  let idpCredentials: Array<{ name: string }> = [];
  try {
    const credsResponse = (await google.samlProfiles
      .credentials(profileResourceId)
      .list()
      .get()) as { idpCredentials?: Array<{ name: string }> };
    idpCredentials = credsResponse.idpCredentials ?? [];
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  if (!profile.idpConfig?.entityId) {
    throw new Error("Missing SAML entity ID in Google profile");
  }

  if (!profile.idpConfig.singleSignOnServiceUri) {
    throw new Error("Missing SSO login URL in Google profile");
  }

  if (idpCredentials.length === 0) {
    throw new Error("No SAML signing certificate on Google profile");
  }
}

async function applySsoAssignment(
  google: GoogleClient,
  log: StepLogger,
  targetOrgUnit: string,
  assignment: {
    samlSsoInfo?: { inboundSamlSsoProfile: string };
    ssoMode: string;
  },
  label: string
): Promise<"done" | "pending"> {
  const payload = {
    targetOrgUnit,
    ...assignment,
  };
  log(LogLevel.Info, `Assigning ${label} to SSO`, payload);
  log(LogLevel.Debug, "Assign SSO request payload", payload);

  try {
    const op = (await google.ssoAssignments.create().post(payload)) as
      | GoogleOperation
      | undefined;
    if (!op?.done) {
      return "pending";
    }

    if (op.error) {
      throw new Error(op.error.message);
    }

    return "done";
  } catch (error) {
    if (isBadRequestError(error)) {
      const message = extractResponseMessage(error);
      if (message?.includes("already exists")) {
        const existingAssignment = await findAssignment(google, targetOrgUnit);
        if (existingAssignment) {
          log(LogLevel.Info, `Replacing existing ${label} assignment`, {
            targetOrgUnit: existingAssignment.targetOrgUnit,
            ssoMode: existingAssignment.ssoMode,
          });
          await deleteAssignment(google, existingAssignment, log);
          return applySsoAssignment(
            google,
            log,
            targetOrgUnit,
            assignment,
            label
          );
        }
      }
    }
    if (isHttpError(error, 503)) {
      log(LogLevel.Info, `${label} assignment service unavailable`, {
        error,
      });
      return "pending";
    }
    throw error;
  }
}

function extractResponseMessage(error: unknown): string | undefined {
  if (!(error instanceof Error && "responseBody" in error)) {
    return undefined;
  }
  const responseBody = (error as { responseBody?: unknown }).responseBody;
  if (!responseBody || typeof responseBody !== "object") {
    return undefined;
  }
  if (!("error" in responseBody)) {
    return undefined;
  }
  const errorBody = responseBody.error;
  if (!errorBody || typeof errorBody !== "object") {
    return undefined;
  }
  if (!("message" in errorBody)) {
    return undefined;
  }
  return typeof errorBody.message === "string" ? errorBody.message : undefined;
}

async function findAssignment(
  google: GoogleClient,
  targetOrgUnit: string
): Promise<SsoAssignment | undefined> {
  const { inboundSsoAssignments = [] } = (await google.ssoAssignments
    .list()
    .get()) as { inboundSsoAssignments?: SsoAssignment[] };
  return inboundSsoAssignments.find((item) => {
    const existingTarget = item.targetOrgUnit
      ? `orgUnits/${normalizeOrgUnitId(
          extractResourceId(item.targetOrgUnit, ResourceTypes.OrgUnits)
        )}`
      : undefined;
    return existingTarget === targetOrgUnit;
  });
}

function handleAssignmentFailure(
  error: unknown,
  log: StepLogger,
  markFailed: (message: string) => void,
  output: (vars: Partial<WorkflowVars>) => void
) {
  if (isConflictError(error)) {
    output({});
    return;
  }
  if (isHttpError(error, 412)) {
    log(LogLevel.Info, "Assignment already exists", { error });
    output({});
    return;
  }
  if (isNotFoundError(error)) {
    log(LogLevel.Error, "SAML profile not found", { error });
    markFailed("SAML profile missing. Run 'Complete Google SSO setup' first.");
    return;
  }
  if (isBadRequestError(error)) {
    log(LogLevel.Error, "Invalid SSO profile", { error });
    markFailed(
      "SSO profile incomplete or missing. Run 'Complete Google SSO setup' first."
    );
    return;
  }
  log(LogLevel.Error, "Failed to assign users to SSO", { error });
  markFailed(error instanceof Error ? error.message : "Execute failed");
}

export default defineStep(StepId.AssignUsersToSso)
  .requires(
    Var.GoogleAccessToken,
    Var.SamlProfileId,
    Var.IsDomainVerified,
    Var.AutomationOuPath
  )
  .provides()

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
        const profileId = vars.require(Var.SamlProfileId);
        const automationOuPath = vars.require(Var.AutomationOuPath);

        const { inboundSsoAssignments = [] } = (await google.ssoAssignments
          .list()
          .get()) as { inboundSsoAssignments?: SsoAssignment[] };

        const rootId = await getRootOrgUnitId(google);
        const rootTarget = `orgUnits/${normalizeOrgUnitId(rootId)}`;
        const automationTarget = await getOrgUnitResourceName(
          google,
          automationOuPath
        );

        const rootAssigned = inboundSsoAssignments.some((assignment) => {
          const targetOrgUnit = assignment.targetOrgUnit
            ? `orgUnits/${normalizeOrgUnitId(
                extractResourceId(
                  assignment.targetOrgUnit,
                  ResourceTypes.OrgUnits
                )
              )}`
            : undefined;
          return (
            targetOrgUnit === rootTarget &&
            assignment.samlSsoInfo?.inboundSamlSsoProfile === profileId &&
            assignment.ssoMode === "SAML_SSO"
          );
        });

        const automationExcluded = inboundSsoAssignments.some((assignment) => {
          const targetOrgUnit = assignment.targetOrgUnit
            ? `orgUnits/${normalizeOrgUnitId(
                extractResourceId(
                  assignment.targetOrgUnit,
                  ResourceTypes.OrgUnits
                )
              )}`
            : undefined;
          return (
            targetOrgUnit === automationTarget &&
            assignment.ssoMode === "SSO_OFF"
          );
        });

        if (rootAssigned && automationExcluded) {
          log(LogLevel.Info, "All users already assigned to SSO");
          markComplete({});
        } else {
          log(LogLevel.Info, "Users not assigned to SSO");
          markIncomplete("Users not assigned to SSO", {});
        }
      } catch (error) {
        log(LogLevel.Error, "Failed to check SSO assignment", { error });
        markCheckFailed(
          error instanceof Error ? error.message : "Check failed"
        );
      }
    }
  )
  .execute(async ({ vars, google, output, markFailed, markPending, log }) => {
    try {
      const profileId = vars.require(Var.SamlProfileId);
      const automationOuPath = vars.require(Var.AutomationOuPath);

      await assertSamlProfileReady(google, profileId);

      const rootId = await getRootOrgUnitId(google);
      const rootTarget = `orgUnits/${normalizeOrgUnitId(rootId)}`;
      const automationTarget = await getOrgUnitResourceName(
        google,
        automationOuPath
      );

      const rootAssignment = await applySsoAssignment(
        google,
        log,
        rootTarget,
        {
          samlSsoInfo: { inboundSamlSsoProfile: profileId },
          ssoMode: "SAML_SSO",
        },
        "root org unit"
      );
      if (rootAssignment === "pending") {
        markPending("User assignment operation in progress");
        return;
      }

      const automationAssignment = await applySsoAssignment(
        google,
        log,
        automationTarget,
        { ssoMode: "SSO_OFF" },
        "automation org unit"
      );
      if (automationAssignment === "pending") {
        markPending("Automation OU exclusion in progress");
        return;
      }

      output({});
    } catch (error) {
      handleAssignmentFailure(error, log, markFailed, output);
    }
  })
  .undo(async ({ vars, google, markReverted, markFailed, log }) => {
    try {
      const profileId = vars.require(Var.SamlProfileId);
      const { inboundSsoAssignments = [] } = (await google.ssoAssignments
        .list()
        .get()) as { inboundSsoAssignments?: SsoAssignment[] };

      const automationOuPath = vars.require(Var.AutomationOuPath);

      const rootId = await getRootOrgUnitId(google);
      const rootTarget = `orgUnits/${normalizeOrgUnitId(rootId)}`;
      const automationTarget = await getOrgUnitResourceName(
        google,
        automationOuPath
      );
      const rootAssignment = inboundSsoAssignments.find((assignment) => {
        const targetOrgUnit = assignment.targetOrgUnit
          ? `orgUnits/${normalizeOrgUnitId(
              extractResourceId(
                assignment.targetOrgUnit,
                ResourceTypes.OrgUnits
              )
            )}`
          : undefined;
        return (
          targetOrgUnit === rootTarget &&
          assignment.samlSsoInfo?.inboundSamlSsoProfile === profileId &&
          assignment.ssoMode === "SAML_SSO"
        );
      });

      if (rootAssignment) {
        await deleteAssignment(google, rootAssignment, log);
      }

      const automationAssignment = inboundSsoAssignments.find((assignment) => {
        const targetOrgUnit = assignment.targetOrgUnit
          ? `orgUnits/${normalizeOrgUnitId(
              extractResourceId(
                assignment.targetOrgUnit,
                ResourceTypes.OrgUnits
              )
            )}`
          : undefined;
        return (
          targetOrgUnit === automationTarget && assignment.ssoMode === "SSO_OFF"
        );
      });

      if (automationAssignment) {
        await deleteAssignment(google, automationAssignment, log);
      }

      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete SSO assignment", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
