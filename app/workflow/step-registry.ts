/**
 * @file step-registry.ts
 * @description Central, static list of all workflow step modules.  Keeping a
 *              single import site helps with tree-shaking, ensures that each
 *              file is evaluated exactly once, and enables fully typed look-ups
 *              by `StepId`.
 */

import { StepIdValue } from "@/types";
import assignUsersToSso from "./steps/assign-users-to-sso";
import completeGoogleSsoSetup from "./steps/complete-google-sso-setup";
import configureGoogleSamlProfile from "./steps/configure-google-saml-profile";
import configureMicrosoftSyncAndSso from "./steps/configure-microsoft-sync-and-sso";
import createAdminRoleAndAssignUser from "./steps/create-admin-role-and-assign-user";
import createAutomationOu from "./steps/create-automation-ou";
import createMicrosoftApps from "./steps/create-microsoft-apps";
import createRoleAndAssignUser from "./steps/create-role-and-assign-user";
import createServiceUser from "./steps/create-service-user";
import setupMicrosoftClaimsPolicy from "./steps/setup-microsoft-claims-policy";
import testSsoConfiguration from "./steps/test-sso-configuration";
import verifyPrimaryDomain from "./steps/verify-primary-domain";

const allSteps = [
  verifyPrimaryDomain,
  createAutomationOu,
  createServiceUser,
  createAdminRoleAndAssignUser,
  configureGoogleSamlProfile,
  createMicrosoftApps,
  configureMicrosoftSyncAndSso,
  setupMicrosoftClaimsPolicy,
  completeGoogleSsoSetup,
  assignUsersToSso,
  testSsoConfiguration
] as const;

export function getAllSteps() {
  return allSteps;
}

export function getStep<T extends StepIdValue>(
  id: T
): Extract<(typeof allSteps)[number], { id: T }> {
  const match = allSteps.find(
    (s): s is Extract<(typeof allSteps)[number], { id: T }> => s.id === id
  );
  if (!match) throw new Error(`Step "${id}" not found in registry`);
  return match;
}
