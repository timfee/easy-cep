import { ApiEndpoint } from "@/constants";
import { StepIdValue, Var } from "@/types";

interface ApiCallMetadata {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  description: string;
  body?: Record<string, unknown>;
}

function extractPath(url: string): string {
  // eslint-disable-next-line workflow/no-hardcoded-urls
  const googlePrefix = "https://admin.googleapis.com/admin/directory/v1";
  // eslint-disable-next-line workflow/no-hardcoded-urls
  const googleCloudPrefix = "https://cloudidentity.googleapis.com/v1";
  // eslint-disable-next-line workflow/no-hardcoded-urls
  const msGraphPrefix = "https://graph.microsoft.com";

  if (url.startsWith(googlePrefix)) {
    return url.slice(googlePrefix.length);
  }
  if (url.startsWith(googleCloudPrefix)) {
    return "/cloudidentity" + url.slice(googleCloudPrefix.length);
  }
  if (url.startsWith(msGraphPrefix)) {
    return "/graph" + url.slice(msGraphPrefix.length);
  }
  return url;
}

export const stepApiMetadata: Record<StepIdValue, ApiCallMetadata[]> = {
  "verify-primary-domain": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.Domains),
      description: "Check domain verification status"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.SiteVerification) + "/token",
      description: "Get verification token"
    }
  ],

  "create-automation-ou": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.OrgUnits) + "/{ouName}",
      description: "Check if OU exists"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.OrgUnits),
      description: "Create Automation OU",
      body: {
        name: Var.AutomationOuName,
        parentOrgUnitPath: Var.AutomationOuPath
      }
    }
  ],

  "create-service-user": [
    {
      method: "GET",
      endpoint:
        extractPath(ApiEndpoint.Google.Users)
        + "/azuread-provisioning@{primaryDomain}",
      description: "Check if service user exists"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.Users),
      description: "Create service user",
      body: {
        primaryEmail: "azuread-provisioning@{primaryDomain}",
        name: { givenName: "Microsoft", familyName: "Provisioning" },
        password: "{generatedPassword}",
        orgUnitPath: Var.AutomationOuPath
      }
    }
  ],

  "create-admin-role-and-assign-user": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.Roles),
      description: "Check existing roles"
    },
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.RolePrivileges),
      description: "Get available privileges"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.Roles),
      description: "Create custom admin role"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.RoleAssignments),
      description: "Assign role to user",
      body: {
        roleId: "{adminRoleId}",
        assignedTo: "{provisioningUserId}",
        scopeType: "CUSTOMER"
      }
    }
  ],

  "configure-google-saml-profile": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.SsoProfiles),
      description: "Check SAML profiles"
    },
    {
      method: "POST",
      endpoint: "/cloudidentity/customers/my_customer/inboundSamlSsoProfiles",
      description: "Create SAML profile",
      body: {
        displayName: Var.SamlProfileDisplayName,
        idpConfig: { entityId: "", singleSignOnServiceUri: "" }
      }
    }
  ],

  "create-microsoft-apps": [
    {
      method: "GET",
      endpoint:
        extractPath(ApiEndpoint.Microsoft.Applications)
        + "?$filter=applicationTemplateId eq '{templateId}'",
      description: "Check existing apps"
    },
    {
      method: "GET",
      endpoint:
        extractPath(ApiEndpoint.Microsoft.ServicePrincipals)
        + "?$filter=appId eq '{appId}'",
      description: "Get service principals"
    },
    {
      method: "POST",
      endpoint: "/graph/v1.0/applicationTemplates/{templateId}/instantiate",
      description: "Create enterprise apps",
      body: { displayName: "{displayName}" }
    }
  ],

  "configure-microsoft-sync-and-sso": [
    {
      method: "GET",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs",
      description: "Check sync status"
    },
    {
      method: "POST",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs",
      description: "Create sync job",
      body: { templateId: "google2provisioningV2" }
    },
    {
      method: "PUT",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/secrets",
      description: "Set credentials"
    },
    {
      method: "POST",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}/start",
      description: "Start synchronization"
    }
  ],

  "setup-microsoft-claims-policy": [
    {
      method: "GET",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies",
      description: "Check claims policy"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Microsoft.ClaimsPolicies),
      description: "Create claims policy"
    },
    {
      method: "POST",
      endpoint:
        "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies/$ref",
      description: "Assign policy to app"
    }
  ],

  "complete-google-sso-setup": [
    {
      method: "GET",
      endpoint: "/cloudidentity/{samlProfileId}",
      description: "Check SSO configuration"
    },
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Microsoft.Organization),
      description: "Get tenant information"
    },
    {
      method: "GET",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/tokenSigningCertificates",
      description: "Get signing certificates"
    },
    {
      method: "PATCH",
      endpoint: "/cloudidentity/{samlProfileId}",
      description: "Update SAML profile"
    },
    {
      method: "POST",
      endpoint: "/cloudidentity/{samlProfileId}/idpCredentials:add",
      description: "Upload certificate"
    }
  ],

  "assign-users-to-sso": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.SsoAssignments),
      description: "Check user assignments"
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.SsoAssignments),
      description: "Assign all users to SSO",
      body: {
        targetGroup: "groups/allUsers",
        samlSsoInfo: { inboundSamlSsoProfile: "{samlProfileId}" },
        ssoMode: "SAML_SSO"
      }
    }
  ],

  "test-sso-configuration": []
};
