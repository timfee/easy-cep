export type StepIdValue = string; // Assuming StepIdValue is a string
export type VarName = string;

// Define StepId enum/const if not already defined elsewhere
// For example:
export const StepId = {
  CreateServiceUser: "create-service-user" as StepIdValue,
  CreateAdminRoleAndAssignUser:
    "create-admin-role-and-assign-user" as StepIdValue,
  ConfigureGoogleSamlProfile: "configure-google-saml-profile" as StepIdValue,
  CompleteGoogleSsoSetup: "complete-google-sso-setup" as StepIdValue,
  AssignUsersToSso: "assign-users-to-sso" as StepIdValue,
  CreateAutomationOU: "create-automation-ou" as StepIdValue,
  CreateMicrosoftApps: "create-microsoft-apps" as StepIdValue,
  SetupMicrosoftClaimsPolicy: "setup-microsoft-claims-policy" as StepIdValue,
  // Add all other step IDs
  AuthGoogle: "auth-google" as StepIdValue,
  FetchCalendar: "fetch-calendar" as StepIdValue,
  AuthMsGraph: "auth-msgraph" as StepIdValue,
  SyncContacts: "sync-contacts" as StepIdValue,
  GenerateReport: "generate-report" as StepIdValue
};

export interface VariableMetadata {
  type: "string" | "boolean" | "number" | "object";
  category:
    | "auth"
    | "domain"
    | "config"
    | "state"
    | "serviceAccount"
    | "roles"
    | "microsoftApps"
    | "saml";
  description?: string;
  producedBy?: StepIdValue;
  consumedBy?: StepIdValue[];
  configurable?: boolean; // Can user edit this?
  sensitive?: boolean;
  defaultValue?: unknown;
}

export const WORKFLOW_VARIABLES: Record<VarName, VariableMetadata> = {
  // Auth tokens
  googleAccessToken: {
    type: "string",
    category: "auth",
    description: "Google OAuth access token",
    producedBy: StepId.AuthGoogle,
    consumedBy: [StepId.FetchCalendar],
    sensitive: true
  },
  userEmail: {
    // Added from ProviderLogin
    type: "string",
    category: "auth",
    description: "Authenticated Google user's email",
    producedBy: StepId.AuthGoogle,
    consumedBy: [StepId.SyncContacts]
  },
  msGraphToken: {
    type: "string",
    category: "auth",
    description: "Microsoft Graph API access token",
    producedBy: StepId.AuthMsGraph,
    consumedBy: [StepId.SyncContacts],
    sensitive: true
  },

  // Configuration
  automationOuName: {
    type: "string",
    category: "config",
    description: "Name for the automation OU",
    consumedBy: [StepId.CreateAutomationOU],
    configurable: true
  },
  primaryDomain: {
    type: "string",
    category: "domain",
    description: "Primary domain for the organization",
    configurable: true
  },
  isDomainVerified: {
    type: "boolean",
    category: "domain",
    description: "Indicates if the primary domain is verified",
    configurable: false // Typically set by a step
  },
  verificationToken: {
    type: "string",
    category: "domain",
    description: "Token for domain verification process",
    configurable: false
  },

  // Shared state
  provisioningUserId: {
    type: "string",
    category: "serviceAccount",
    producedBy: StepId.CreateServiceUser,
    consumedBy: [StepId.CreateAdminRoleAndAssignUser],
    description: "Google user ID for provisioning account"
  },
  samlProfileId: {
    type: "string",
    category: "saml",
    producedBy: StepId.ConfigureGoogleSamlProfile,
    consumedBy: [StepId.CompleteGoogleSsoSetup, StepId.AssignUsersToSso],
    description: "SAML profile identifier"
  },
  ssoServicePrincipalId: {
    type: "string",
    category: "microsoftApps",
    producedBy: StepId.CreateMicrosoftApps,
    consumedBy: [
      StepId.SetupMicrosoftClaimsPolicy,
      StepId.CompleteGoogleSsoSetup
    ],
    description: "Service Principal ID for SSO App in Azure AD"
  },

  // Example variables from previous components
  calendarEvents: {
    type: "object",
    category: "state",
    producedBy: StepId.FetchCalendar,
    consumedBy: [StepId.GenerateReport],
    description: "Fetched calendar events"
  },
  contactsSynced: {
    type: "boolean",
    category: "state",
    producedBy: StepId.SyncContacts,
    consumedBy: [StepId.GenerateReport],
    description: "Status of contact synchronization"
  },
  reportGenerated: {
    type: "boolean",
    category: "state",
    producedBy: StepId.GenerateReport,
    description: "Status of report generation"
  }
};

export const categoryTitles: Record<VariableMetadata["category"], string> = {
  auth: "Tokens",
  domain: "Domain",
  config: "Configuration",
  state: "Runtime State",
  serviceAccount: "Service Account",
  roles: "Roles",
  microsoftApps: "Microsoft Apps",
  saml: "SAML"
};

export function camelToTitle(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}
