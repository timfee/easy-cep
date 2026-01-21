"use server";

import { z } from "zod";

import {
  ApiEndpoint,
  PROTECTED_RESOURCES,
  PROVIDERS,
  TemplateId,
} from "@/constants";
import { refreshTokenIfNeeded } from "@/lib/auth";
import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";

const LEADING_SLASH_REGEX = /^\//;

/**
 * Normalized shape used for info panels.
 */
export interface InfoItem {
  id: string;
  label: string;
  subLabel?: string;
  href?: string;
  deletable?: boolean;
  deleteEndpoint?: string;
}

/**
 * List Google Workspace domains.
 */
export async function listDomains(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    domains: z.array(
      z.object({
        domainName: z.string(),
        isPrimary: z.boolean().optional(),
        verified: z.boolean().optional(),
      })
    ),
  });

  const res = await fetch(ApiEndpoint.Google.Domains, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return data.domains.map((domain) => ({
    href: "https://admin.google.com/ac/domains",
    id: domain.domainName,
    label: domain.domainName + (domain.isPrimary ? " (Primary)" : ""),
    subLabel: domain.verified ? "Verified" : "Unverified",
  }));
}

/**
 * List Google organizational units.
 */
export async function listOrgUnits(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    organizationUnits: z
      .array(
        z.object({
          name: z.string(),
          orgUnitId: z.string(),
          orgUnitPath: z.string(),
        })
      )
      .optional(),
  });

  const res = await fetch(`${ApiEndpoint.Google.OrgUnits}?type=all`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return (
    data.organizationUnits?.map((ou) => ({
      deletable: true,
      deleteEndpoint: `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(
        ou.orgUnitPath.replace(LEADING_SLASH_REGEX, "")
      )}`,
      href: "https://admin.google.com/ac/orgunits",
      id: ou.orgUnitId,
      label: ou.orgUnitPath,
    })) ?? []
  );
}

/**
 * List Google inbound SAML profiles.
 */
export async function listSamlProfiles(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    inboundSamlSsoProfiles: z
      .array(z.object({ displayName: z.string().optional(), name: z.string() }))
      .optional(),
  });

  const res = await fetch(ApiEndpoint.Google.SsoProfiles, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return (
    data.inboundSamlSsoProfiles?.map((profile) => ({
      deletable: true,
      deleteEndpoint: ApiEndpoint.Google.SamlProfile(profile.name),
      href: `https://admin.google.com/ac/security/sso/sso-profiles/${encodeURIComponent(profile.name)}`,
      id: profile.name,
      label: profile.displayName ?? profile.name,
    })) ?? []
  );
}

/**
 * List Google inbound SSO assignments.
 */
export async function listSsoAssignments(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    inboundSsoAssignments: z
      .array(
        z.object({
          name: z.string(),
          ssoMode: z.string().optional(),
          targetGroup: z.string().optional(),
          targetOrgUnit: z.string().optional(),
        })
      )
      .optional(),
  });

  const res = await fetch(ApiEndpoint.Google.SsoAssignments, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return (
    data.inboundSsoAssignments?.map((assignment) => {
      const id = extractResourceId(
        assignment.name,
        ResourceTypes.InboundSsoAssignments
      );
      return {
        deletable: true,
        deleteEndpoint: `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(
          id
        )}`,
        href: "https://admin.google.com/ac/security/sso",
        id,
        label:
          assignment.targetGroup || assignment.targetOrgUnit || assignment.name,
        subLabel: assignment.ssoMode,
      };
    }) ?? []
  );
}

/**
 * List Microsoft provisioning jobs.
 */
export async function listProvisioningJobs(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) {
    return [];
  }

  const SpSchema = z.object({
    value: z.array(z.object({ appId: z.string(), id: z.string() })),
  });
  const spFilter = encodeURIComponent(
    "displayName eq 'Google Workspace Provisioning'"
  );
  const spRes = await fetch(
    `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${spFilter}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!spRes.ok) {
    throw new Error(`HTTP ${spRes.status}`);
  }
  const spData = SpSchema.parse(await spRes.json());
  const [sp] = spData.value;
  if (!sp) {
    return [];
  }

  const JobsSchema = z.object({
    value: z.array(
      z.object({
        id: z.string(),
        templateId: z.string().optional(),
        schedule: z.object({ state: z.string().optional() }).optional(),
        status: z
          .object({
            code: z.string().optional(),
            lastExecution: z
              .object({
                state: z.string().optional(),
                error: z
                  .object({
                    code: z.string().optional(),
                    message: z.string().optional(),
                    tenantActionable: z.boolean().optional(),
                  })
                  .optional(),
                timeBegan: z.string().optional(),
                timeEnded: z.string().optional(),
              })
              .optional(),
            quarantine: z
              .object({
                reason: z.string().optional(),
                error: z
                  .object({
                    code: z.string().optional(),
                    message: z.string().optional(),
                    tenantActionable: z.boolean().optional(),
                  })
                  .optional(),
              })
              .optional(),
          })
          .optional(),
      })
    ),
  });

  const res = await fetch(ApiEndpoint.Microsoft.SyncJobs(sp.id), {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = JobsSchema.parse(await res.json());
  return data.value.map((job) => {
    const { status } = job;
    const lastExecutionErrorMessage = status?.lastExecution?.error?.message;
    const quarantineErrorMessage = status?.quarantine?.error?.message;
    const errorMessage = lastExecutionErrorMessage ?? quarantineErrorMessage;
    const descriptionParts = [
      job.schedule?.state,
      status?.code,
      status?.quarantine?.reason,
      errorMessage,
    ].filter(Boolean) as string[];
    return {
      deletable: true,
      deleteEndpoint: `${ApiEndpoint.Microsoft.SyncJobs(sp.id)}/${job.id}`,
      href: `https://portal.azure.com/#view/Microsoft_AAD_Connect_Provisioning/ProvisioningMenuBlade/~/OverviewPreview/objectId/${sp.id}/appId/${sp.appId}`,
      id: job.id,
      label: job.templateId ?? job.id,
      subLabel: descriptionParts.join(" · ") || undefined,
    };
  });
}

/**
 * List Microsoft claims mapping policies.
 */
export async function listClaimsPolicies(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    value: z.array(
      z.object({ displayName: z.string().optional(), id: z.string() })
    ),
  });

  const res = await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return data.value.map((policy) => ({
    deletable: true,
    deleteEndpoint: `${ApiEndpoint.Microsoft.ClaimsPolicies}/${policy.id}`,
    href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview",
    id: policy.id,
    label: policy.displayName ?? policy.id,
  }));
}

/**
 * List Microsoft enterprise applications.
 */
export async function listEnterpriseApps(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    value: z.array(
      z.object({ appId: z.string(), displayName: z.string(), id: z.string() })
    ),
  });

  const filter = encodeURIComponent(
    `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}'`
  );
  const res = await fetch(
    `${ApiEndpoint.Microsoft.Applications}?$filter=${filter}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());

  const items: InfoItem[] = [];
  for (const application of data.value) {
    const spFilter = encodeURIComponent(`appId eq '${application.appId}'`);
    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${spFilter}`,
      { headers: { Authorization: `Bearer ${token.accessToken}` } }
    );
    if (spRes.ok) {
      const spData = z
        .object({ value: z.array(z.object({ id: z.string() })) })
        .parse(await spRes.json());
      const spId = spData.value[0]?.id;

      items.push({
        deletable: !PROTECTED_RESOURCES.microsoftAppIds.has(application.appId),
        deleteEndpoint: `${ApiEndpoint.Microsoft.Applications}/${application.id}`,
        href: spId
          ? `https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/SignOn/objectId/${spId}/appId/${application.appId}/preferredSingleSignOnMode~/null/servicePrincipalType/Application/fromNav/`
          : "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview",
        id: application.id,
        label: application.displayName,
      });
    }
  }
  return items;
}

/**
 * List Google user accounts.
 */
export async function listUsers(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    users: z
      .array(z.object({ id: z.string(), primaryEmail: z.string() }))
      .optional(),
  });

  const res = await fetch(
    `${ApiEndpoint.Google.Users}?customer=my_customer&maxResults=25`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return (
    data.users?.map((user) => ({
      deletable: true,
      deleteEndpoint: `${ApiEndpoint.Google.Users}/${user.id}`,
      href: "https://admin.google.com/ac/users",
      id: user.id,
      label: user.primaryEmail,
    })) ?? []
  );
}

/**
 * List Google admin roles.
 */
export async function listAdminRoles(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    return [];
  }

  const Schema = z.object({
    items: z
      .array(z.object({ roleId: z.string(), roleName: z.string() }))
      .optional(),
  });

  const res = await fetch(ApiEndpoint.Google.Roles, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = Schema.parse(await res.json());
  return (
    data.items?.map((role) => ({
      deletable: !role.roleId.startsWith("_"),
      deleteEndpoint: `${ApiEndpoint.Google.Roles}/${role.roleId}`,
      href: "https://admin.google.com/ac/roles",
      id: role.roleId,
      label: role.roleName,
    })) ?? []
  );
}
