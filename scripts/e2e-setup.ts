/**
 * Sets up a clean test environment for E2E testing
 * Run with: bun x tsx scripts/e2e-setup.ts
 */

import { z } from "zod";

import { ApiEndpoint } from "@/constants";
import { env } from "@/env";
import { getBearerTokens, normalizeEnvValue } from "@/lib/testing/tokens";

const getRequiredBearerTokens = async () => {
  const { googleToken, microsoftToken } = await getBearerTokens(true);
  if (!(googleToken && microsoftToken)) {
    throw new Error(
      "Missing E2E bearer tokens; ensure refresh tokens or service account credentials are set in .env.local."
    );
  }
  return {
    googleToken: googleToken.accessToken,
    msToken: microsoftToken.accessToken,
  };
};

const TEST_DOMAIN = normalizeEnvValue(env.TEST_DOMAIN) || "test.example.com";
const TEST_SUFFIX = "_test";
const TEST_NAME_FILTER = `displayName co '${TEST_SUFFIX}'`;

/**
 * Remove Google Workspace resources created by E2E runs.
 */
export async function cleanupGoogleEnvironment() {
  console.log("🧹 Cleaning up Google environment...");
  const { googleToken } = await getRequiredBearerTokens();

  const UsersSchema = z.object({
    users: z.array(z.object({ primaryEmail: z.string() })).optional(),
  });
  const OrgUnitsSchema = z.object({
    organizationUnits: z
      .array(z.object({ name: z.string(), orgUnitPath: z.string() }))
      .optional(),
  });
  const RolesSchema = z.object({
    items: z
      .array(z.object({ roleId: z.string(), roleName: z.string() }))
      .optional(),
  });
  const SamlSchema = z.object({
    inboundSamlSsoProfiles: z
      .array(z.object({ displayName: z.string(), name: z.string() }))
      .optional(),
  });

  try {
    const res = await fetch(
      `${ApiEndpoint.Google.Users}?domain=${TEST_DOMAIN}&query=email:*${TEST_SUFFIX}*`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
    const data = UsersSchema.parse(await res.json());
    for (const user of data.users ?? []) {
      await fetch(
        `${ApiEndpoint.Google.Users}/${encodeURIComponent(user.primaryEmail)}`,
        {
          headers: { Authorization: `Bearer ${googleToken}` },
          method: "DELETE",
        }
      );
    }
  } catch {
    // ignore cleanup errors
  }

  try {
    const res = await fetch(`${ApiEndpoint.Google.OrgUnits}?type=all`, {
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    const data = OrgUnitsSchema.parse(await res.json());
    for (const ou of data.organizationUnits ?? []) {
      if (ou.name?.includes(TEST_SUFFIX)) {
        await fetch(
          `${ApiEndpoint.Google.OrgUnits}/${encodeURIComponent(ou.orgUnitPath)}`,
          {
            headers: { Authorization: `Bearer ${googleToken}` },
            method: "DELETE",
          }
        );
      }
    }
  } catch {
    // ignore cleanup errors
  }

  const rolesRes = await fetch(ApiEndpoint.Google.Roles, {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  const roles = RolesSchema.parse(await rolesRes.json());
  for (const role of roles.items ?? []) {
    if (role.roleName?.includes(TEST_SUFFIX)) {
      await fetch(`${ApiEndpoint.Google.Roles}/${role.roleId}`, {
        headers: { Authorization: `Bearer ${googleToken}` },
        method: "DELETE",
      });
    }
  }

  const samlRes = await fetch(ApiEndpoint.Google.SsoProfiles, {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  const samlData = SamlSchema.parse(await samlRes.json());
  for (const profile of samlData.inboundSamlSsoProfiles ?? []) {
    if (profile.displayName?.includes(TEST_SUFFIX)) {
      try {
        await fetch(ApiEndpoint.Google.SamlProfile(profile.name), {
          headers: { Authorization: `Bearer ${googleToken}` },
          method: "DELETE",
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
const PROTECTED_APP_IDS = new Set([
  "28f2e988-0021-4521-b215-202dc300de38",
  "da8790bf-7b6d-457d-9f8d-a3c073b97070",
]);

/**
 * Remove Microsoft Entra resources created by E2E runs.
 */
export async function cleanupMicrosoftEnvironment() {
  console.log("🧹 Cleaning up Microsoft environment...");
  const { msToken } = await getRequiredBearerTokens();

  const AppsSchema = z.object({
    value: z
      .array(
        z.object({
          appId: z.string(),
          displayName: z.string().optional(),
          id: z.string(),
        })
      )
      .optional(),
  });
  const ServicePrincipalSchema = z.object({
    value: z.array(z.object({ id: z.string() })).optional(),
  });
  const PoliciesSchema = z.object({
    value: z
      .array(z.object({ displayName: z.string().optional(), id: z.string() }))
      .optional(),
  });

  const appsRes = await fetch(
    `${ApiEndpoint.Microsoft.Applications}?$filter=${encodeURIComponent(TEST_NAME_FILTER)}`,
    {
      headers: { Authorization: `Bearer ${msToken}` },
    }
  );
  const apps = AppsSchema.parse(await appsRes.json());

  for (const app of apps.value ?? []) {
    if (!app.displayName?.includes(TEST_SUFFIX)) {
      continue;
    }
    if (PROTECTED_APP_IDS.has(app.appId)) {
      console.log(
        `🔒 Skipping protected app: ${app.displayName} (${app.appId})`
      );
      continue;
    }

    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=appId eq '${app.appId}'`,
      { headers: { Authorization: `Bearer ${msToken}` } }
    );
    const sps = ServicePrincipalSchema.parse(await spRes.json());
    for (const sp of sps.value ?? []) {
      await fetch(`${ApiEndpoint.Microsoft.ServicePrincipals}/${sp.id}`, {
        headers: { Authorization: `Bearer ${msToken}` },
        method: "DELETE",
      });
    }

    await fetch(`${ApiEndpoint.Microsoft.Applications}/${app.id}`, {
      headers: { Authorization: `Bearer ${msToken}` },
      method: "DELETE",
    });

    console.log(`🗑️  Deleted test app: ${app.displayName}`);
  }

  const policiesRes = await fetch(
    `${ApiEndpoint.Microsoft.ClaimsPolicies}?$filter=${encodeURIComponent(TEST_NAME_FILTER)}`,
    {
      headers: { Authorization: `Bearer ${msToken}` },
    }
  );
  const policies = PoliciesSchema.parse(await policiesRes.json());
  for (const policy of policies.value ?? []) {
    if (!policy.displayName?.includes(TEST_SUFFIX)) {
      continue;
    }
    await fetch(`${ApiEndpoint.Microsoft.ClaimsPolicies}/${policy.id}`, {
      headers: { Authorization: `Bearer ${msToken}` },
      method: "DELETE",
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
  setupEnvironment().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
