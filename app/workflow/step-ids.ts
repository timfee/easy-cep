/**
 * Step identifiers for the workflow.
 * The values are kebab-case for consistency.
 */
export const StepId = {
  VerifyPrimaryDomain: "verify-primary-domain",
  CreateAutomationOU: "create-automation-ou",
  CreateServiceUser: "create-service-user",
  CreateRoleAndAssignUser: "create-role-and-assign-user",
  ConfigureGoogleSamlProfile: "configure-google-saml-profile",
  CreateMicrosoftApps: "create-microsoft-apps",
  ConfigureMicrosoftSyncAndSso: "configure-microsoft-sync-and-sso",
  SetupMicrosoftClaimsPolicy: "setup-microsoft-claims-policy",
  CompleteGoogleSsoSetup: "complete-google-sso-setup",
  AssignUsersToSso: "assign-users-to-sso",
  TestSsoConfiguration: "test-sso-configuration"
} as const;

export type StepIdValue = (typeof StepId)[keyof typeof StepId];
