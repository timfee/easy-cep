/**
 * Step identifiers for the workflow.
 * The values are kebab-case for consistency.
 */
export type StepIdValue =
  | "verify-primary-domain"
  | "create-automation-ou"
  | "create-service-user"
  | "create-admin-role-and-assign-user"
  | "configure-google-saml-profile"
  | "create-microsoft-apps"
  | "setup-microsoft-provisioning"
  | "configure-microsoft-sso"
  | "setup-microsoft-claims-policy"
  | "complete-google-sso-setup"
  | "assign-users-to-sso";

/**
 * PascalCase lookup map for step identifiers.
 */
export const StepId: Record<
  | "VerifyPrimaryDomain"
  | "CreateAutomationOU"
  | "CreateServiceUser"
  | "CreateAdminRoleAndAssignUser"
  | "ConfigureGoogleSamlProfile"
  | "CreateMicrosoftApps"
  | "SetupMicrosoftProvisioning"
  | "ConfigureMicrosoftSso"
  | "SetupMicrosoftClaimsPolicy"
  | "CompleteGoogleSsoSetup"
  | "AssignUsersToSso",
  StepIdValue
> = {
  AssignUsersToSso: "assign-users-to-sso",
  CompleteGoogleSsoSetup: "complete-google-sso-setup",
  ConfigureGoogleSamlProfile: "configure-google-saml-profile",
  ConfigureMicrosoftSso: "configure-microsoft-sso",
  CreateAdminRoleAndAssignUser: "create-admin-role-and-assign-user",
  CreateAutomationOU: "create-automation-ou",
  CreateMicrosoftApps: "create-microsoft-apps",
  CreateServiceUser: "create-service-user",
  SetupMicrosoftClaimsPolicy: "setup-microsoft-claims-policy",
  SetupMicrosoftProvisioning: "setup-microsoft-provisioning",
  VerifyPrimaryDomain: "verify-primary-domain",
};

export const STEP_ID_VALUES: ReadonlySet<string> = new Set(
  Object.values(StepId)
);

export function isStepIdValue(value: string): value is StepIdValue {
  return STEP_ID_VALUES.has(value);
}
