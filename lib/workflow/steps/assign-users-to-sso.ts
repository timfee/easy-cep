import {
  isBadRequestError,
  isConflictError,
  isHttpError,
  isNotFoundError,
} from "@/lib/workflow/core/errors";
import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";
import { StepId } from "@/lib/workflow/step-ids";
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
      const responseBody =
        error instanceof Error && "responseBody" in error
          ? (error as { responseBody?: unknown }).responseBody
          : undefined;
      const responseMessage =
        responseBody &&
        typeof responseBody === "object" &&
        responseBody !== null &&
        "error" in responseBody &&
        typeof responseBody.error === "object" &&
        responseBody.error !== null &&
        "message" in responseBody.error
          ? (responseBody.error as { message?: string }).message
          : undefined;
      if (responseMessage?.includes("already exists")) {
        const { inboundSsoAssignments = [] } = (await google.ssoAssignments
          .list()
          .get()) as { inboundSsoAssignments?: SsoAssignment[] };
        const existingAssignment = inboundSsoAssignments.find((item) => {
          const existingTarget = item.targetOrgUnit
            ? `orgUnits/${normalizeOrgUnitId(
                extractResourceId(item.targetOrgUnit, ResourceTypes.OrgUnits)
              )}`
            : undefined;
          return existingTarget === targetOrgUnit;
        });
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
    throw error;
  }
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
            targetOrgUnit === automationTarget && assignment.ssoMode === "SSO_OFF"
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
      if (isConflictError(error)) {
        output({});
      } else if (isHttpError(error, 412)) {
        log(LogLevel.Info, "Assignment already exists", { error });
        output({});
      } else if (isNotFoundError(error)) {
        log(LogLevel.Error, "SAML profile not found", { error });
        markFailed(
          "SAML profile missing. Run 'Complete Google SSO setup' first."
        );
      } else if (isBadRequestError(error)) {
        log(LogLevel.Error, "Invalid SSO profile", { error });
        markFailed(
          "SSO profile incomplete or missing. Run 'Complete Google SSO setup' first."
        );
      } else {
        log(LogLevel.Error, "Failed to assign users to SSO", { error });
        markFailed(error instanceof Error ? error.message : "Execute failed");
      }
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
      const rootTarget = `orgUnits/${rootId}`.replace("orgUnits/id:", "orgUnits/");
      const automationTarget = (await getOrgUnitResourceName(
        google,
        automationOuPath
      )).replace("orgUnits/id:", "orgUnits/");
      const rootAssignment = inboundSsoAssignments.find(
        (item) =>
          item.targetOrgUnit === rootTarget &&
          item.samlSsoInfo?.inboundSamlSsoProfile === profileId &&
          item.ssoMode === "SAML_SSO"
      );

      if (rootAssignment) {
        const id = extractResourceId(
          rootAssignment.name,
          ResourceTypes.InboundSsoAssignments
        );
        try {
          await google.ssoAssignments.delete(id).delete();
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
          log(
            LogLevel.Info,
            "Inbound SSO Assignment already deleted or not found"
          );
        }
      }

      const automationAssignment = inboundSsoAssignments.find(
        (item) =>
          item.targetOrgUnit === automationTarget && item.ssoMode === "SSO_OFF"
      );

      if (automationAssignment) {
        const id = extractResourceId(
          automationAssignment.name,
          ResourceTypes.InboundSsoAssignments
        );
        try {
          await google.ssoAssignments.delete(id).delete();
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
          log(
            LogLevel.Info,
            "Inbound SSO Assignment already deleted or not found"
          );
        }
      }

      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete SSO assignment", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
