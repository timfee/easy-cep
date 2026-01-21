import type { StepIdValue } from "./step-ids";

import { StepId } from "./step-ids";

/**
 * Metadata describing a workflow variable.
 */
export interface VariableMetadata {
  type: "string" | "boolean";
  category: "auth" | "domain" | "config" | "state";
  description?: string;
  producedBy?: StepIdValue;
  consumedBy?: StepIdValue[];
  configurable?: boolean;
  sensitive?: boolean;
}

/**
 * Registry of workflow variables and their metadata.
 */
export const WORKFLOW_VARIABLES: Record<string, VariableMetadata> = {
  acsUrl: {
    category: "state",
    consumedBy: [StepId.ConfigureMicrosoftSso],
    description: "Assertion consumer service URL",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    type: "string",
  },
  adminRoleId: {
    category: "state",
    description: "Custom admin role ID",
    producedBy: StepId.CreateAdminRoleAndAssignUser,
    type: "string",
  },
  adminRoleName: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.CreateAdminRoleAndAssignUser],
    description: "Name of the custom admin role",
    type: "string",
  },
  automationOuName: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.CreateAutomationOU],
    description: "Name for the automation OU",
    type: "string",
  },
  automationOuPath: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.CreateAutomationOU, StepId.CreateServiceUser],
    description: "Path of the automation OU",
    type: "string",
  },
  claimsPolicyDisplayName: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.SetupMicrosoftClaimsPolicy],
    description: "Display name for claims policy",
    type: "string",
  },
  claimsPolicyId: {
    category: "state",
    description: "Claims policy identifier",
    producedBy: StepId.SetupMicrosoftClaimsPolicy,
    type: "string",
  },
  directoryServiceId: {
    category: "state",
    description: "Directory service ID",
    producedBy: StepId.CreateAdminRoleAndAssignUser,
    type: "string",
  },
  entityId: {
    category: "state",
    consumedBy: [StepId.ConfigureMicrosoftSso],
    description: "Service provider entityId",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    type: "string",
  },
  generatedPassword: {
    category: "state",
    configurable: true,
    consumedBy: [StepId.SetupMicrosoftProvisioning],
    description: "Password for provisioning account",
    producedBy: StepId.CreateServiceUser,
    type: "string",
  },
  googleAccessToken: {
    category: "auth",
    consumedBy: [
      StepId.VerifyPrimaryDomain,
      StepId.CreateAutomationOU,
      StepId.CreateServiceUser,
      StepId.CreateAdminRoleAndAssignUser,
      StepId.ConfigureGoogleSamlProfile,
      StepId.CompleteGoogleSsoSetup,
      StepId.AssignUsersToSso,
    ],
    description: "Google OAuth access token",
    sensitive: true,
    type: "string",
  },
  isDomainVerified: {
    category: "domain",
    consumedBy: [
      StepId.CreateAutomationOU,
      StepId.CreateServiceUser,
      StepId.CreateAdminRoleAndAssignUser,
      StepId.ConfigureGoogleSamlProfile,
      StepId.AssignUsersToSso,
    ],
    description: "Whether domain is verified",
    producedBy: StepId.VerifyPrimaryDomain,
    type: "string",
  },
  msGraphToken: {
    category: "auth",
    consumedBy: [
      StepId.CreateMicrosoftApps,
      StepId.SetupMicrosoftProvisioning,
      StepId.ConfigureMicrosoftSso,
      StepId.SetupMicrosoftClaimsPolicy,
    ],
    description: "Microsoft Graph access token",
    sensitive: true,
    type: "string",
  },
  msSigningCertificate: {
    category: "state",
    consumedBy: [StepId.CompleteGoogleSsoSetup],
    description: "Microsoft SAML signing certificate in PEM format",
    producedBy: StepId.ConfigureMicrosoftSso,
    sensitive: true,
    type: "string",
  },
  msSsoEntityId: {
    category: "state",
    consumedBy: [StepId.CompleteGoogleSsoSetup],
    description: "Microsoft SAML entity ID",
    producedBy: StepId.ConfigureMicrosoftSso,
    type: "string",
  },
  msSsoLoginUrl: {
    category: "state",
    consumedBy: [StepId.CompleteGoogleSsoSetup],
    description: "Microsoft SAML SSO login URL",
    producedBy: StepId.ConfigureMicrosoftSso,
    type: "string",
  },
  primaryDomain: {
    category: "domain",
    consumedBy: [StepId.CreateServiceUser],
    description: "Primary Google Workspace domain",
    producedBy: StepId.VerifyPrimaryDomain,
    type: "string",
  },
  provisioningAppDisplayName: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.CreateMicrosoftApps],
    description: "Display name for provisioning app",
    type: "string",
  },
  provisioningServicePrincipalId: {
    category: "state",
    consumedBy: [StepId.SetupMicrosoftProvisioning],
    description: "Service principal for provisioning app",
    producedBy: StepId.CreateMicrosoftApps,
    type: "string",
  },
  provisioningUserEmail: {
    category: "state",
    description: "Email for provisioning account",
    producedBy: StepId.CreateServiceUser,
    consumedBy: [StepId.SetupMicrosoftProvisioning],
    type: "string",
  },
  provisioningUserId: {
    category: "state",
    consumedBy: [StepId.CreateAdminRoleAndAssignUser],
    description: "Google user ID for provisioning account",
    producedBy: StepId.CreateServiceUser,
    type: "string",
  },
  provisioningUserPrefix: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.CreateServiceUser],
    description: "Prefix for provisioning user email",
    type: "string",
  },
  samlProfileDisplayName: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.ConfigureGoogleSamlProfile],
    description: "Display name for SAML profile",
    type: "string",
  },
  samlProfileId: {
    category: "state",
    consumedBy: [StepId.CompleteGoogleSsoSetup, StepId.AssignUsersToSso],
    description: "SAML profile identifier",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    type: "string",
  },
  ssoAppDisplayName: {
    category: "config",
    configurable: true,
    consumedBy: [StepId.CreateMicrosoftApps],
    description: "Display name for SSO app",
    type: "string",
  },
  ssoAppId: {
    category: "state",
    consumedBy: [StepId.ConfigureMicrosoftSso],
    description: "Application ID for SSO app",
    producedBy: StepId.CreateMicrosoftApps,
    type: "string",
  },
  ssoServicePrincipalId: {
    category: "state",
    consumedBy: [
      StepId.ConfigureMicrosoftSso,
      StepId.SetupMicrosoftClaimsPolicy,
    ],
    description: "Service principal for SSO app",
    producedBy: StepId.CreateMicrosoftApps,
    type: "string",
  },
  verificationToken: {
    category: "domain",
    description: "DNS verification token",
    producedBy: StepId.VerifyPrimaryDomain,
    type: "string",
  },
};

/**
 * Convert workflow variable keys to PascalCase.
 */
function toPascalCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isVarKey(value: string): value is keyof typeof WORKFLOW_VARIABLES {
  return value in WORKFLOW_VARIABLES;
}

/**
 * Build the PascalCase variable map for UI usage.
 */
function buildVarMap(): Record<string, keyof typeof WORKFLOW_VARIABLES> {
  const result: Record<string, keyof typeof WORKFLOW_VARIABLES> = {};
  for (const key of Object.keys(WORKFLOW_VARIABLES)) {
    if (!isVarKey(key)) {
      continue;
    }
    result[toPascalCase(key)] = key;
  }
  return result;
}

/**
 * PascalCase aliases for workflow variables.
 */
export const Var = buildVarMap();

/**
 * Map workflow variables to their string values.
 */
export type WorkflowVars = {
  [K in keyof typeof WORKFLOW_VARIABLES]: string | undefined;
};

/**
 * Valid workflow variable names.
 */
export type VarName = keyof typeof WORKFLOW_VARIABLES;

export function isAuthVar(varName: VarName): boolean {
  return WORKFLOW_VARIABLES[varName]?.category === "auth";
}

export function getMissingRequiredVars(
  requires: readonly VarName[],
  vars: Partial<WorkflowVars>
): VarName[] {
  return requires.filter(
    (varName) => !isAuthVar(varName) && vars[varName] === undefined
  );
}
