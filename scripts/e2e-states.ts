/**
 * Creates specific test states for each step
 */

import { ApiEndpoint, SyncTemplateTag, TemplateId } from "@/constants";
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
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "TempPassword123!";

export async function createGoogleUser(body: Record<string, unknown>) {
  await fetch(ApiEndpoint.Google.Users, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GOOGLE_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function createMicrosoftApp(templateId: string) {
  await fetch(ApiEndpoint.Microsoft.Templates(templateId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ displayName: "Temp" })
  });
}

async function createClaimsPolicy(body: Record<string, unknown>) {
  await fetch(ApiEndpoint.Microsoft.ClaimsPolicies, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function createPartiallyCompletedState(step: string) {
  switch (step) {
    case "create-service-user":
      await createGoogleUser({
        primaryEmail: `azuread-provisioning@${TEST_DOMAIN}`,
        name: { givenName: "Test", familyName: "User" },
        password: TEST_USER_PASSWORD,
        orgUnitPath: "/"
      });
      break;
    case "setup-microsoft-provisioning":
    case "configure-microsoft-sso":
      await createMicrosoftApp(TemplateId.GoogleWorkspaceConnector);
      await createMicrosoftApp(TemplateId.GoogleWorkspaceSaml);
      break;
    case "setup-microsoft-claims-policy":
      await createClaimsPolicy({
        displayName: "Google Workspace Basic Claims",
        definition: ['{"ClaimsMappingPolicy":{"Version":1}}'],
        isOrganizationDefault: false
      });
      break;
  }
}

async function getProvisioningServicePrincipalId() {
  const filter = encodeURIComponent(
    `displayName eq 'Google Workspace Provisioning'`
  );
  const res = await fetch(
    `${ApiEndpoint.Microsoft.ServicePrincipals}?$filter=${filter}`,
    { headers: { Authorization: `Bearer ${MS_TOKEN}` } }
  );
  const json = (await res.json()) as { value: Array<{ id: string }> };
  return json.value[0]?.id;
}

async function createSyncJob(spId: string, templateId: string) {
  await fetch(ApiEndpoint.Microsoft.SyncJobs(spId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ templateId })
  });
}

async function getSyncTemplateId(spId: string, tag: string) {
  const res = await fetch(ApiEndpoint.Microsoft.SyncTemplates(spId), {
    headers: { Authorization: `Bearer ${MS_TOKEN}` }
  });
  const json = (await res.json()) as {
    value: Array<{ id: string; factoryTag: string }>;
  };
  return json.value.find((template) => template.factoryTag === tag)?.id ?? tag;
}

async function setSyncJobToQuarantine(spId: string) {
  await fetch(`${ApiEndpoint.Microsoft.Synchronization(spId)}/jobs/Initial`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${MS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status: { code: "Quarantine" } })
  });
}

async function createSsoAssignment(body: Record<string, unknown>) {
  await fetch(ApiEndpoint.Google.SsoAssignments, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GOOGLE_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function createErrorState(step: string) {
  switch (step) {
    case "setup-microsoft-provisioning": {
      const spId = await getProvisioningServicePrincipalId();
      if (spId) {
        const templateId = await getSyncTemplateId(
          spId,
          SyncTemplateTag.GoogleWorkspace
        );
        await createSyncJob(spId, templateId);
        await setSyncJobToQuarantine(spId);
      }
      break;
    }
    case "assign-users-to-sso":
      await createSsoAssignment({
        targetOrgUnit: "/",
        samlSsoInfo: { inboundSamlSsoProfile: "different-profile" },
        ssoMode: "SSO_OFF"
      });
      break;
  }
}
