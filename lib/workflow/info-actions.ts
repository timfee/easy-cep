"use server";
import "server-only";

import {
  ApiEndpoint,
  PROTECTED_RESOURCES,
  PROVIDERS,
  type Provider
} from "@/constants";
import { env } from "@/env";
import { refreshTokenIfNeeded } from "@/lib/auth";
import { z } from "zod";

import pLimit from "p-limit";

export interface DeleteResult {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
}

function checkPurgeAllowed() {
  if (!env.ALLOW_INFO_PURGE) {
    throw new Error("Purge functionality is disabled");
  }
}

function createDeleteAction(
  provider: Provider,
  getEndpoint: (id: string) => string,
  resourceName: string,
  isProtected?: (id: string) => boolean
) {
  return async function deleteResources(ids: string[]): Promise<DeleteResult> {
    checkPurgeAllowed();

    const token = await refreshTokenIfNeeded(provider);
    if (!token)
      throw new Error(
        `No ${provider === PROVIDERS.GOOGLE ? "Google" : "Microsoft"} token available`
      );

    const limit = pLimit(3);
    const results: DeleteResult = { deleted: [], failed: [] };

    const deletableIds =
      isProtected ? ids.filter((id) => !isProtected(id)) : ids;
    const protectedIds = isProtected ? ids.filter((id) => isProtected(id)) : [];

    protectedIds.forEach((id) => {
      results.failed.push({ id, error: `${resourceName} is protected` });
    });

    await Promise.all(
      deletableIds.map((id) =>
        limit(async () => {
          try {
            const res = await fetch(getEndpoint(id), {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token.accessToken}` }
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`HTTP ${res.status}: ${text}`);
            }

            results.deleted.push(id);
          } catch (error) {
            results.failed.push({
              id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        })
      )
    );

    return results;
  };
}

const createGoogleDeleteAction = (
  getEndpoint: (id: string) => string,
  resourceName: string,
  isProtected?: (id: string) => boolean
) =>
  createDeleteAction(PROVIDERS.GOOGLE, getEndpoint, resourceName, isProtected);

const createMicrosoftDeleteAction = (
  getEndpoint: (id: string) => string,
  resourceName: string,
  isProtected?: (id: string) => boolean
) =>
  createDeleteAction(
    PROVIDERS.MICROSOFT,
    getEndpoint,
    resourceName,
    isProtected
  );

export async function deleteOrgUnits(ids: string[]): Promise<DeleteResult> {
  return createGoogleDeleteAction(
    (id) => `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(id)}`,
    "Organizational Unit"
  )(ids);
}

export async function deleteSamlProfiles(ids: string[]): Promise<DeleteResult> {
  return createGoogleDeleteAction(
    (id) => `${ApiEndpoint.Google.SsoProfiles}/${encodeURIComponent(id)}`,
    "SAML Profile"
  )(ids);
}

export async function deleteSsoAssignments(
  ids: string[]
): Promise<DeleteResult> {
  return createGoogleDeleteAction(
    (id) => `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(id)}`,
    "SSO Assignment"
  )(ids);
}

export async function deleteGoogleRoles(ids: string[]): Promise<DeleteResult> {
  return createGoogleDeleteAction(
    (id) => `${ApiEndpoint.Google.Roles}/${id}`,
    "Admin Role",
    (id) => id.startsWith("_")
  )(ids);
}

export async function deleteClaimsPolicies(
  ids: string[]
): Promise<DeleteResult> {
  return createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.ClaimsPolicies}/${id}`,
    "Claims Policy"
  )(ids);
}

export async function deleteEnterpriseApps(
  ids: string[]
): Promise<DeleteResult> {
  return createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.Applications}/${id}`,
    "Enterprise Application",
    (id) => PROTECTED_RESOURCES.microsoftAppIds.has(id)
  )(ids);
}

export async function deleteProvisioningJobs(
  ids: string[]
): Promise<DeleteResult> {
  checkPurgeAllowed();

  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) throw new Error("No Microsoft token available");
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
  if (!spId) {
    return {
      deleted: [],
      failed: ids.map((id) => ({
        id,
        error: "Provisioning service principal not found"
      }))
    };
  }

  return createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.SyncJobs(spId)}/${id}`,
    "Provisioning Job"
  )(ids);
}
