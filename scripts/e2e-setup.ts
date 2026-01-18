/**
 * Sets up a clean test environment for E2E testing
 * Run with: bun x tsx scripts/e2e-setup.ts
 */

import { readFileSync } from "node:fs";
import { z } from "zod";
import { ApiEndpoint } from "@/constants";

/**
 * Load bearer tokens from .env.test if unset.
 */
if (
  !(process.env.TEST_GOOGLE_BEARER_TOKEN && process.env.TEST_MS_BEARER_TOKEN)
) {
  try {
    const envTest = readFileSync(".env.test", "utf8");
    for (const line of envTest.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // ignore missing env file
  }
}

const GOOGLE_TOKEN = process.env.TEST_GOOGLE_BEARER_TOKEN;
const MS_TOKEN = process.env.TEST_MS_BEARER_TOKEN;

if (!(GOOGLE_TOKEN && MS_TOKEN)) {
  throw new Error(
    "Missing TEST_GOOGLE_BEARER_TOKEN or TEST_MS_BEARER_TOKEN in environment."
  );
}
const TEST_DOMAIN = process.env.TEST_DOMAIN || "test.example.com";
const TEST_PREFIX = "test-";

/**
 * Remove Google Workspace resources created by E2E runs.
 */
export async function cleanupGoogleEnvironment() {
  console.log("\uD83E\uDDF9 Cleaning up Google environment...");

  const UsersSchema = z.object({
    users: z.array(z.object({ primaryEmail: z.string() })).optional(),
  });
  const OrgUnitsSchema = z.object({
    organizationUnits: z
      .array(z.object({ orgUnitPath: z.string(), name: z.string() }))
      .optional(),
  });
  const RolesSchema = z.object({
    items: z
      .array(z.object({ roleName: z.string(), roleId: z.string() }))
      .optional(),
  });
  const SamlSchema = z.object({
    inboundSamlSsoProfiles: z
      .array(z.object({ name: z.string(), displayName: z.string() }))
      .optional(),
  });

  try {
    const res = await fetch(
      `${ApiEndpoint.Google.Users}?domain=${TEST_DOMAIN}&query=email:${TEST_PREFIX}azuread-provisioning-*`,
      { headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` } }
    );
    const data = UsersSchema.parse(await res.json());
    for (const user of data.users ?? []) {
      await fetch(
        `${ApiEndpoint.Google.Users}/${encodeURIComponent(user.primaryEmail)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
        }
      );
    }
  } catch {
    // ignore cleanup errors
  }

  try {
    const res = await fetch(`${ApiEndpoint.Google.OrgUnits}?type=all`, {
      headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
    });
    const data = OrgUnitsSchema.parse(await res.json());
    for (const ou of data.organizationUnits ?? []) {
      if (ou.name?.startsWith(`${TEST_PREFIX}automation-`)) {
        await fetch(
          `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(ou.orgUnitPath)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
          }
        );
      }
    }
  } catch {
    // ignore cleanup errors
  }

  const rolesRes = await fetch(ApiEndpoint.Google.Roles, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
  });
  const roles = RolesSchema.parse(await rolesRes.json());
  for (const role of roles.items ?? []) {
    if (role.roleName?.startsWith("Test Microsoft Entra Provisioning")) {
      await fetch(`${ApiEndpoint.Google.Roles}/${role.roleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
      });
    }
  }

  const samlRes = await fetch(ApiEndpoint.Google.SsoProfiles, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
  });
  const samlData = SamlSchema.parse(await samlRes.json());
  for (const profile of samlData.inboundSamlSsoProfiles ?? []) {
    if (profile.displayName?.startsWith("Test ")) {
      try {
        await fetch(ApiEndpoint.Google.SamlProfile(profile.name), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
        });
        console.log(`🗑️ Deleted SAML profile: ${profile.displayName}`);
      } catch (error) {
        console.warn(
          `⚠️ Failed to delete SAML profile ${profile.displayName}:`,
          error
        );
      }
    }
  }

  console.log("\u2705 Google environment cleaned");
}
const PROTECTED_APP_IDS = [
  "28f2e988-0021-4521-b215-202dc300de38",
  "da8790bf-7b6d-457d-9f8d-a3c073b97070",
];

/**
 * Remove Microsoft Entra resources created by E2E runs.
 */
export async function cleanupMicrosoftEnvironment() {
  console.log("🧹 Cleaning up Microsoft environment...");

  const AppsSchema = z.object({
    value: z
      .array(
        z.object({
          id: z.string(),
          appId: z.string(),
          displayName: z.string().optional(),
        })
      )
      .optional(),
  });
  const ServicePrincipalSchema = z.object({
    value: z.array(z.object({ id: z.string() })).optional(),
  });
  const PoliciesSchema = z.object({
    value: z
      .array(z.object({ id: z.string(), displayName: z.string().optional() }))
      .optional(),
  });

  const appsRes = await fetch(ApiEndpoint.Microsoft.Applications, {
    headers: { Authorization: `Bearer ${MS_TOKEN}` },
  });
  const apps = AppsSchema.parse(await appsRes.json());

  for (const app of apps.value ?? []) {
    if (!app.displayName?.startsWith("Test ")) {
      continue;
    }
    if (PROTECTED_APP_IDS.includes(app.appId)) {
      console.log(
        `🔒 Skipping protected app: ${app.displayName} (${app.appId})`
      );
      continue;
    }

    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=appId eq '${app.appId}'`,
      { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
    );
    const sps = ServicePrincipalSchema.parse(await spRes.json());
    for (const sp of sps.value ?? []) {
      await fetch(`${ApiEndpoint.Microsoft.ServicePrincipals}/${sp.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${MS_TOKEN}` },
      });
    }

    await fetch(`${ApiEndpoint.Microsoft.Applications}/${app.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MS_TOKEN}` },
    });

    console.log(`🗑️  Deleted test app: ${app.displayName}`);
  }

  const policiesRes = await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
    headers: { Authorization: `Bearer ${MS_TOKEN}` },
  });
  const policies = PoliciesSchema.parse(await policiesRes.json());
  for (const policy of policies.value ?? []) {
    if (!policy.displayName?.startsWith("Test ")) {
      continue;
    }
    await fetch(`${ApiEndpoint.Microsoft.ClaimsPolicies}/${policy.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MS_TOKEN}` },
    });
    console.log(`🗑️  Deleted claims policy: ${policy.displayName}`);
  }

  console.log("\u2705 Microsoft environment cleaned");
}

/**
 * Clean Google and Microsoft test resources.
 */
export async function setupEnvironment() {
  await cleanupGoogleEnvironment();
  await cleanupMicrosoftEnvironment();
  console.log("\uD83C\uDF89 Environment ready for testing!");
}

if (typeof require !== "undefined" && require.main === module) {
  setupEnvironment().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
