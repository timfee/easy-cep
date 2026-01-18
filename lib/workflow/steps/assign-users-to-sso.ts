import {
  isBadRequestError,
  isConflictError,
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
        const rootAssigned = inboundSsoAssignments.some(
          (assignment) =>
            assignment.targetOrgUnit === `orgUnits/${rootId}` &&
            assignment.samlSsoInfo?.inboundSamlSsoProfile === profileId &&
            assignment.ssoMode === "SAML_SSO"
        );

        const automationExcluded = inboundSsoAssignments.some(
          (assignment) =>
            assignment.targetOrgUnit === automationOuPath &&
            assignment.ssoMode === "SSO_OFF"
        );

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

      const rootId = await getRootOrgUnitId(google);
      const op = (await google.ssoAssignments.create().post({
        targetOrgUnit: `orgUnits/${rootId}`,
        samlSsoInfo: { inboundSamlSsoProfile: profileId },
        ssoMode: "SAML_SSO",
      })) as GoogleOperation;
      if (!op.done) {
        markPending("User assignment operation in progress");
        return;
      }

      if (op.error) {
        log(LogLevel.Error, "Assignment failed", { error: op.error });
        markFailed(op.error.message);
        return;
      }

      await google.ssoAssignments
        .create()
        .post({ targetOrgUnit: automationOuPath, ssoMode: "SSO_OFF" });

      output({});
    } catch (error) {
      if (isConflictError(error)) {
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
      const rootAssignment = inboundSsoAssignments.find(
        (item) =>
          item.targetOrgUnit === `orgUnits/${rootId}` &&
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
          item.targetOrgUnit === automationOuPath && item.ssoMode === "SSO_OFF"
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
