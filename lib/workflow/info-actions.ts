"use server";

import pLimit from "p-limit";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import type { Provider } from "@/constants";

import { ApiEndpoint, PROTECTED_RESOURCES, PROVIDERS } from "@/constants";
import { env } from "@/env";
import { refreshTokenIfNeeded } from "@/lib/auth";
import { extractResourceId, ResourceTypes } from "@/lib/workflow/core/http";

/**
 * Options that control delete batching.
 */
interface DeleteOptions {
  concurrency?: number;
  delayMs?: number;
}

/**
 * Summary of delete outcomes.
 */
export interface DeleteResult {
  deleted: string[];
  failed: { id: string; error: string }[];
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
  isProtected?: (id: string) => boolean,
  options: DeleteOptions = {}
) {
  return async function deleteResources(ids: string[]): Promise<DeleteResult> {
    checkPurgeAllowed();

    const token = await refreshTokenIfNeeded(provider);
    if (!token) {
      throw new Error(
        `No ${provider === PROVIDERS.GOOGLE ? "Google" : "Microsoft"} token available`
      );
    }

    const limit = pLimit(options.concurrency ?? 3);
    const results: DeleteResult = { deleted: [], failed: [] };

    const deletableIds = isProtected
      ? ids.filter((id) => !isProtected(id))
      : ids;
    const protectedIds = isProtected ? ids.filter((id) => isProtected(id)) : [];

    for (const id of protectedIds) {
      results.failed.push({ error: `${resourceName} is protected`, id });
    }

    await Promise.all(
      deletableIds.map((id, index) =>
        limit(async () => {
          try {
            const res = await fetch(getEndpoint(id), {
              headers: { Authorization: `Bearer ${token.accessToken}` },
              method: "DELETE",
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`HTTP ${res.status}: ${text}`);
            }

            results.deleted.push(id);
          } catch (error) {
            results.failed.push({
              error: error instanceof Error ? error.message : String(error),
              id,
            });
          }

          if (options.delayMs && index < deletableIds.length - 1) {
            await delay(options.delayMs);
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
  isProtected?: (id: string) => boolean,
  options?: DeleteOptions
) =>
  createDeleteAction(
    PROVIDERS.GOOGLE,
    getEndpoint,
    resourceName,
    isProtected,
    options
  );

const createMicrosoftDeleteAction = (
  getEndpoint: (id: string) => string,
  resourceName: string,
  isProtected?: (id: string) => boolean,
  options?: DeleteOptions
) =>
  createDeleteAction(
    PROVIDERS.MICROSOFT,
    getEndpoint,
    resourceName,
    isProtected,
    options
  );

/**
 * Delete Google organizational units by ID.
 */
export async function deleteOrgUnits(ids: string[]): Promise<DeleteResult> {
  checkPurgeAllowed();

  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) {
    throw new Error("No Google token available");
  }

  const results: DeleteResult = { deleted: [], failed: [] };

  for (const [index, id] of ids.entries()) {
    try {
      const res = await fetch(
        `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${token.accessToken}` },
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      results.deleted.push(id);
    } catch (error) {
      results.failed.push({
        error: error instanceof Error ? error.message : String(error),
        id,
      });
    }

    if (index < ids.length - 1) {
      await delay(1500);
    }
  }

  return results;
}

/**
 * Delete Google SAML profiles by ID.
 */
export async function deleteSamlProfiles(ids: string[]): Promise<DeleteResult> {
  return await createGoogleDeleteAction(
    (id) => ApiEndpoint.Google.SamlProfile(id),
    "SAML Profile",
    undefined,
    { concurrency: 1, delayMs: 1500 }
  )(ids);
}

/**
 * Delete Google SSO assignments by ID.
 */
export async function deleteSsoAssignments(
  ids: string[]
): Promise<DeleteResult> {
  return await createGoogleDeleteAction(
    (id) => {
      const normalized = extractResourceId(
        id,
        ResourceTypes.InboundSsoAssignments
      );
      return `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(normalized)}`;
    },
    "SSO Assignment",
    undefined,
    { concurrency: 1, delayMs: 1500 }
  )(ids);
}

/**
 * Delete Google admin roles by ID.
 */
export async function deleteGoogleRoles(ids: string[]): Promise<DeleteResult> {
  return await createGoogleDeleteAction(
    (id) => `${ApiEndpoint.Google.Roles}/${id}`,
    "Admin Role",
    (id) => id.startsWith("_"),
    { concurrency: 1, delayMs: 1500 }
  )(ids);
}

/**
 * Delete Google users by ID.
 */
export async function deleteGoogleUsers(ids: string[]): Promise<DeleteResult> {
  return await createGoogleDeleteAction(
    (id) => `${ApiEndpoint.Google.Users}/${id}`,
    "User",
    undefined,
    { concurrency: 1, delayMs: 1500 }
  )(ids);
}

/**
 * Delete Microsoft claims policies by ID.
 */
export async function deleteClaimsPolicies(
  ids: string[]
): Promise<DeleteResult> {
  return await createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.ClaimsPolicies}/${id}`,
    "Claims Policy"
  )(ids);
}

/**
 * Delete Microsoft enterprise apps by ID.
 */
export async function deleteEnterpriseApps(
  ids: string[]
): Promise<DeleteResult> {
  return await createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.Applications}/${id}`,
    "Enterprise Application",
    (id) => PROTECTED_RESOURCES.microsoftAppIds.has(id)
  )(ids);
}

/**
 * Delete Microsoft provisioning jobs by ID.
 */
export async function deleteProvisioningJobs(
  ids: string[]
): Promise<DeleteResult> {
  checkPurgeAllowed();

  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) {
    throw new Error("No Microsoft token available");
  }
  const SpSchema = z.object({ value: z.array(z.object({ id: z.string() })) });
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
  const spId = spData.value[0]?.id;
  if (!spId) {
    return {
      deleted: [],
      failed: ids.map((id) => ({
        error: "Provisioning service principal not found",
        id,
      })),
    };
  }

  return createMicrosoftDeleteAction(
    (id) => `${ApiEndpoint.Microsoft.SyncJobs(spId)}/${id}`,
    "Provisioning Job"
  )(ids);
}
