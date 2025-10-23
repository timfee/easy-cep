/**
 * Validates test credentials and checks API access
 * Run with: pnpm tsx scripts/validate-test-credentials.ts
 */

import { ApiEndpoint } from "@/constants";
import { existsSync, readFileSync } from "fs";
import { fetch, ProxyAgent, setGlobalDispatcher } from "undici";

// Configure proxy if needed
if (process.env.USE_UNDICI_PROXY !== "false") {
  const proxy = process.env.https_proxy ?? process.env.http_proxy;
  if (proxy) {
    setGlobalDispatcher(new ProxyAgent({ uri: proxy }));
  }
}

interface ValidationResult {
  provider: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: Record<string, unknown>;
}

async function validateGoogleToken(
  token: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    provider: "Google",
    valid: false,
    errors: [],
    warnings: [],
    info: {}
  };

  try {
    // Check token info
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`
    );

    if (!tokenInfoRes.ok) {
      result.errors.push(
        `Token info request failed: ${tokenInfoRes.status} ${tokenInfoRes.statusText}`
      );
      return result;
    }

    const tokenInfo = await tokenInfoRes.json();
    result.info.tokenInfo = tokenInfo;

    // Check expiration
    if (tokenInfo.expires_in) {
      const expiresInMinutes = Math.floor(tokenInfo.expires_in / 60);
      if (expiresInMinutes < 5) {
        result.warnings.push(
          `Token expires in ${expiresInMinutes} minutes - consider refreshing`
        );
      }
      result.info.expiresInMinutes = expiresInMinutes;
    }

    // Check scopes
    const scopes = tokenInfo.scope?.split(" ") || [];
    const requiredScopes = [
      "https://www.googleapis.com/auth/admin.directory.domain.readonly",
      "https://www.googleapis.com/auth/admin.directory.orgunit",
      "https://www.googleapis.com/auth/admin.directory.user",
      "https://www.googleapis.com/auth/admin.directory.rolemanagement",
      "https://www.googleapis.com/auth/cloud-identity.inboundsso"
    ];

    const missingScopes = requiredScopes.filter((s) => !scopes.includes(s));
    if (missingScopes.length > 0) {
      result.errors.push(
        `Missing required scopes: ${missingScopes.join(", ")}`
      );
    }

    result.info.scopes = scopes;

    // Test API access - list domains
    const domainsRes = await fetch(ApiEndpoint.Google.Domains, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!domainsRes.ok) {
      result.errors.push(
        `Domains API test failed: ${domainsRes.status} ${domainsRes.statusText}`
      );
      const errorBody = await domainsRes.text();
      result.info.domainsError = errorBody.substring(0, 500);
      return result;
    }

    const domainsData = (await domainsRes.json()) as {
      domains?: Array<{ domainName: string; verified: boolean }>;
    };
    result.info.domains = domainsData.domains;

    // Test Cloud Identity API access - list SAML profiles
    const samlRes = await fetch(ApiEndpoint.Google.SsoProfiles, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!samlRes.ok) {
      result.warnings.push(
        `SAML profiles API test failed: ${samlRes.status} ${samlRes.statusText}`
      );
      const errorBody = await samlRes.text();
      result.info.samlError = errorBody.substring(0, 500);
    } else {
      const samlData = (await samlRes.json()) as {
        inboundSamlSsoProfiles?: Array<{ name: string; displayName: string }>;
      };
      result.info.samlProfiles = samlData.inboundSamlSsoProfiles;
    }

    // Test OrgUnits API access
    const ouRes = await fetch(`${ApiEndpoint.Google.OrgUnits}?type=all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!ouRes.ok) {
      result.errors.push(
        `OrgUnits API test failed: ${ouRes.status} ${ouRes.statusText}`
      );
      const errorBody = await ouRes.text();
      result.info.ouError = errorBody.substring(0, 500);
    } else {
      const ouData = (await ouRes.json()) as {
        organizationUnits?: Array<{ orgUnitPath: string }>;
      };
      result.info.orgUnitsCount = ouData.organizationUnits?.length || 0;
    }

    // All critical tests passed
    if (result.errors.length === 0) {
      result.valid = true;
    }
  } catch (error) {
    result.errors.push(
      `Exception during validation: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

async function validateMicrosoftToken(
  token: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    provider: "Microsoft",
    valid: false,
    errors: [],
    warnings: [],
    info: {}
  };

  try {
    // Test organization endpoint
    const orgRes = await fetch(ApiEndpoint.Microsoft.Organization, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!orgRes.ok) {
      result.errors.push(
        `Organization API test failed: ${orgRes.status} ${orgRes.statusText}`
      );
      const errorBody = await orgRes.text();
      result.info.orgError = errorBody.substring(0, 500);
      return result;
    }

    const orgData = (await orgRes.json()) as {
      value?: Array<{ displayName: string; verifiedDomains: unknown[] }>;
    };
    result.info.organization = orgData.value?.[0];

    // Test me endpoint to get token info
    const meRes = await fetch(ApiEndpoint.Microsoft.Me, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (meRes.ok) {
      const meData = await meRes.json();
      result.info.user = meData;
    } else {
      result.warnings.push(
        `Me API test failed: ${meRes.status} ${meRes.statusText}`
      );
    }

    // Test applications endpoint
    const appsRes = await fetch(
      `${ApiEndpoint.Microsoft.Applications}?$top=1`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!appsRes.ok) {
      result.errors.push(
        `Applications API test failed: ${appsRes.status} ${appsRes.statusText}`
      );
      const errorBody = await appsRes.text();
      result.info.appsError = errorBody.substring(0, 500);
    } else {
      const appsData = (await appsRes.json()) as { value?: unknown[] };
      result.info.applicationsAccessible = true;
      result.info.applicationCount = appsData.value?.length || 0;
    }

    // Test service principals endpoint
    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$top=1`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!spRes.ok) {
      result.errors.push(
        `Service Principals API test failed: ${spRes.status} ${spRes.statusText}`
      );
      const errorBody = await spRes.text();
      result.info.spError = errorBody.substring(0, 500);
    } else {
      result.info.servicePrincipalsAccessible = true;
    }

    // Test claims policies endpoint (beta)
    const policiesRes = await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!policiesRes.ok) {
      result.warnings.push(
        `Claims Policies API test failed: ${policiesRes.status} ${policiesRes.statusText}`
      );
      const errorBody = await policiesRes.text();
      result.info.policiesError = errorBody.substring(0, 500);
    } else {
      result.info.claimsPoliciesAccessible = true;
    }

    // All critical tests passed
    if (result.errors.length === 0) {
      result.valid = true;
    }
  } catch (error) {
    result.errors.push(
      `Exception during validation: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

async function main() {
  console.log("🔍 Validating Test Credentials\n");
  console.log("=" .repeat(60));

  // Load tokens
  let googleToken: string | undefined;
  let msToken: string | undefined;

  if (process.env.TEST_GOOGLE_BEARER_TOKEN) {
    googleToken = process.env.TEST_GOOGLE_BEARER_TOKEN;
    console.log("✓ Google token loaded from environment");
  } else if (existsSync("./google_bearer.token")) {
    googleToken = readFileSync("./google_bearer.token", "utf8").trim();
    console.log("✓ Google token loaded from file");
  } else {
    console.log("✗ Google token not found");
  }

  if (process.env.TEST_MS_BEARER_TOKEN) {
    msToken = process.env.TEST_MS_BEARER_TOKEN;
    console.log("✓ Microsoft token loaded from environment");
  } else if (existsSync("./microsoft_bearer.token")) {
    msToken = readFileSync("./microsoft_bearer.token", "utf8").trim();
    console.log("✓ Microsoft token loaded from file");
  } else {
    console.log("✗ Microsoft token not found");
  }

  console.log("=" .repeat(60));
  console.log();

  // Validate Google token
  if (googleToken) {
    console.log("📋 Validating Google Workspace Credentials\n");
    const googleResult = await validateGoogleToken(googleToken);

    console.log(`Status: ${googleResult.valid ? "✅ VALID" : "❌ INVALID"}\n`);

    if (googleResult.errors.length > 0) {
      console.log("Errors:");
      for (const error of googleResult.errors) {
        console.log(`  ❌ ${error}`);
      }
      console.log();
    }

    if (googleResult.warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of googleResult.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
      console.log();
    }

    console.log("Details:");
    console.log(JSON.stringify(googleResult.info, null, 2));
    console.log("\n" + "=".repeat(60) + "\n");
  } else {
    console.log("⏭️  Skipping Google validation (no token)\n");
  }

  // Validate Microsoft token
  if (msToken) {
    console.log("📋 Validating Microsoft Graph Credentials\n");
    const msResult = await validateMicrosoftToken(msToken);

    console.log(`Status: ${msResult.valid ? "✅ VALID" : "❌ INVALID"}\n`);

    if (msResult.errors.length > 0) {
      console.log("Errors:");
      for (const error of msResult.errors) {
        console.log(`  ❌ ${error}`);
      }
      console.log();
    }

    if (msResult.warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of msResult.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
      console.log();
    }

    console.log("Details:");
    console.log(JSON.stringify(msResult.info, null, 2));
    console.log("\n" + "=".repeat(60) + "\n");
  } else {
    console.log("⏭️  Skipping Microsoft validation (no token)\n");
  }

  // Summary
  console.log("📊 Summary\n");

  if (!googleToken && !msToken) {
    console.log("❌ No tokens found. E2E tests cannot run.");
    console.log("\nTo set up test credentials:");
    console.log("1. Create google_bearer.token with a valid Google access token");
    console.log(
      "2. Create microsoft_bearer.token with a valid Microsoft access token"
    );
    console.log(
      "3. Ensure tokens have required scopes/permissions (see api-contracts-analysis.md)"
    );
    process.exitCode = 1;
    return;
  }

  const allValid =
    (!googleToken || (await validateGoogleToken(googleToken)).valid)
    && (!msToken || (await validateMicrosoftToken(msToken)).valid);

  if (allValid) {
    console.log("✅ All available credentials are valid");
    console.log("✅ E2E tests should be able to run");
    console.log(
      "\nRun tests with: pnpm test test/e2e/workflow.test.ts"
    );
    console.log("Or use: ./test-live.sh");
  } else {
    console.log("❌ Some credentials are invalid");
    console.log("❌ E2E tests may fail");
    console.log(
      "\nReview errors above and update tokens with proper scopes/permissions"
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
