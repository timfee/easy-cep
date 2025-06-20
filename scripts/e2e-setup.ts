/**
 * Sets up a clean test environment for E2E testing
 * Run with: pnpm tsx scripts/e2e-setup.ts
 */

import { ApiEndpoint } from "@/constants";
import { fetch, ProxyAgent, setGlobalDispatcher } from "undici";

if (process.env.USE_UNDICI_PROXY !== "false") {
  const proxy = process.env.https_proxy ?? process.env.http_proxy;
  if (proxy) {
    setGlobalDispatcher(new ProxyAgent({ uri: proxy }));
  }
}

const GOOGLE_TOKEN = process.env.TEST_GOOGLE_BEARER_TOKEN;
const MS_TOKEN = process.env.TEST_MS_BEARER_TOKEN;
const TEST_DOMAIN = process.env.TEST_DOMAIN || "test.example.com";

export async function cleanupGoogleEnvironment() {
  console.log("\uD83E\uDDF9 Cleaning up Google environment...");

  // 1. Delete test service user if exists
  try {
    await fetch(
      `${ApiEndpoint.Google.Users}/azuread-provisioning@${TEST_DOMAIN}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` } }
    );
  } catch {
    // ignore
  }

  // 2. Delete Automation OU if exists
  try {
    await fetch(`${ApiEndpoint.Google.OrgUnits}/Automation`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` }
    });
  } catch {
    // ignore
  }

  // 3. Remove custom admin role
  const rolesRes = await fetch(ApiEndpoint.Google.Roles, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` }
  });
  const roles = (await rolesRes.json()) as {
    items?: Array<{ roleName: string; roleId: string }>;
  };
  const customRole = roles.items?.find(
    (role) => role.roleName === "Microsoft Entra Provisioning"
  );
  if (customRole) {
    await fetch(`${ApiEndpoint.Google.Roles}/${customRole.roleId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` }
    });
  }

  // 4. Delete SAML profiles
  const samlRes = await fetch(ApiEndpoint.Google.SsoProfiles, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` }
  });
  const samlData = (await samlRes.json()) as {
    inboundSamlSsoProfiles?: Array<{ name: string; displayName: string }>;
  };
  for (const profile of samlData.inboundSamlSsoProfiles || []) {
    if (profile.displayName === "Azure AD") {
      await fetch(`${ApiEndpoint.Google.SsoProfiles}/${profile.name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` }
      });
    }
  }

  console.log("\u2705 Google environment cleaned");
}
const PROTECTED_APP_IDS = [
  "28f2e988-0021-4521-b215-202dc300de38", // From .env.local
  "da8790bf-7b6d-457d-9f8d-a3c073b97070" // From .env.test
];

export async function cleanupMicrosoftEnvironment() {
  console.log("\uD83E\uDDF9 Cleaning up Microsoft environment...");

  // 1. Find and delete test apps (but protect our auth apps)
  const appsRes = await fetch(
    `${ApiEndpoint.Microsoft.Applications}?$filter=displayName eq 'Google Workspace Provisioning' or displayName eq 'Google Workspace SSO'`,
    { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
  );
  const apps = (await appsRes.json()) as {
    value?: Array<{ id: string; appId: string; displayName: string }>;
  };

  for (const app of apps.value || []) {
    // Skip protected apps
    if (PROTECTED_APP_IDS.includes(app.appId)) {
      console.log(
        `🔒 Skipping protected app: ${app.displayName} (${app.appId})`
      );
      continue;
    }

    // Find and delete associated service principals
    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=appId eq '${app.appId}'`,
      { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
    );
    const sps = (await spRes.json()) as { value?: Array<{ id: string }> };
    for (const sp of sps.value || []) {
      await fetch(`${ApiEndpoint.Microsoft.ServicePrincipals}/${sp.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${MS_TOKEN}` }
      });
    }

    // Delete the application
    await fetch(`${ApiEndpoint.Microsoft.Applications}/${app.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MS_TOKEN}` }
    });

    console.log(`🗑️  Deleted test app: ${app.displayName}`);
  }

  // 2. Delete test claims policies
  const policiesRes = await fetch(
    `${ApiEndpoint.Microsoft.ClaimsPolicies}?$filter=displayName eq 'Google Workspace Basic Claims'`,
    { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
  );
  const policies = (await policiesRes.json()) as {
    value?: Array<{ id: string; displayName: string }>;
  };
  for (const policy of policies.value || []) {
    await fetch(`${ApiEndpoint.Microsoft.ClaimsPolicies}/${policy.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MS_TOKEN}` }
    });
    console.log(`🗑️  Deleted claims policy: ${policy.displayName}`);
  }

  console.log("\u2705 Microsoft environment cleaned");
}

export async function setupEnvironment() {
  await cleanupGoogleEnvironment();
  await cleanupMicrosoftEnvironment();
  console.log("\uD83C\uDF89 Environment ready for testing!");
}

if (require.main === module) {
  setupEnvironment().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
