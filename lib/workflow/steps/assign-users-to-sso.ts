import {
  isBadRequestError,
  isConflictError,
  isNotFoundError
} from "@/lib/workflow/core/errors";

import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";

import { LogLevel, StepId, Var } from "@/types";
import { defineStep } from "../step-builder";
import type { GoogleClient } from "../types/http-client";

async function getRootOrgUnitId(google: GoogleClient) {
  const { organizationUnits = [] } = await google.orgUnits
    .list()
    .query({ orgUnitPath: "/", type: "allIncludingParent" })
    .get();

  if (organizationUnits.length === 0) {
    throw new Error("No organizational units found");
  }

  const rootOU = organizationUnits.find(
    (ou) =>
      !ou.parentOrgUnitId
      || ou.orgUnitPath === "/"
      || ou.orgUnitId === ou.parentOrgUnitId
  );

  if (rootOU) {
    return extractResourceId(rootOU.orgUnitId, ResourceTypes.OrgUnitId);
  }

  // If no obvious root found, look for OUs without valid parents
  const orphanOU = organizationUnits.find((ou) => {
    if (!ou.parentOrgUnitId) return true;
    const parentExists = organizationUnits.some(
      (parent) => parent.orgUnitId === ou.parentOrgUnitId
    );
    return !parentExists;
  });

  if (orphanOU) {
    return extractResourceId(orphanOU.orgUnitId, ResourceTypes.OrgUnitId);
  }

  throw new Error(
    "Cannot determine root organizational unit from available data"
  );
}

export default defineStep(StepId.AssignUsersToSso)
  .requires(
    Var.GoogleAccessToken,
    Var.SamlProfileId,
    Var.IsDomainVerified,
    Var.AutomationOuPath
  )
  .provides()

  /**
   * GET https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
   * Headers: { Authorization: Bearer {googleAccessToken} }
   *
   * Success response (200)
   * {
   *   "inboundSsoAssignments": [
   *     { "name": "assignment/1", "ssoMode": "SAML_SSO" },
   *     { "name": "assignment/2", "ssoMode": "OFF" }
   *   ]
   * }
   *
   * Success response (200) – empty
   * { "inboundSsoAssignments": [] }
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
        const profileId = vars.require(Var.SamlProfileId);
        const automationOuPath = vars.require(Var.AutomationOuPath);

        const { inboundSsoAssignments = [] } = await google.ssoAssignments
          .list()
          .get();
        // Extract: assignmentExists = inboundSsoAssignments.some(...)

        const rootId = await getRootOrgUnitId(google);
        const rootAssigned = inboundSsoAssignments.some(
          (assignment) =>
            assignment.targetOrgUnit === `orgUnits/${rootId}`
            && assignment.samlSsoInfo?.inboundSamlSsoProfile === profileId
            && assignment.ssoMode === "SAML_SSO"
        );

        const automationExcluded = inboundSsoAssignments.some(
          (assignment) =>
            assignment.targetOrgUnit === automationOuPath
            && assignment.ssoMode === "SSO_OFF"
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
    /**
     * POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
     * {
     *   "targetGroup": "groups/allUsers",
     *   "samlSsoInfo": { "inboundSamlSsoProfile": "{samlProfileId}" },
     *   "ssoMode": "SAML_SSO"
     * }
     *
     * Success response
     *
     * 200
     * {}
     *
     * Error response
     *
     * 409
     * { "error": { "message": "Assignment already exists" } }
     */
    try {
      const profileId = vars.require(Var.SamlProfileId);
      const automationOuPath = vars.require(Var.AutomationOuPath);

      /**
       * POST https://cloudidentity.googleapis.com/v1/inboundSsoAssignments
       * Headers: { Authorization: Bearer {googleAccessToken} }
       * Body:
       * {
       *   "targetGroup": "groups/allUsers",
       *   "samlSsoInfo": { "inboundSamlSsoProfile": "{profileId}" },
       *   "ssoMode": "SAML_SSO"
       * }
       *
       * Success response (200)
       * { "done": true }
       *
       * Error response (409)
       * { "error": { "code": 409, "message": "Assignment exists" } }
       */
      const rootId = await getRootOrgUnitId(google);
      const op = await google.ssoAssignments
        .create()
        .post({
          targetOrgUnit: `orgUnits/${rootId}`,
          samlSsoInfo: { inboundSamlSsoProfile: profileId },
          ssoMode: "SAML_SSO"
        });
      if (!op.done) {
        markPending("User assignment operation in progress");
        return;
      }

      if (op.error) {
        log(LogLevel.Error, "Assignment failed", { error: op.error });
        markFailed(op.error.message);
        return;
      }

      // Exclude automation OU from SSO
      await google.ssoAssignments
        .create()
        .post({ targetOrgUnit: automationOuPath, ssoMode: "SSO_OFF" });

      output({});
    } catch (error) {
      // isConflictError handles: 409
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
      const profileId = vars.get(Var.SamlProfileId);
      if (!profileId) {
        markFailed("Missing samlProfileId");
        return;
      }
      const { inboundSsoAssignments = [] } = await google.ssoAssignments
        .list()
        .get();
      // Extract: assignmentName = inboundSsoAssignments.find(...).name

      const automationOuPath = vars.require(Var.AutomationOuPath);

      const rootId = await getRootOrgUnitId(google);
      const rootAssignment = inboundSsoAssignments.find(
        (item) =>
          item.targetOrgUnit === `orgUnits/${rootId}`
          && item.samlSsoInfo?.inboundSamlSsoProfile === profileId
          && item.ssoMode === "SAML_SSO"
      );

      if (rootAssignment) {
        const id = extractResourceId(
          rootAssignment.name,
          ResourceTypes.InboundSsoAssignments
        );
        try {
          await google.ssoAssignments.delete(id).delete();
        } catch (error) {
          if (isNotFoundError(error)) {
            log(
              LogLevel.Info,
              "Inbound SSO Assignment already deleted or not found"
            );
          } else {
            throw error;
          }
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
          if (isNotFoundError(error)) {
            log(
              LogLevel.Info,
              "Inbound SSO Assignment already deleted or not found"
            );
          } else {
            throw error;
          }
        }
      }

      markReverted();
    } catch (error) {
      log(LogLevel.Error, "Failed to delete SSO assignment", { error });
      markFailed(error instanceof Error ? error.message : "Undo failed");
    }
  })
  .build();
