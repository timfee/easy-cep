import { TIME } from "@/lib/workflow/constants/workflow-limits";

export const ApiEndpoint = {
  Google: {
    Domains:
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains",
    OrgUnits:
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits",
    Users: "https://admin.googleapis.com/admin/directory/v1/users",
    Roles:
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles",
    RoleAssignments:
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roleassignments",
    RolePrivileges:
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles/ALL/privileges",
    SsoProfiles:
      "https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles",
    SsoAssignments:
      "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments",
    SamlProfile: (profileId: string) =>
      `https://cloudidentity.googleapis.com/v1/${profileId}`,
    SamlProfileCredentials: (profileId: string) =>
      `https://cloudidentity.googleapis.com/v1/${profileId}/idpCredentials:add`,
    SamlProfileCredentialsList: (profileId: string) =>
      `https://cloudidentity.googleapis.com/v1/${profileId}/idpCredentials`,
    SiteVerification: "https://www.googleapis.com/siteVerification/v1",
  },
  GoogleAuth: {
    Authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    Token: "https://oauth2.googleapis.com/token",
    TokenInfo: "https://oauth2.googleapis.com/tokeninfo",
  },

  Microsoft: {
    Applications: "https://graph.microsoft.com/beta/applications",
    ServicePrincipals: "https://graph.microsoft.com/beta/servicePrincipals",

    Templates: (templateId: string) =>
      `https://graph.microsoft.com/v1.0/applicationTemplates/${templateId}/instantiate`,

    Synchronization: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization`,

    SyncTemplates: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization/templates`,

    SyncJobs: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization/jobs`,

    SyncSecrets: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization/secrets`,

    StartSync: (spId: string, jobId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization/jobs/${jobId}/start`,

    ClaimsPolicies:
      "https://graph.microsoft.com/beta/policies/claimsMappingPolicies",

    AssignClaimsPolicy: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/claimsMappingPolicies/$ref`,

    UnassignClaimsPolicy: (spId: string, policyId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/claimsMappingPolicies/${policyId}/$ref`,

    ReadClaimsPolicy: (spId: string) =>
      `https://graph.microsoft.com/beta/servicePrincipals/${spId}/claimsMappingPolicies`,

    TokenSigningCertificates: (spId: string) =>
      `https://graph.microsoft.com/beta/servicePrincipals/${spId}/tokenSigningCertificates`,

    AddTokenSigningCertificate: (spId: string) =>
      `https://graph.microsoft.com/beta/servicePrincipals/${spId}/addTokenSigningCertificate`,

    Organization: "https://graph.microsoft.com/v1.0/organization",

    Me: "https://graph.microsoft.com/v1.0/me",
  },
  MicrosoftAuth: {
    Authorize:
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    Token: "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
  },
};

export type TemplateIdValue = "01303a13-8322-4e06-bee5-80d612907131";
export const TemplateId: Record<
  "GoogleWorkspaceConnector" | "GoogleWorkspaceSaml",
  TemplateIdValue
> = {
  GoogleWorkspaceConnector: "01303a13-8322-4e06-bee5-80d612907131",
  GoogleWorkspaceSaml: "01303a13-8322-4e06-bee5-80d612907131",
};

// Synchronization templates are enumerated per service principal. The Google
// Workspace connector exposes a template with factory tag `gsuite`. We
// dynamically look up the corresponding template ID before job creation.
export type SyncTemplateTagValue = "gsuite";
export const SyncTemplateTag: Record<"GoogleWorkspace", SyncTemplateTagValue> =
  { GoogleWorkspace: "gsuite" };

export type Provider = "google" | "microsoft";
export const PROVIDERS: Record<"GOOGLE" | "MICROSOFT", Provider> = {
  GOOGLE: "google",
  MICROSOFT: "microsoft",
};

export const OAUTH_STATE_COOKIE_NAME = "oauth_state";

export const WORKFLOW_CONSTANTS: {
  TOKEN_COOKIE_MAX_AGE: number;
  OAUTH_STATE_TTL_MS: number;
  TOKEN_REFRESH_BUFFER_MS: number;
} = {
  TOKEN_COOKIE_MAX_AGE: TIME.DAY * 7,
  OAUTH_STATE_TTL_MS: 10 * TIME.MINUTE,
  TOKEN_REFRESH_BUFFER_MS: 5 * TIME.MINUTE,
};

export type ApiPrefixValue =
  | "https://admin.googleapis.com/admin/directory/v1"
  | "https://cloudidentity.googleapis.com/v1"
  | "https://www.googleapis.com/siteVerification/v1"
  | "https://graph.microsoft.com"
  | "https://graph.microsoft.com/beta"
  | "https://graph.microsoft.com/v1.0";
export const API_PREFIXES: Record<
  | "GOOGLE_ADMIN"
  | "GOOGLE_CLOUD_IDENTITY"
  | "GOOGLE_SITE_VERIFICATION"
  | "MS_GRAPH"
  | "MS_GRAPH_BETA"
  | "MS_GRAPH_V1",
  ApiPrefixValue
> = {
  GOOGLE_ADMIN: "https://admin.googleapis.com/admin/directory/v1",
  GOOGLE_CLOUD_IDENTITY: "https://cloudidentity.googleapis.com/v1",
  GOOGLE_SITE_VERIFICATION: "https://www.googleapis.com/siteVerification/v1",
  MS_GRAPH: "https://graph.microsoft.com",
  MS_GRAPH_BETA: "https://graph.microsoft.com/beta",
  MS_GRAPH_V1: "https://graph.microsoft.com/v1.0",
};

export const PROTECTED_RESOURCES = {
  microsoftAppIds: new Set<string>(),
  googleRoleNames: new Set<string>([
    "_SUPERADMIN_ROLE",
    "_SEED_ADMIN_ROLE",
    "_GROUPS_ADMIN_ROLE",
  ]),
};

export type CategoryTitleValue = "Auth" | "Domain" | "Config" | "State";
export const categoryTitles: Record<
  "auth" | "domain" | "config" | "state",
  CategoryTitleValue
> = { auth: "Auth", domain: "Domain", config: "Config", state: "State" };
