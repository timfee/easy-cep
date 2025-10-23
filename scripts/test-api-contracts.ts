/**
 * Comprehensive E2E API Contract Test
 * Tests each API endpoint used in the workflow to verify contracts
 * Run with: pnpm tsx scripts/test-api-contracts.ts
 */

import { ApiEndpoint, SyncTemplateTag, TemplateId } from "@/constants";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fetch, ProxyAgent, setGlobalDispatcher } from "undici";

// Configure proxy if needed
if (process.env.USE_UNDICI_PROXY !== "false") {
  const proxy = process.env.https_proxy ?? process.env.http_proxy;
  if (proxy) {
    setGlobalDispatcher(new ProxyAgent({ uri: proxy }));
  }
}

interface TestResult {
  step: string;
  endpoint: string;
  method: string;
  status: "pass" | "fail" | "skip" | "warn";
  message: string;
  details?: unknown;
  duration?: number;
}

const results: TestResult[] = [];

function addResult(result: TestResult) {
  results.push(result);
  const icon =
    result.status === "pass" ? "✅"
    : result.status === "fail" ? "❌"
    : result.status === "warn" ? "⚠️"
    : "⏭️";
  console.log(`${icon} [${result.step}] ${result.message}`);
  if (result.details) {
    console.log(`   Details: ${JSON.stringify(result.details).substring(0, 200)}`);
  }
}

async function testGoogleDomains(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(ApiEndpoint.Google.Domains, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      addResult({
        step: "Google Domains",
        endpoint: ApiEndpoint.Google.Domains,
        method: "GET",
        status: "fail",
        message: `Failed to list domains: ${res.status} ${res.statusText}`,
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      domains?: Array<{ domainName: string; verified: boolean; isPrimary?: boolean }>;
    };

    const primaryDomain = data.domains?.find((d) => d.isPrimary);
    const verifiedDomains = data.domains?.filter((d) => d.verified) || [];

    if (!primaryDomain) {
      addResult({
        step: "Google Domains",
        endpoint: ApiEndpoint.Google.Domains,
        method: "GET",
        status: "warn",
        message: "No primary domain found",
        details: { domains: data.domains },
        duration: Date.now() - start
      });
    } else if (!primaryDomain.verified) {
      addResult({
        step: "Google Domains",
        endpoint: ApiEndpoint.Google.Domains,
        method: "GET",
        status: "fail",
        message: "Primary domain is not verified",
        details: { primaryDomain },
        duration: Date.now() - start
      });
    } else {
      addResult({
        step: "Google Domains",
        endpoint: ApiEndpoint.Google.Domains,
        method: "GET",
        status: "pass",
        message: `Found ${verifiedDomains.length} verified domain(s)`,
        details: { primaryDomain: primaryDomain.domainName },
        duration: Date.now() - start
      });
    }
  } catch (error) {
    addResult({
      step: "Google Domains",
      endpoint: ApiEndpoint.Google.Domains,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testGoogleOrgUnits(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(`${ApiEndpoint.Google.OrgUnits}?type=all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      addResult({
        step: "Google OrgUnits",
        endpoint: ApiEndpoint.Google.OrgUnits,
        method: "GET",
        status: "fail",
        message: `Failed to list OUs: ${res.status} ${res.statusText}`,
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      organizationUnits?: Array<{ orgUnitPath: string; name: string }>;
    };

    addResult({
      step: "Google OrgUnits",
      endpoint: ApiEndpoint.Google.OrgUnits,
      method: "GET",
      status: "pass",
      message: `Found ${data.organizationUnits?.length || 0} organizational unit(s)`,
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Google OrgUnits",
      endpoint: ApiEndpoint.Google.OrgUnits,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testGoogleRoles(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(ApiEndpoint.Google.Roles, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      addResult({
        step: "Google Roles",
        endpoint: ApiEndpoint.Google.Roles,
        method: "GET",
        status: "fail",
        message: `Failed to list roles: ${res.status} ${res.statusText}`,
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      items?: Array<{ roleName: string; roleId: string }>;
    };

    addResult({
      step: "Google Roles",
      endpoint: ApiEndpoint.Google.Roles,
      method: "GET",
      status: "pass",
      message: `Found ${data.items?.length || 0} role(s)`,
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Google Roles",
      endpoint: ApiEndpoint.Google.Roles,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testGoogleSamlProfiles(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(ApiEndpoint.Google.SsoProfiles, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      addResult({
        step: "Google SAML Profiles",
        endpoint: ApiEndpoint.Google.SsoProfiles,
        method: "GET",
        status: "fail",
        message: `Failed to list SAML profiles: ${res.status} ${res.statusText}`,
        details: { errorBody: (await res.text()).substring(0, 300) },
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      inboundSamlSsoProfiles?: Array<{ name: string; displayName: string }>;
    };

    addResult({
      step: "Google SAML Profiles",
      endpoint: ApiEndpoint.Google.SsoProfiles,
      method: "GET",
      status: "pass",
      message: `Found ${data.inboundSamlSsoProfiles?.length || 0} SAML profile(s)`,
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Google SAML Profiles",
      endpoint: ApiEndpoint.Google.SsoProfiles,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testMicrosoftOrganization(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(ApiEndpoint.Microsoft.Organization, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      addResult({
        step: "Microsoft Organization",
        endpoint: ApiEndpoint.Microsoft.Organization,
        method: "GET",
        status: "fail",
        message: `Failed to get organization: ${res.status} ${res.statusText}`,
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      value?: Array<{
        displayName: string;
        verifiedDomains: Array<{ name: string }>;
      }>;
    };

    const org = data.value?.[0];
    addResult({
      step: "Microsoft Organization",
      endpoint: ApiEndpoint.Microsoft.Organization,
      method: "GET",
      status: "pass",
      message: `Organization: ${org?.displayName || "Unknown"}`,
      details: {
        domains: org?.verifiedDomains?.map((d) => d.name)
      },
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Microsoft Organization",
      endpoint: ApiEndpoint.Microsoft.Organization,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testMicrosoftApplications(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(
      `${ApiEndpoint.Microsoft.Applications}?$top=5&$filter=startswith(displayName,'Test ')`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) {
      addResult({
        step: "Microsoft Applications",
        endpoint: ApiEndpoint.Microsoft.Applications,
        method: "GET",
        status: "fail",
        message: `Failed to list applications: ${res.status} ${res.statusText}`,
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      value?: Array<{ displayName: string; appId: string }>;
    };

    addResult({
      step: "Microsoft Applications",
      endpoint: ApiEndpoint.Microsoft.Applications,
      method: "GET",
      status: "pass",
      message: `Found ${data.value?.length || 0} test application(s)`,
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Microsoft Applications",
      endpoint: ApiEndpoint.Microsoft.Applications,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testMicrosoftServicePrincipals(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$top=5`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) {
      addResult({
        step: "Microsoft Service Principals",
        endpoint: ApiEndpoint.Microsoft.ServicePrincipals,
        method: "GET",
        status: "fail",
        message: `Failed to list service principals: ${res.status} ${res.statusText}`,
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      value?: Array<{ displayName: string; appId: string }>;
    };

    addResult({
      step: "Microsoft Service Principals",
      endpoint: ApiEndpoint.Microsoft.ServicePrincipals,
      method: "GET",
      status: "pass",
      message: `Found ${data.value?.length || 0} service principal(s)`,
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Microsoft Service Principals",
      endpoint: ApiEndpoint.Microsoft.ServicePrincipals,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testMicrosoftClaimsPolicies(token: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      addResult({
        step: "Microsoft Claims Policies",
        endpoint: ApiEndpoint.Microsoft.ClaimsPolicies,
        method: "GET",
        status: "warn",
        message: `Failed to list claims policies: ${res.status} ${res.statusText}`,
        details: { note: "Beta endpoint may not be available in all tenants" },
        duration: Date.now() - start
      });
      return;
    }

    const data = (await res.json()) as {
      value?: Array<{ displayName: string; id: string }>;
    };

    addResult({
      step: "Microsoft Claims Policies",
      endpoint: ApiEndpoint.Microsoft.ClaimsPolicies,
      method: "GET",
      status: "pass",
      message: `Found ${data.value?.length || 0} claims policy(ies)`,
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Microsoft Claims Policies",
      endpoint: ApiEndpoint.Microsoft.ClaimsPolicies,
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function testGoogleWorkspaceTemplateAccess(token: string): Promise<void> {
  const start = Date.now();
  try {
    // We can't actually instantiate without creating a real app, so we just
    // check if the endpoint is accessible by trying to get it
    const templateId = TemplateId.GoogleWorkspaceConnector;
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/applicationTemplates/${templateId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) {
      addResult({
        step: "Microsoft Template Access",
        endpoint: "applicationTemplates",
        method: "GET",
        status: "warn",
        message: `Template endpoint returned: ${res.status} ${res.statusText}`,
        details: { templateId },
        duration: Date.now() - start
      });
      return;
    }

    const data = await res.json();
    addResult({
      step: "Microsoft Template Access",
      endpoint: "applicationTemplates",
      method: "GET",
      status: "pass",
      message: "Google Workspace template is accessible",
      details: { displayName: (data as any).displayName },
      duration: Date.now() - start
    });
  } catch (error) {
    addResult({
      step: "Microsoft Template Access",
      endpoint: "applicationTemplates",
      method: "GET",
      status: "fail",
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start
    });
  }
}

async function main() {
  console.log("🧪 API Contract Testing\n");
  console.log("=" .repeat(80));
  console.log();

  // Load tokens
  let googleToken: string | undefined;
  let msToken: string | undefined;

  if (process.env.TEST_GOOGLE_BEARER_TOKEN) {
    googleToken = process.env.TEST_GOOGLE_BEARER_TOKEN;
  } else if (existsSync("./google_bearer.token")) {
    googleToken = readFileSync("./google_bearer.token", "utf8").trim();
  }

  if (process.env.TEST_MS_BEARER_TOKEN) {
    msToken = process.env.TEST_MS_BEARER_TOKEN;
  } else if (existsSync("./microsoft_bearer.token")) {
    msToken = readFileSync("./microsoft_bearer.token", "utf8").trim();
  }

  if (!googleToken && !msToken) {
    console.log("❌ No tokens found. Cannot run API contract tests.");
    console.log(
      "\nEnsure google_bearer.token and/or microsoft_bearer.token exist."
    );
    process.exitCode = 1;
    return;
  }

  console.log("📋 Testing Google Workspace APIs\n");
  if (googleToken) {
    await testGoogleDomains(googleToken);
    await testGoogleOrgUnits(googleToken);
    await testGoogleRoles(googleToken);
    await testGoogleSamlProfiles(googleToken);
  } else {
    console.log("⏭️  Skipping Google tests (no token)\n");
  }

  console.log("\n" + "=".repeat(80) + "\n");
  console.log("📋 Testing Microsoft Graph APIs\n");

  if (msToken) {
    await testMicrosoftOrganization(msToken);
    await testMicrosoftApplications(msToken);
    await testMicrosoftServicePrincipals(msToken);
    await testMicrosoftClaimsPolicies(msToken);
    await testGoogleWorkspaceTemplateAccess(msToken);
  } else {
    console.log("⏭️  Skipping Microsoft tests (no token)\n");
  }

  console.log("\n" + "=".repeat(80) + "\n");
  console.log("📊 Test Results Summary\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  console.log(`✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⚠️  Warned:  ${warned}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log();

  // Write detailed results to file
  const reportPath = "./api-contract-test-results.json";
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Detailed results written to: ${reportPath}`);

  // Write markdown report
  const mdReport = generateMarkdownReport(results);
  const mdPath = "./api-contract-test-results.md";
  writeFileSync(mdPath, mdReport);
  console.log(`📄 Markdown report written to: ${mdPath}`);

  if (failed > 0) {
    console.log("\n❌ Some tests failed. Review results above.");
    process.exitCode = 1;
  } else {
    console.log("\n✅ All critical tests passed!");
  }
}

function generateMarkdownReport(results: TestResult[]): string {
  const lines: string[] = [];

  lines.push("# API Contract Test Results");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(`- ✅ Passed: ${results.filter((r) => r.status === "pass").length}`);
  lines.push(`- ❌ Failed: ${results.filter((r) => r.status === "fail").length}`);
  lines.push(`- ⚠️  Warned: ${results.filter((r) => r.status === "warn").length}`);
  lines.push(`- ⏭️  Skipped: ${results.filter((r) => r.status === "skip").length}`);
  lines.push("");

  lines.push("## Test Details");
  lines.push("");

  for (const result of results) {
    const icon =
      result.status === "pass" ? "✅"
      : result.status === "fail" ? "❌"
      : result.status === "warn" ? "⚠️"
      : "⏭️";

    lines.push(`### ${icon} ${result.step}`);
    lines.push("");
    lines.push(`- **Endpoint**: \`${result.endpoint}\``);
    lines.push(`- **Method**: ${result.method}`);
    lines.push(`- **Status**: ${result.status.toUpperCase()}`);
    lines.push(`- **Message**: ${result.message}`);
    if (result.duration !== undefined) {
      lines.push(`- **Duration**: ${result.duration}ms`);
    }
    if (result.details) {
      lines.push("");
      lines.push("**Details:**");
      lines.push("```json");
      lines.push(JSON.stringify(result.details, null, 2));
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
