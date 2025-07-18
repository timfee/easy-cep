import type { StepIdValue } from "./step-ids";
import { StepId } from "./step-ids";

export interface VariableMetadata {
  type: "string" | "boolean";
  category: "auth" | "domain" | "config" | "state";
  description?: string;
  producedBy?: StepIdValue;
  consumedBy?: StepIdValue[];
  configurable?: boolean;
  sensitive?: boolean;
}

export const WORKFLOW_VARIABLES: Record<string, VariableMetadata> = {
  googleAccessToken: {
    type: "string",
    category: "auth",
    description: "Google OAuth access token",
    sensitive: true,
    consumedBy: [
      StepId.VerifyPrimaryDomain,
      StepId.CreateAutomationOU,
      StepId.CreateServiceUser,
      StepId.CreateAdminRoleAndAssignUser,
      StepId.ConfigureGoogleSamlProfile,
      StepId.CompleteGoogleSsoSetup,
      StepId.AssignUsersToSso
    ]
  },
  msGraphToken: {
    type: "string",
    category: "auth",
    description: "Microsoft Graph access token",
    sensitive: true,
    consumedBy: [
      StepId.CreateMicrosoftApps,
      StepId.SetupMicrosoftProvisioning,
      StepId.ConfigureMicrosoftSso,
      StepId.SetupMicrosoftClaimsPolicy
    ]
  },
  primaryDomain: {
    type: "string",
    category: "domain",
    description: "Primary Google Workspace domain",
    producedBy: StepId.VerifyPrimaryDomain,
    consumedBy: [StepId.CreateServiceUser]
  },
  isDomainVerified: {
    type: "string",
    category: "domain",
    description: "Whether domain is verified",
    producedBy: StepId.VerifyPrimaryDomain,
    consumedBy: [
      StepId.CreateAutomationOU,
      StepId.CreateServiceUser,
      StepId.CreateAdminRoleAndAssignUser,
      StepId.ConfigureGoogleSamlProfile,
      StepId.AssignUsersToSso
    ]
  },
  verificationToken: {
    type: "string",
    category: "domain",
    description: "DNS verification token",
    producedBy: StepId.VerifyPrimaryDomain
  },
  automationOuName: {
    type: "string",
    category: "config",
    description: "Name for the automation OU",
    consumedBy: [StepId.CreateAutomationOU],
    configurable: true
  },
  automationOuPath: {
    type: "string",
    category: "config",
    description: "Path of the automation OU",
    consumedBy: [StepId.CreateAutomationOU, StepId.CreateServiceUser],
    configurable: true
  },
  provisioningUserPrefix: {
    type: "string",
    category: "config",
    description: "Prefix for provisioning user email",
    consumedBy: [StepId.CreateServiceUser],
    configurable: true
  },
  adminRoleName: {
    type: "string",
    category: "config",
    description: "Name of the custom admin role",
    consumedBy: [StepId.CreateAdminRoleAndAssignUser],
    configurable: true
  },
  samlProfileDisplayName: {
    type: "string",
    category: "config",
    description: "Display name for SAML profile",
    consumedBy: [StepId.ConfigureGoogleSamlProfile],
    configurable: true
  },
  provisioningAppDisplayName: {
    type: "string",
    category: "config",
    description: "Display name for provisioning app",
    consumedBy: [StepId.CreateMicrosoftApps],
    configurable: true
  },
  ssoAppDisplayName: {
    type: "string",
    category: "config",
    description: "Display name for SSO app",
    consumedBy: [StepId.CreateMicrosoftApps],
    configurable: true
  },
  claimsPolicyDisplayName: {
    type: "string",
    category: "config",
    description: "Display name for claims policy",
    consumedBy: [StepId.SetupMicrosoftClaimsPolicy],
    configurable: true
  },
  provisioningUserId: {
    type: "string",
    category: "state",
    description: "Google user ID for provisioning account",
    producedBy: StepId.CreateServiceUser,
    consumedBy: [StepId.CreateAdminRoleAndAssignUser]
  },
  provisioningUserEmail: {
    type: "string",
    category: "state",
    description: "Email for provisioning account",
    producedBy: StepId.CreateServiceUser
  },
  generatedPassword: {
    type: "string",
    category: "state",
    description: "Password for provisioning account",
    producedBy: StepId.CreateServiceUser,
    consumedBy: [StepId.SetupMicrosoftProvisioning],
    sensitive: true
  },
  adminRoleId: {
    type: "string",
    category: "state",
    description: "Custom admin role ID",
    producedBy: StepId.CreateAdminRoleAndAssignUser
  },
  directoryServiceId: {
    type: "string",
    category: "state",
    description: "Directory service ID",
    producedBy: StepId.CreateAdminRoleAndAssignUser
  },
  ssoServicePrincipalId: {
    type: "string",
    category: "state",
    description: "Service principal for SSO app",
    producedBy: StepId.CreateMicrosoftApps,
    consumedBy: [
      StepId.ConfigureMicrosoftSso,
      StepId.SetupMicrosoftClaimsPolicy
    ]
  },
  provisioningServicePrincipalId: {
    type: "string",
    category: "state",
    description: "Service principal for provisioning app",
    producedBy: StepId.CreateMicrosoftApps,
    consumedBy: [StepId.SetupMicrosoftProvisioning]
  },
  ssoAppId: {
    type: "string",
    category: "state",
    description: "Application ID for SSO app",
    producedBy: StepId.CreateMicrosoftApps,
    consumedBy: [StepId.ConfigureMicrosoftSso]
  },
  samlProfileId: {
    type: "string",
    category: "state",
    description: "SAML profile identifier",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    consumedBy: [StepId.CompleteGoogleSsoSetup, StepId.AssignUsersToSso]
  },
  entityId: {
    type: "string",
    category: "state",
    description: "Service provider entityId",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    consumedBy: [StepId.ConfigureMicrosoftSso]
  },
  acsUrl: {
    type: "string",
    category: "state",
    description: "Assertion consumer service URL",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    consumedBy: [StepId.ConfigureMicrosoftSso]
  },
  claimsPolicyId: {
    type: "string",
    category: "state",
    description: "Claims policy identifier",
    producedBy: StepId.SetupMicrosoftClaimsPolicy
  },
  msSigningCertificate: {
    type: "string",
    category: "state",
    description: "Microsoft SAML signing certificate in PEM format",
    producedBy: StepId.ConfigureMicrosoftSso,
    consumedBy: [StepId.CompleteGoogleSsoSetup],
    sensitive: true
  },
  msSsoLoginUrl: {
    type: "string",
    category: "state",
    description: "Microsoft SAML SSO login URL",
    producedBy: StepId.ConfigureMicrosoftSso,
    consumedBy: [StepId.CompleteGoogleSsoSetup]
  },
  msSsoEntityId: {
    type: "string",
    category: "state",
    description: "Microsoft SAML entity ID",
    producedBy: StepId.ConfigureMicrosoftSso,
    consumedBy: [StepId.CompleteGoogleSsoSetup]
  }
} as const satisfies Record<string, VariableMetadata>;

// Auto-generate Var enum with PascalCase keys
function toPascalCase<S extends string>(str: S): Capitalize<S> {
  return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<S>;
}

export const Var = (
  Object.keys(WORKFLOW_VARIABLES) as Array<keyof typeof WORKFLOW_VARIABLES>
).reduce(
  (acc, key) => ({ ...acc, [toPascalCase(key)]: key }),
  {} as { [K in keyof typeof WORKFLOW_VARIABLES as Capitalize<K>]: K }
);

export type WorkflowVars = {
  [K in keyof typeof WORKFLOW_VARIABLES]: string | undefined;
};

// Export useful types
export type VarName = keyof typeof WORKFLOW_VARIABLES;
