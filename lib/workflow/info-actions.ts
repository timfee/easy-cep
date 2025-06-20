"use server";
import "server-only";

import { ApiEndpoint, PROVIDERS } from "@/constants";
import { refreshTokenIfNeeded } from "@/lib/auth";

export interface DeleteResult {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
}

async function doDelete(token: string, url: string) {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

export async function deleteOrgUnits(ids: string[]): Promise<DeleteResult> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) throw new Error("No token");
  const result: DeleteResult = { deleted: [], failed: [] };
  for (const id of ids) {
    try {
      await doDelete(
        token.accessToken,
        `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(id)}`
      );
      result.deleted.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}

export async function deleteSamlProfiles(ids: string[]): Promise<DeleteResult> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) throw new Error("No token");
  const result: DeleteResult = { deleted: [], failed: [] };
  for (const id of ids) {
    try {
      await doDelete(
        token.accessToken,
        `${ApiEndpoint.Google.SsoProfiles}/${encodeURIComponent(id)}`
      );
      result.deleted.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}

export async function deleteSsoAssignments(
  ids: string[]
): Promise<DeleteResult> {
  const token = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  if (!token) throw new Error("No token");
  const result: DeleteResult = { deleted: [], failed: [] };
  for (const id of ids) {
    try {
      await doDelete(
        token.accessToken,
        `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(id)}`
      );
      result.deleted.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}

export async function deleteProvisioningJobs(
  ids: string[]
): Promise<DeleteResult> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) throw new Error("No token");

  const spFilter = encodeURIComponent(
    "displayName eq 'Google Workspace Provisioning'"
  );
  const spRes = await fetch(
    `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${spFilter}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!spRes.ok) throw new Error(`HTTP ${spRes.status}`);
  const spData = (await spRes.json()) as { value?: Array<{ id: string }> };
  const spId = spData.value?.[0]?.id;
  if (!spId) throw new Error("No service principal");

  const result: DeleteResult = { deleted: [], failed: [] };
  for (const id of ids) {
    try {
      await doDelete(
        token.accessToken,
        `${ApiEndpoint.Microsoft.SyncJobs(spId)}/${id}`
      );
      result.deleted.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}

export async function deleteClaimsPolicies(
  ids: string[]
): Promise<DeleteResult> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) throw new Error("No token");
  const result: DeleteResult = { deleted: [], failed: [] };
  for (const id of ids) {
    try {
      await doDelete(
        token.accessToken,
        `${ApiEndpoint.Microsoft.ClaimsPolicies}/${id}`
      );
      result.deleted.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}

export async function deleteEnterpriseApps(
  ids: string[]
): Promise<DeleteResult> {
  const token = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  if (!token) throw new Error("No token");
  const result: DeleteResult = { deleted: [], failed: [] };
  for (const id of ids) {
    try {
      await doDelete(
        token.accessToken,
        `${ApiEndpoint.Microsoft.Applications}/${id}`
      );
      result.deleted.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return result;
}
