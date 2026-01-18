import type { StepIdValue } from "@/lib/workflow/step-ids";
import assignUsersToSso from "./steps/assign-users-to-sso";
import completeGoogleSsoSetup from "./steps/complete-google-sso-setup";
import configureGoogleSamlProfile from "./steps/configure-google-saml-profile";
import configureMicrosoftSso from "./steps/configure-microsoft-sso";
import createAdminRoleAndAssignUser from "./steps/create-admin-role-and-assign-user";
import createAutomationOu from "./steps/create-automation-ou";
import createMicrosoftApps from "./steps/create-microsoft-apps";
import createServiceUser from "./steps/create-service-user";
import setupMicrosoftClaimsPolicy from "./steps/setup-microsoft-claims-policy";
import setupMicrosoftProvisioning from "./steps/setup-microsoft-provisioning";
import verifyPrimaryDomain from "./steps/verify-primary-domain";

const allSteps = [
  verifyPrimaryDomain,
  createAutomationOu,
  createServiceUser,
  createAdminRoleAndAssignUser,
  configureGoogleSamlProfile,
  createMicrosoftApps,
  setupMicrosoftProvisioning,
  configureMicrosoftSso,
  setupMicrosoftClaimsPolicy,
  completeGoogleSsoSetup,
  assignUsersToSso,
];

export function getAllSteps() {
  return allSteps;
}

export function getStep<T extends StepIdValue>(
  id: T
): Extract<(typeof allSteps)[number], { id: T }> {
  const match = allSteps.find(
    (step): step is Extract<(typeof allSteps)[number], { id: T }> =>
      step.id === id
  );
  if (!match) {
    throw new Error(`Step "${id}" not found in registry`);
  }
  return match;
}
