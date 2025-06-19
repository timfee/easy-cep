/**
 * Single source of truth for all workflow variables.
 * To add a new variable, just add it here.
 */
export const WORKFLOW_VARIABLES = {
  // Tokens
  googleAccessToken: "string",
  msGraphToken: "string",

  // Domain
  primaryDomain: "string",
  isDomainVerified: "boolean",
  verificationToken: "string",

  // Configuration variables
  automationOuName: "string",
  automationOuPath: "string",
  provisioningUserPrefix: "string",
  adminRoleName: "string",
  samlProfileDisplayName: "string",
  provisioningAppDisplayName: "string",
  ssoAppDisplayName: "string",
  claimsPolicyDisplayName: "string",

  // Service account
  provisioningUserId: "string",
  provisioningUserEmail: "string",
  provisioningUserPrefix: "string",
  generatedPassword: "string",

  // Roles
  adminRoleId: "string",
  directoryServiceId: "string",

  // Microsoft apps
  ssoServicePrincipalId: "string",
  provisioningServicePrincipalId: "string",
  ssoAppId: "string",

  // SAML
  samlProfileId: "string",
  entityId: "string",
  acsUrl: "string",

  // Policy
  claimsPolicyId: "string"
} as const;

export const WORKFLOW_VAR_GROUPS = [
  { title: "Tokens", vars: ["googleAccessToken", "msGraphToken"] },
  {
    title: "Domain",
    vars: ["primaryDomain", "isDomainVerified", "verificationToken"]
  },
  {
    title: "Configuration",
    vars: [
      "automationOuName",
      "automationOuPath",
      "provisioningUserPrefix",
      "adminRoleName",
      "samlProfileDisplayName",
      "provisioningAppDisplayName",
      "ssoAppDisplayName",
      "claimsPolicyDisplayName"
    ]
  },
  {
    title: "Service Account",
    vars: [
      "provisioningUserId",
      "provisioningUserEmail",
      "provisioningUserPrefix",
      "generatedPassword"
    ]
  },
  { title: "Roles", vars: ["adminRoleId", "directoryServiceId"] },
  {
    title: "Microsoft Apps",
    vars: [
      "ssoServicePrincipalId",
      "provisioningServicePrincipalId",
      "ssoAppId"
    ]
  },
  { title: "SAML", vars: ["samlProfileId", "entityId", "acsUrl"] },
  { title: "Policy", vars: ["claimsPolicyId"] }
] as const;

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

// Auto-generate WorkflowVars type
export type WorkflowVars = {
  [K in keyof typeof WORKFLOW_VARIABLES]: (typeof WORKFLOW_VARIABLES)[K] extends (
    "string"
  ) ?
    string
  : boolean;
};

// Export useful types
export type VarName = keyof typeof WORKFLOW_VARIABLES;
