/**
 * Deletes Microsoft Graph and Google Cloud apps/projects created recently.
 *
 * Run with: bun x tsx scripts/cleanup-apps.ts
 */

import { ApiEndpoint } from "@/constants";
import { env } from "@/env";

const ISO_FRACTION_REGEX = /\.\d{3}Z$/;

/**
 * Require a named environment variable.
 */
function requireEnv(name: "TEST_GOOGLE_BEARER_TOKEN" | "TEST_MS_BEARER_TOKEN") {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} not found in environment or .env.local`);
  }
  return value;
}

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

  const res = await fetch(
    "https://cloudresourcemanager.googleapis.com/v1/projects:list",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );
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
        `https://cloudresourcemanager.googleapis.com/v1/projects/${project.projectId}`,
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
  const googleToken = requireEnv("TEST_GOOGLE_BEARER_TOKEN");
  const microsoftToken = requireEnv("TEST_MS_BEARER_TOKEN");

  const thresholdDate = new Date();
  thresholdDate.setUTCDate(thresholdDate.getUTCDate() - 10);
  const threshold = formatDateUtc(thresholdDate);

  await deleteMicrosoftApps(microsoftToken, threshold);
  await deleteGoogleProjects(googleToken, threshold);
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
