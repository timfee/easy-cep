// ✅ Usage: Avoid string repetition and centralize well-known URLs, group IDs, and template constants.

// app/workflow/constants.ts

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
      "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments"
  },
  GoogleAuth: {
    Authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    Token: "https://oauth2.googleapis.com/token",
    TokenInfo: "https://oauth2.googleapis.com/tokeninfo"
  },

  Microsoft: {
    Applications: "https://graph.microsoft.com/beta/applications",

    Templates: (templateId: string) =>
      `https://graph.microsoft.com/v1.0/applicationTemplates/${templateId}/instantiate`,

    Synchronization: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization`,

    SyncJobs: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization/jobs`,

    StartSync: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/synchronization/jobs/Initial/start`,

    ClaimsPolicies:
      "https://graph.microsoft.com/beta/policies/claimsMappingPolicies",

    AssignClaimsPolicy: (spId: string) =>
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spId}/claimsMappingPolicies/$ref`,

    ReadClaimsPolicy: (spId: string) =>
      `https://graph.microsoft.com/beta/servicePrincipals/${spId}/claimsMappingPolicies`,

    Me: "https://graph.microsoft.com/v1.0/me"
  },
  MicrosoftAuth: {
    Authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    Token: "https://login.microsoftonline.com/common/oauth2/v2.0/token"
  }
};

export const TemplateId = {
  GoogleWorkspaceConnector: "01303a13-8322-4e06-bee5-80d612907131"
};

export const GroupId = { AllUsers: "allUsers" };

export const OAuthScope = {
  Google:
    "openid https://www.googleapis.com/auth/admin.directory.user.readonly",
  Microsoft: "https://graph.microsoft.com/.default offline_access"
};

export const OAuthConfig = {
  Google: {
    clientId: "dummy-google-client-id",
    clientSecret: "dummy-google-client-secret",
    redirectUri: "http://localhost:3000/api/auth/google/callback"
  },
  Microsoft: {
    clientId: "dummy-ms-client-id",
    clientSecret: "dummy-ms-client-secret",
    redirectUri: "http://localhost:3000/api/auth/microsoft/callback"
  }
};
