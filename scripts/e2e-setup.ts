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

const GOOGLE_TOKEN = process.env.GOOGLE_BEARER_TOKEN;
const MS_TOKEN = process.env.MS_BEARER_TOKEN;
const TEST_DOMAIN = process.env.TEST_DOMAIN || "test.example.com";

export async function cleanupGoogleEnvironment() {
  console.log("\uD83E\uDDF9 Cleaning up Google environment...");

  // 1. Delete test service user if exists
  try {
    await fetch(`${ApiEndpoint.Google.Users}/azuread-provisioning@${TEST_DOMAIN}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` }
    });
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
  const roles = await rolesRes.json();
  const customRole = roles.items?.find((r: any) => r.roleName === "Microsoft Entra Provisioning");
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
  const samlData = await samlRes.json();
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

export async function cleanupMicrosoftEnvironment() {
  console.log("\uD83E\uDDF9 Cleaning up Microsoft environment...");

  // 1. Find and delete test apps
  const appsRes = await fetch(
    `${ApiEndpoint.Microsoft.Applications}?$filter=displayName eq 'Google Workspace Provisioning' or displayName eq 'Google Workspace SSO'`,
    { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
  );
  const apps = await appsRes.json();

  for (const app of apps.value || []) {
    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=appId eq '${app.appId}'`,
      { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
    );
    const sps = await spRes.json();
    for (const sp of sps.value || []) {
      await fetch(`${ApiEndpoint.Microsoft.ServicePrincipals}/${sp.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${MS_TOKEN}` }
      });
    }

    await fetch(`${ApiEndpoint.Microsoft.Applications}/${app.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MS_TOKEN}` }
    });
  }

  // 2. Delete test claims policies
  const policiesRes = await fetch(
    `${ApiEndpoint.Microsoft.ClaimsPolicies}?$filter=displayName eq 'Google Workspace Basic Claims'`,
    { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
  );
  const policies = await policiesRes.json();
  for (const policy of policies.value || []) {
    await fetch(`${ApiEndpoint.Microsoft.ClaimsPolicies}/${policy.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${MS_TOKEN}` }
    });
  }

  console.log("\u2705 Microsoft environment cleaned");
}

export async function setupEnvironment() {
  await cleanupGoogleEnvironment();
  await cleanupMicrosoftEnvironment();
  console.log("\uD83C\uDF89 Environment ready for testing!");
}

if (require.main === module) {
  // eslint-disable-next-line promise/prefer-await-to-then
  setupEnvironment().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
