/**
 * Deletes Microsoft Graph and Google Cloud apps/projects created recently.
 *
 * Run with: bun x tsx scripts/cleanup-apps.ts
 */

import { ApiEndpoint } from "@/constants";
import { getBearerTokens } from "@/lib/testing/tokens";

// Required to load .env.local
import "tsconfig-paths/register";

const ISO_FRACTION_REGEX = /\.\d{3}Z$/;

/**
 * Format a date as UTC without fractional seconds.
 */
function formatDateUtc(date: Date) {
  return date.toISOString().replace(ISO_FRACTION_REGEX, "Z");
}

/**
 * Delete Microsoft applications created after a threshold.
 */
async function deleteMicrosoftApps(token: string, threshold: string) {
  console.log(`# Deleting Microsoft apps created since ${threshold}`);

  const filter = encodeURIComponent(`createdDateTime ge ${threshold}`);
  const res = await fetch(
    `${ApiEndpoint.Microsoft.Applications}?$filter=${filter}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(
      `Failed to list Microsoft apps: ${res.status} ${res.statusText}`
    );
  }
  const data: { value?: { id: string }[] } = await res.json();

  for (const app of data.value ?? []) {
    console.log(`Deleting Microsoft app ${app.id}`);
    const deleteRes = await fetch(
      `${ApiEndpoint.Microsoft.Applications}/${app.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "DELETE",
      }
    );
    if (!deleteRes.ok) {
      throw new Error(
        `Failed to delete Microsoft app ${app.id}: ${deleteRes.status} ${deleteRes.statusText}`
      );
    }
  }
}

/**
 * Delete Google projects created after a threshold.
 */
async function deleteGoogleProjects(token: string, threshold: string) {
  console.log(`# Deleting Google projects created since ${threshold}`);

  const res = await fetch(ApiEndpoint.GoogleCloudResourceManager.Projects, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(
      `Failed to list Google projects: ${res.status} ${res.statusText}`
    );
  }

  const data: { projects?: { projectId: string; createTime: string }[] } =
    await res.json();
  for (const project of data.projects ?? []) {
    if (project.createTime >= threshold) {
      console.log(`Deleting Google project ${project.projectId}`);
      const deleteRes = await fetch(
        `${ApiEndpoint.GoogleCloudResourceManager.Projects}/${project.projectId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "DELETE",
        }
      );
      if (!deleteRes.ok) {
        throw new Error(
          `Failed to delete Google project ${project.projectId}: ${deleteRes.status} ${deleteRes.statusText}`
        );
      }
    }
  }
}

/**
 * Load env and delete recent apps/projects.
 */
async function main() {
  const { googleToken, microsoftToken } = await getBearerTokens(true);

  if (!googleToken?.accessToken || !microsoftToken?.accessToken) {
    throw new Error("Failed to obtain bearer tokens");
  }

  const thresholdDate = new Date();
  thresholdDate.setUTCDate(thresholdDate.getUTCDate() - 90);
  const threshold = formatDateUtc(thresholdDate);

  await deleteMicrosoftApps(microsoftToken.accessToken, threshold);
  try {
    await deleteGoogleProjects(googleToken.accessToken, threshold);
  } catch (error) {
    console.warn(
      "⚠️ Failed to cleanup Google projects (likely missing permission):",
      error
    );
  }
}

if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  })();
}
