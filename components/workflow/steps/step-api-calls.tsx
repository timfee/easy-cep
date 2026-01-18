"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { API_PREFIXES, ApiEndpoint } from "@/constants";
import { cn } from "@/lib/utils";
import { extractPath } from "@/lib/utils/url";
import { Var } from "@/lib/workflow/variables";
import { HttpMethod } from "@/types";

type StepIdValue = string;

interface ApiCallMetadata {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  description: string;
  body?: Record<string, unknown>;
}
interface StepApiCallsProps {
  stepId: string;
}

export function StepApiCalls({ stepId }: StepApiCallsProps) {
  const apiTemplates = stepApiMetadata[stepId] || [];

  if (apiTemplates.length === 0) {
    return null;
  }

  const getFullUrl = (endpoint: string) => {
    const {
      GOOGLE_ADMIN,
      GOOGLE_CLOUD_IDENTITY,
      MS_GRAPH,
      MS_GRAPH_BETA,
      MS_GRAPH_V1,
    } = API_PREFIXES;

    if (endpoint.startsWith("/cloudidentity")) {
      return GOOGLE_CLOUD_IDENTITY + endpoint.slice("/cloudidentity".length);
    }
    if (endpoint.startsWith("/graph/beta")) {
      return MS_GRAPH_BETA + endpoint.slice("/graph/beta".length);
    }
    if (endpoint.startsWith("/graph/v1.0")) {
      return MS_GRAPH_V1 + endpoint.slice("/graph/v1.0".length);
    }
    if (endpoint.startsWith("/graph")) {
      return MS_GRAPH + endpoint.slice("/graph".length);
    }
    return GOOGLE_ADMIN + endpoint;
  };

  const getMethodBadge = (method: string) => {
    const colors = {
      [HttpMethod.GET]: "bg-primary/10 text-primary border-primary/20",
      [HttpMethod.POST]: "bg-secondary/10 text-secondary border-secondary/20",
      [HttpMethod.PUT]: "bg-accent/60 text-accent-foreground border-border",
      [HttpMethod.PATCH]: "bg-accent/40 text-accent-foreground border-border",
      [HttpMethod.DELETE]:
        "bg-destructive/10 text-destructive border-destructive/20",
    };

    const match = Object.entries(colors).find(([key]) => key === method);
    return match?.[1] ?? "bg-muted text-muted-foreground border-border";
  };

  return (
    <TooltipProvider>
      <div className="w-full space-y-1 text-left text-xs">
        {apiTemplates.map((template, index) => (
          <Tooltip key={`${template.method}-${template.endpoint}-${index}`}>
            <TooltipTrigger asChild>
              <div className="flex cursor-pointer items-center gap-3 rounded py-2 hover:bg-muted">
                <div
                  className={cn(
                    "rounded border px-2 py-1 font-semibold text-[10px]",
                    getMethodBadge(template.method)
                  )}
                >
                  {template.method}
                </div>
                <code className="ml-1 break-all text-muted-foreground">
                  {template.endpoint}
                </code>
              </div>
            </TooltipTrigger>

            <TooltipContent className="max-w-xl" side="bottom">
              <div className="api-scrollbar max-h-40 overflow-auto rounded p-2 text-xs">
                <h4 className="font-bold">{template.description}</h4>
                <pre className="text-[10px]">
                  {getFullUrl(template.endpoint)}
                  <div className="opacity-90">
                    {JSON.stringify(template.body, null, 2)}
                  </div>
                </pre>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

export const stepApiMetadata: Record<StepIdValue, ApiCallMetadata[]> = {
  "verify-primary-domain": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.Domains),
      description: "Check domain verification status",
    },
    {
      method: "POST",
      endpoint: `${extractPath(ApiEndpoint.Google.SiteVerification)}/token`,
      description: "Get verification token",
    },
  ],

  "create-automation-ou": [
    {
      method: "GET",
      endpoint: `${extractPath(ApiEndpoint.Google.OrgUnits)}/{ouName}`,
      description: "Check if OU exists",
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.OrgUnits),
      description: "Create Automation OU",
      body: {
        name: Var.AutomationOuName,
        parentOrgUnitPath: Var.AutomationOuPath,
      },
    },
  ],

  "create-service-user": [
    {
      method: "GET",
      endpoint:
        extractPath(ApiEndpoint.Google.Users) +
        "/azuread-provisioning@{primaryDomain}",
      description: "Check if service user exists",
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.Users),
      description: "Create service user",
      body: {
        primaryEmail: "azuread-provisioning@{primaryDomain}",
        name: { givenName: "Microsoft", familyName: "Provisioning" },
        password: "{generatedPassword}",
        orgUnitPath: Var.AutomationOuPath,
      },
    },
  ],

  "create-admin-role-and-assign-user": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.Roles),
      description: "Check existing roles",
    },
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.RolePrivileges),
      description: "Get available privileges",
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.Roles),
      description: "Create custom admin role",
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.RoleAssignments),
      description: "Assign role to user",
      body: {
        roleId: "{adminRoleId}",
        assignedTo: "{provisioningUserId}",
        scopeType: "CUSTOMER",
      },
    },
  ],

  "configure-google-saml-profile": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.SsoProfiles),
      description: "Check SAML profiles",
    },
    {
      method: "POST",
      endpoint: "/cloudidentity/customers/my_customer/inboundSamlSsoProfiles",
      description: "Create SAML profile",
      body: {
        displayName: Var.SamlProfileDisplayName,
        idpConfig: { entityId: "", singleSignOnServiceUri: "" },
      },
    },
  ],

  "create-microsoft-apps": [
    {
      method: "GET",
      endpoint:
        extractPath(ApiEndpoint.Microsoft.Applications) +
        "?$filter=applicationTemplateId eq '{templateId}'",
      description: "Check existing apps",
    },
    {
      method: "GET",
      endpoint:
        extractPath(ApiEndpoint.Microsoft.ServicePrincipals) +
        "?$filter=appId eq '{appId}'",
      description: "Get service principals",
    },
    {
      method: "POST",
      endpoint: "/graph/v1.0/applicationTemplates/{templateId}/instantiate",
      description: "Create enterprise apps",
      body: { displayName: "{displayName}" },
    },
  ],

  "setup-microsoft-provisioning": [
    {
      method: "GET",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs",
      description: "Check sync status",
    },
    {
      method: "POST",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs",
      description: "Create sync job",
      body: { templateId: "gsuite" }, // via SyncTemplates lookup
    },
    {
      method: "PUT",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/secrets",
      description: "Set credentials",
    },
    {
      method: "POST",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}/start",
      description: "Start synchronization",
    },
  ],

  "configure-microsoft-sso": [
    {
      method: "PATCH",
      endpoint: "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}",
      description: "Set SSO mode to saml",
    },
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Microsoft.Organization),
      description: "Get tenant information",
    },
    {
      method: "PATCH",
      endpoint: "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}",
      description: "Configure SAML URLs",
    },
    {
      method: "PATCH",
      endpoint: "/graph/beta/applications/{applicationObjectId}",
      description: "Set identifier URIs and redirect URIs",
    },
    {
      method: "POST",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/addTokenSigningCertificate",
      description: "Create signing certificate",
    },
  ],

  "setup-microsoft-claims-policy": [
    {
      method: "GET",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies",
      description: "Check claims policy",
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Microsoft.ClaimsPolicies),
      description: "Create claims policy",
    },
    {
      method: "POST",
      endpoint:
        "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies/$ref",
      description: "Assign policy to app",
    },
  ],

  "complete-google-sso-setup": [
    {
      method: "GET",
      endpoint: "/cloudidentity/{samlProfileId}",
      description: "Check SSO configuration",
    },
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Microsoft.Organization),
      description: "Get tenant information",
    },
    {
      method: "GET",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/tokenSigningCertificates",
      description: "Get signing certificates",
    },
    {
      method: "PATCH",
      endpoint: "/cloudidentity/{samlProfileId}",
      description: "Update SAML profile",
    },
    {
      method: "POST",
      endpoint: "/cloudidentity/{samlProfileId}/idpCredentials:add",
      description: "Upload certificate",
    },
  ],

  "assign-users-to-sso": [
    {
      method: "GET",
      endpoint: extractPath(ApiEndpoint.Google.SsoAssignments),
      description: "Check user assignments",
    },
    {
      method: "POST",
      endpoint: extractPath(ApiEndpoint.Google.SsoAssignments),
      description: "Assign all users to SSO",
      body: {
        targetOrgUnit: "orgUnits/{rootOrgUnitId}",
        samlSsoInfo: { inboundSamlSsoProfile: "{samlProfileId}" },
        ssoMode: "SAML_SSO",
      },
    },
  ],
};
