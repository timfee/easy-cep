"use server";
import "server-only";

import {
  ApiEndpoint,
  PROTECTED_RESOURCES,
  PROVIDERS,
  TemplateId
} from "@/constants";
import { refreshTokenIfNeeded } from "@/lib/auth";
import { z } from "zod";

export interface InfoItem {
  id: string;
  label: string;
  subLabel?: string;
  href?: string;
  deletable?: boolean;
  deleteEndpoint?: string;
}

export async function listOrgUnits(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) return [];

  const Schema = z.object({
    organizationUnits: z
      .array(
        z.object({
          orgUnitId: z.string(),
          name: z.string(),
          orgUnitPath: z.string()
        })
      )
      .optional()
  });

  const res = await fetch(`${ApiEndpoint.Google.OrgUnits}?type=all`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = Schema.parse(await res.json());
  return (
    data.organizationUnits?.map((ou) => ({
      id: ou.orgUnitId,
      label: ou.orgUnitPath,
      href: `https://admin.google.com/ac/orgunits?ouid=${encodeURIComponent(
        ou.orgUnitId.replace(/^id:/, "")
      )}`,
      deletable: true,
      deleteEndpoint: `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(
        ou.orgUnitPath.replace(/^\//, "")
      )}`
    })) ?? []
  );
}

export async function listSamlProfiles(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) return [];

  const Schema = z.object({
    inboundSamlSsoProfiles: z
      .array(z.object({ name: z.string(), displayName: z.string().optional() }))
      .optional()
  });

  const res = await fetch(ApiEndpoint.Google.SsoProfiles, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = Schema.parse(await res.json());
  return (
    data.inboundSamlSsoProfiles?.map((p) => {
      const id = p.name.replace(/^(?:.*\/)?samlProfiles\//, "");
      return {
        id: p.name,
        label: p.displayName ?? p.name,
        href: `https://admin.google.com/ac/apps/saml/${encodeURIComponent(id)}`,
        deletable: true,
        deleteEndpoint: `${ApiEndpoint.Google.SsoProfiles}/${encodeURIComponent(
          p.name
        )}`
      };
    }) ?? []
  );
}

export async function listSsoAssignments(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) return [];

  const Schema = z.object({
    inboundSsoAssignments: z
      .array(
        z.object({
          name: z.string(),
          targetGroup: z.string().optional(),
          targetOrgUnit: z.string().optional(),
          ssoMode: z.string().optional()
        })
      )
      .optional()
  });

  const res = await fetch(
    `${ApiEndpoint.Google.SsoAssignments}?customer=customers/my_customer`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = Schema.parse(await res.json());
  return (
    data.inboundSsoAssignments?.map((a) => {
      const id = a.name.replace(/^(?:.*\/)?inboundSsoAssignments\//, "");
      return {
        id,
        label: a.targetGroup || a.targetOrgUnit || a.name,
        subLabel: a.ssoMode,
        href: `https://admin.google.com/ac/security/inboundsso?assignmentId=${encodeURIComponent(
          id
        )}`,
        deletable: true,
        deleteEndpoint: `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(
          id
        )}`
      };
    }) ?? []
  );
}

export async function listProvisioningJobs(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) return [];

  const SpSchema = z.object({ value: z.array(z.object({ id: z.string() })) });
  const spFilter = encodeURIComponent(
    "displayName eq 'Google Workspace Provisioning'"
  );
  const spRes = await fetch(
    `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${spFilter}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!spRes.ok) throw new Error(`HTTP ${spRes.status}`);
  const spData = SpSchema.parse(await spRes.json());
  const spId = spData.value[0]?.id;
  if (!spId) return [];

  const JobsSchema = z.object({
    value: z.array(
      z.object({
        id: z.string(),
        templateId: z.string().optional(),
        status: z.object({ code: z.string().optional() }).optional()
      })
    )
  });

  const res = await fetch(ApiEndpoint.Microsoft.SyncJobs(spId), {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = JobsSchema.parse(await res.json());
  return data.value.map((j) => ({
    id: j.id,
    label: j.templateId ?? j.id,
    subLabel: j.status?.code,
    href: `https://entra.microsoft.com/#view/Microsoft_AAD_Connect/SynchronizationJobBlade/jobId/${j.id}`,
    deletable: true,
    deleteEndpoint: `${ApiEndpoint.Microsoft.SyncJobs(spId)}/${j.id}`
  }));
}

export async function listClaimsPolicies(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) return [];

  const Schema = z.object({
    value: z.array(
      z.object({ id: z.string(), displayName: z.string().optional() })
    )
  });

  const res = await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = Schema.parse(await res.json());
  return data.value.map((p) => ({
    id: p.id,
    label: p.displayName ?? p.id,
    deletable: true,
    deleteEndpoint: `${ApiEndpoint.Microsoft.ClaimsPolicies}/${p.id}`
  }));
}

export async function listEnterpriseApps(): Promise<InfoItem[]> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) return [];

  const Schema = z.object({
    value: z.array(
      z.object({ id: z.string(), appId: z.string(), displayName: z.string() })
    )
  });

  const filter = encodeURIComponent(
    `applicationTemplateId eq '${TemplateId.GoogleWorkspaceConnector}' or applicationTemplateId eq '${TemplateId.GoogleWorkspaceSaml}'`
  );
  const res = await fetch(
    `${ApiEndpoint.Microsoft.Applications}?$filter=${filter}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = Schema.parse(await res.json());
  return data.value.map((a) => ({
    id: a.id,
    label: a.displayName,
    deletable: !PROTECTED_RESOURCES.microsoftAppIds.has(a.appId),
    deleteEndpoint: `${ApiEndpoint.Microsoft.Applications}/${a.id}`
  }));
}
