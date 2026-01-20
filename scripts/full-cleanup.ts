/**
 * Removes Microsoft Entra applications, claims policies and Google SSO
 * assignments left over from previous tests. Existing service credentials
 * remain untouched.
 *
 * Run with: bun x tsx scripts/full-cleanup.ts
 */

import { z } from "zod";

import { ApiEndpoint } from "@/constants";

const GOOGLE_TOKEN = process.env.TEST_GOOGLE_BEARER_TOKEN;
const MS_TOKEN = process.env.TEST_MS_BEARER_TOKEN;

const DEFAULT_PROVISIONING_EMAIL =
  "testing@proven-audio-462619-h2.iam.gserviceaccount.com";
const DEFAULT_MS_APP_IDS = [
  "28f2e988-0021-4521-b215-202dc300de38",
  "da8790bf-7b6d-457d-9f8d-a3c073b97070",
];
const PROVISIONING_EMAIL =
  process.env.PROVISIONING_EMAIL || DEFAULT_PROVISIONING_EMAIL;
const KEEP_MS_APP_IDS = new Set(
  new Set(
    [
      ...DEFAULT_MS_APP_IDS,
      process.env.MICROSOFT_OAUTH_CLIENT_ID,
      process.env.TEST_MS_CLIENT_ID,
      ...(process.env.KEEP_MS_APP_IDS || "").split(","),
    ].filter(Boolean)
  )
);
const SSO_ASSIGNMENT_ID_PATTERN = /^(?:.*\/)?inboundSsoAssignments\//;

/**
 * Delete inbound SSO assignments from Google.
 */
async function cleanupGoogleAssignments() {
  console.log("🧹 Cleaning up Google SSO assignments...");

  const AssignSchema = z.object({
    inboundSsoAssignments: z.array(z.object({ name: z.string() })).optional(),
  });

  const res = await fetch(ApiEndpoint.Google.SsoAssignments, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
  });
  const { inboundSsoAssignments = [] } = AssignSchema.parse(await res.json());

  for (const assign of inboundSsoAssignments) {
    const id = assign.name.replace(SSO_ASSIGNMENT_ID_PATTERN, "");
    await fetch(
      `${ApiEndpoint.Google.SsoAssignments}/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
        method: "DELETE",
      }
    );
  }

  console.log("✅ Google assignments removed");
}

/**
 * Fetch Google admin roles with pagination.
 */
async function fetchGoogleRoles(pageToken?: string) {
  const url = new URL(ApiEndpoint.Google.Roles);
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
  });
  const RolesSchema = z.object({
    items: z
      .array(z.object({ roleId: z.string(), roleName: z.string() }))
      .optional(),
    nextPageToken: z.string().optional(),
  });
  return RolesSchema.parse(await res.json());
}

/**
 * Fetch role assignments for a specific role.
 */
async function fetchRoleAssignments(roleId: string, pageToken?: string) {
  const assignUrl = new URL(ApiEndpoint.Google.RoleAssignments);
  assignUrl.searchParams.set("roleId", roleId);
  if (pageToken) {
    assignUrl.searchParams.set("pageToken", pageToken);
  }
  const AssignSchema = z.object({
    items: z
      .array(z.object({ roleAssignmentId: z.string(), roleId: z.string() }))
      .optional(),
    nextPageToken: z.string().optional(),
  });
  const aRes = await fetch(assignUrl, {
    headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
  });
  return AssignSchema.parse(await aRes.json());
}

/**
 * Remove role assignments by ID.
 */
async function removeRoleAssignments(
  assignments: { roleAssignmentId: string }[]
) {
  for (const assignment of assignments) {
    await fetch(
      `${ApiEndpoint.Google.RoleAssignments}/${assignment.roleAssignmentId}`,
      {
        headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
        method: "DELETE",
      }
    );
  }
}

/**
 * Remove role assignments for the provisioning account.
 */
async function removeUserRoleAssignments(roleId: string) {
  const userRes = await fetch(
    `${ApiEndpoint.Google.RoleAssignments}?userKey=${encodeURIComponent(PROVISIONING_EMAIL)}`,
    { headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` } }
  );
  const AssignSchema = z.object({
    items: z
      .array(z.object({ roleAssignmentId: z.string(), roleId: z.string() }))
      .optional(),
  });
  const { items: userAssignments = [] } = AssignSchema.parse(
    await userRes.json()
  );
  for (const userAssignment of userAssignments) {
    if (userAssignment.roleId === roleId) {
      await fetch(
        `${ApiEndpoint.Google.RoleAssignments}/${userAssignment.roleAssignmentId}`,
        {
          headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
          method: "DELETE",
        }
      );
    }
  }
}

/**
 * Remove custom Google admin roles created in tests.
 */
async function cleanupGoogleRoles() {
  console.log("🧹 Cleaning up Google admin roles...");

  let pageToken: string | undefined;
  do {
    const { items = [], nextPageToken } = await fetchGoogleRoles(pageToken);
    pageToken = nextPageToken;
    for (const role of items) {
      if (
        role.roleName !== "Microsoft Entra Provisioning" &&
        !role.roleName.startsWith("TempRole")
      ) {
        continue;
      }
      let assignToken: string | undefined;
      do {
        const { items: assignments = [], nextPageToken: nextAssign } =
          await fetchRoleAssignments(role.roleId, assignToken);
        assignToken = nextAssign;
        await removeRoleAssignments(assignments);
      } while (assignToken);
      await removeUserRoleAssignments(role.roleId);
      await fetch(`${ApiEndpoint.Google.Roles}/${role.roleId}`, {
        headers: { Authorization: `Bearer ${GOOGLE_TOKEN}` },
        method: "DELETE",
      });
    }
  } while (pageToken);

  console.log("✅ Google roles removed");
}

/**
 * Delete Microsoft apps and related service principals.
 */
async function cleanupMicrosoftApps() {
  console.log("\uD83E\uDDF9 Cleaning up Microsoft applications...");

  const AppsSchema = z.object({
    value: z.array(z.object({ appId: z.string(), id: z.string() })),
  });

  const appsRes = await fetch(ApiEndpoint.Microsoft.Applications, {
    headers: { Authorization: `Bearer ${MS_TOKEN}` },
  });
  const { value = [] } = AppsSchema.parse(await appsRes.json());

  const ServicePrincipalSchema = z.object({
    value: z.array(z.object({ id: z.string() })).optional(),
  });
  const PoliciesSchema = z.object({
    value: z.array(z.object({ id: z.string() })).optional(),
  });

  for (const app of value) {
    if (KEEP_MS_APP_IDS.has(app.appId)) {
      continue;
    }

    const spRes = await fetch(
      `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=appId eq '${app.appId}'`,
      { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
    );
    const sps = ServicePrincipalSchema.parse(await spRes.json());
    for (const sp of sps.value ?? []) {
      const policiesRes = await fetch(
        ApiEndpoint.Microsoft.ReadClaimsPolicy(sp.id),
        { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
      );
      const policies = PoliciesSchema.parse(await policiesRes.json());
      for (const policy of policies.value ?? []) {
        await fetch(
          ApiEndpoint.Microsoft.UnassignClaimsPolicy(sp.id, policy.id),
          {
            headers: { Authorization: `Bearer ${MS_TOKEN}` },
            method: "DELETE",
          }
        );
      }

      await fetch(`${ApiEndpoint.Microsoft.ServicePrincipals}/${sp.id}`, {
        headers: { Authorization: `Bearer ${MS_TOKEN}` },
        method: "DELETE",
      });
    }

    await fetch(`${ApiEndpoint.Microsoft.Applications}/${app.id}`, {
      headers: { Authorization: `Bearer ${MS_TOKEN}` },
      method: "DELETE",
    });
  }

  console.log("\u2705 Microsoft applications removed");
}

/**
 * Remove Microsoft claims policies.
 */
async function cleanupClaimsPolicies() {
  console.log("\uD83E\uDDF9 Removing Microsoft claims policies...");

  const PoliciesSchema = z.object({
    value: z.array(z.object({ id: z.string() })),
  });
  const res = await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
    headers: { Authorization: `Bearer ${MS_TOKEN}` },
  });
  const { value = [] } = PoliciesSchema.parse(await res.json());

  for (const policy of value) {
    await fetch(`${ApiEndpoint.Microsoft.ClaimsPolicies}/${policy.id}`, {
      headers: { Authorization: `Bearer ${MS_TOKEN}` },
      method: "DELETE",
    });
  }

  console.log("\u2705 Claims policies removed");
}

/**
 * Run full cleanup across Google and Microsoft tenants.
 */
export async function fullCleanup() {
  await cleanupGoogleAssignments();
  await cleanupGoogleRoles();
  await cleanupMicrosoftApps();
  await cleanupClaimsPolicies();
  console.log("\uD83C\uDF89 Cleanup complete");
}

if (require.main === module) {
  fullCleanup().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
