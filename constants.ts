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
      `https://graph.microsoft.com/beta/servicePrincipals/${spId}/claimsMappingPolicies`
  }
};

export const TemplateId = {
  GoogleWorkspaceConnector: "01303a13-8322-4e06-bee5-80d612907131"
};

export const GroupId = { AllUsers: "allUsers" };
