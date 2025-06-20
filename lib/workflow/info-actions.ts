"use server";
import "server-only";

import { ApiEndpoint, PROTECTED_RESOURCES, PROVIDERS } from "@/constants";
import { env } from "@/env";
import { refreshTokenIfNeeded } from "@/lib/auth";

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

function createGoogleDeleteAction(
  getEndpoint: (id: string) => string,
  resourceName: string,
  isProtected?: (id: string) => boolean
) {
  return async function deleteResources(ids: string[]): Promise<DeleteResult> {
    checkPurgeAllowed();

    const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
    if (!token) throw new Error("No Google token available");

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

function createMicrosoftDeleteAction(
  getEndpoint: (id: string) => string,
  resourceName: string,
  isProtected?: (id: string) => boolean
) {
  return async function deleteResources(ids: string[]): Promise<DeleteResult> {
    checkPurgeAllowed();

    const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
    if (!token) throw new Error("No Microsoft token available");

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

export async function deleteSsoAssignments(ids: string[]): Promise<DeleteResult> {
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

export async function deleteClaimsPolicies(ids: string[]): Promise<DeleteResult> {
  return createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.ClaimsPolicies}/${id}`,
    "Claims Policy"
  )(ids);
}

export async function deleteEnterpriseApps(ids: string[]): Promise<DeleteResult> {
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

  const results: DeleteResult = { deleted: [], failed: [] };

  for (const jobId of ids) {
    try {
      results.failed.push({
        id: jobId,
        error: "Provisioning job deletion requires service principal context"
      });
    } catch (error) {
      results.failed.push({
        id: jobId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}
