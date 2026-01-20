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

/**
 * Display the API calls associated with a workflow step.
 */
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
      [HttpMethod.POST]:
        "bg-secondary/40 text-secondary-foreground border-secondary/30",
      [HttpMethod.PUT]: "bg-accent/50 text-accent-foreground border-accent/40",
      [HttpMethod.PATCH]:
        "bg-accent/40 text-accent-foreground border-accent/30",
      [HttpMethod.DELETE]:
        "bg-destructive/10 text-destructive border-destructive/20",
    };

    const match = Object.entries(colors).find(([key]) => key === method);
    return match?.[1] ?? "bg-muted/50 text-foreground/70 border-border";
  };

  return (
    <TooltipProvider>
      <div className="w-full space-y-1 text-left text-xs">
        {apiTemplates.map((template, index) => (
          <Tooltip key={`${template.method}-${template.endpoint}-${index}`}>
            <TooltipTrigger asChild>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                type="button"
              >
                <div
                  className={cn(
                    "rounded border px-2 py-1 font-semibold text-[10px]",
                    getMethodBadge(template.method)
                  )}
                >
                  {template.method}
                </div>
                <code className="ml-1 break-all text-[11px] text-foreground/80">
                  {template.endpoint}
                </code>
              </button>
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

/**
 * Known API calls mapped to each workflow step.
 */
export const stepApiMetadata: Record<StepIdValue, ApiCallMetadata[]> = {
  "assign-users-to-sso": [
    {
      description: "Check user assignments",
      endpoint: extractPath(ApiEndpoint.Google.SsoAssignments),
      method: "GET",
    },
    {
      body: {
        targetOrgUnit: "orgUnits/{rootOrgUnitId}",
        samlSsoInfo: { inboundSamlSsoProfile: "{samlProfileId}" },
        ssoMode: "SAML_SSO",
      },
      description: "Assign all users to SSO",
      endpoint: extractPath(ApiEndpoint.Google.SsoAssignments),
      method: "POST",
    },
  ],

  "complete-google-sso-setup": [
    {
      description: "Check SSO configuration",
      endpoint: "/cloudidentity/{samlProfileId}",
      method: "GET",
    },
    {
      description: "Get tenant information",
      endpoint: extractPath(ApiEndpoint.Microsoft.Organization),
      method: "GET",
    },
    {
      description: "Get signing certificates",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/tokenSigningCertificates",
      method: "GET",
    },
    {
      description: "Update SAML profile",
      endpoint: "/cloudidentity/{samlProfileId}",
      method: "PATCH",
    },
    {
      description: "Upload certificate",
      endpoint: "/cloudidentity/{samlProfileId}/idpCredentials:add",
      method: "POST",
    },
  ],

  "configure-google-saml-profile": [
    {
      description: "Check SAML profiles",
      endpoint: extractPath(ApiEndpoint.Google.SsoProfiles),
      method: "GET",
    },
    {
      body: {
        displayName: Var.SamlProfileDisplayName,
        idpConfig: { entityId: "", singleSignOnServiceUri: "" },
      },
      description: "Create SAML profile",
      endpoint: "/cloudidentity/customers/my_customer/inboundSamlSsoProfiles",
      method: "POST",
    },
  ],

  "configure-microsoft-sso": [
    {
      description: "Set SSO mode to saml",
      endpoint: "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}",
      method: "PATCH",
    },
    {
      description: "Get tenant information",
      endpoint: extractPath(ApiEndpoint.Microsoft.Organization),
      method: "GET",
    },
    {
      description: "Configure SAML URLs",
      endpoint: "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}",
      method: "PATCH",
    },
    {
      description: "Set identifier URIs and redirect URIs",
      endpoint: "/graph/beta/applications/{applicationObjectId}",
      method: "PATCH",
    },
    {
      description: "Create signing certificate",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/addTokenSigningCertificate",
      method: "POST",
    },
  ],

  "create-admin-role-and-assign-user": [
    {
      description: "Check existing roles",
      endpoint: extractPath(ApiEndpoint.Google.Roles),
      method: "GET",
    },
    {
      description: "Get available privileges",
      endpoint: extractPath(ApiEndpoint.Google.RolePrivileges),
      method: "GET",
    },
    {
      description: "Create custom admin role",
      endpoint: extractPath(ApiEndpoint.Google.Roles),
      method: "POST",
    },
    {
      body: {
        roleId: "{adminRoleId}",
        assignedTo: "{provisioningUserId}",
        scopeType: "CUSTOMER",
      },
      description: "Assign role to user",
      endpoint: extractPath(ApiEndpoint.Google.RoleAssignments),
      method: "POST",
    },
  ],

  "create-automation-ou": [
    {
      description: "Check if OU exists",
      endpoint: `${extractPath(ApiEndpoint.Google.OrgUnits)}/{ouName}`,
      method: "GET",
    },
    {
      body: {
        name: Var.AutomationOuName,
        parentOrgUnitPath: Var.AutomationOuPath,
      },
      description: "Create Automation OU",
      endpoint: extractPath(ApiEndpoint.Google.OrgUnits),
      method: "POST",
    },
  ],

  "create-microsoft-apps": [
      {
        description: "Check existing apps",
        endpoint: `${extractPath(ApiEndpoint.Microsoft.Applications)}?$filter=applicationTemplateId eq '{templateId}'`,
        method: "GET",
      },
      {
        description: "Get service principals",
        endpoint: `${extractPath(ApiEndpoint.Microsoft.ServicePrincipals)}?$filter=appId eq '{appId}'`,
        method: "GET",
      },
    {
      body: { displayName: "{displayName}" },
      description: "Create enterprise apps",
      endpoint: "/graph/v1.0/applicationTemplates/{templateId}/instantiate",
      method: "POST",
    },
  ],

  "create-service-user": [
      {
        description: "Check if service user exists",
        endpoint: `${extractPath(ApiEndpoint.Google.Users)}/azuread-provisioning@{primaryDomain}`,
        method: "GET",
      },
    {
      body: {
        primaryEmail: "azuread-provisioning@{primaryDomain}",
        name: { givenName: "Microsoft", familyName: "Provisioning" },
        password: "{generatedPassword}",
        orgUnitPath: Var.AutomationOuPath,
      },
      description: "Create service user",
      endpoint: extractPath(ApiEndpoint.Google.Users),
      method: "POST",
    },
  ],

  "setup-microsoft-claims-policy": [
    {
      description: "Check claims policy",
      endpoint:
        "/graph/beta/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies",
      method: "GET",
    },
    {
      description: "Create claims policy",
      endpoint: extractPath(ApiEndpoint.Microsoft.ClaimsPolicies),
      method: "POST",
    },
    {
      description: "Assign policy to app",
      endpoint:
        "/graph/v1.0/servicePrincipals/{ssoServicePrincipalId}/claimsMappingPolicies/$ref",
      method: "POST",
    },
  ],

  "setup-microsoft-provisioning": [
    {
      description: "Check sync status",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs",
      method: "GET",
    },
    {
      body: { templateId: "gsuite" },
      description: "Create sync job",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs",
      method: "POST",
    },
    {
      description: "Set credentials",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/secrets",
      method: "PUT",
    },
    {
      description: "Start synchronization",
      endpoint:
        "/graph/v1.0/servicePrincipals/{provisioningServicePrincipalId}/synchronization/jobs/{jobId}/start",
      method: "POST",
    },
  ],

  "verify-primary-domain": [
    {
      description: "Check domain verification status",
      endpoint: extractPath(ApiEndpoint.Google.Domains),
      method: "GET",
    },
    {
      description: "Get verification token",
      endpoint: `${extractPath(ApiEndpoint.Google.SiteVerification)}/token`,
      method: "POST",
    },
  ],
};
