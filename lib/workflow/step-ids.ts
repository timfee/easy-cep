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
  VerifyPrimaryDomain: "verify-primary-domain",
  CreateAutomationOU: "create-automation-ou",
  CreateServiceUser: "create-service-user",
  CreateAdminRoleAndAssignUser: "create-admin-role-and-assign-user",
  ConfigureGoogleSamlProfile: "configure-google-saml-profile",
  CreateMicrosoftApps: "create-microsoft-apps",
  SetupMicrosoftProvisioning: "setup-microsoft-provisioning",
  ConfigureMicrosoftSso: "configure-microsoft-sso",
  SetupMicrosoftClaimsPolicy: "setup-microsoft-claims-policy",
  CompleteGoogleSsoSetup: "complete-google-sso-setup",
  AssignUsersToSso: "assign-users-to-sso",
};

export const STEP_ID_VALUES: ReadonlySet<string> = new Set(
  Object.values(StepId)
);

export function isStepIdValue(value: string): value is StepIdValue {
  return STEP_ID_VALUES.has(value);
}
