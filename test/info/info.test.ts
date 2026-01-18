import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Token } from "@/lib/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token: Token = {
  accessToken: "tok",
  refreshToken: "",
  expiresAt: 0,
  scope: [],
};

mock.module("@/lib/auth", () => ({
  refreshTokenIfNeeded: mock(() => Promise.resolve(token)),
}));

let listOrgUnits: typeof import("@/lib/info").listOrgUnits;
let listSamlProfiles: typeof import("@/lib/info").listSamlProfiles;
let listSsoAssignments: typeof import("@/lib/info").listSsoAssignments;
let listProvisioningJobs: typeof import("@/lib/info").listProvisioningJobs;
let listClaimsPolicies: typeof import("@/lib/info").listClaimsPolicies;
let listEnterpriseApps: typeof import("@/lib/info").listEnterpriseApps;

beforeAll(async () => {
  const mod = await import("@/lib/info");
  listOrgUnits = mod.listOrgUnits;
  listSamlProfiles = mod.listSamlProfiles;
  listSsoAssignments = mod.listSsoAssignments;
  listProvisioningJobs = mod.listProvisioningJobs;
  listClaimsPolicies = mod.listClaimsPolicies;
  listEnterpriseApps = mod.listEnterpriseApps;
});

function load(name: string) {
  const filePath = path.join(__dirname, "fixtures", name);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("info server actions", () => {
  const originalFetch = global.fetch;

  const setFetchMock = (fetchMock: ReturnType<typeof mock>) => {
    const withPreconnect = Object.assign(fetchMock, { preconnect: mock() });
    const mockFetch = ((...args: Parameters<typeof fetch>) =>
      (withPreconnect as (...callArgs: Parameters<typeof fetch>) => unknown)(
        ...args
      )) as unknown as typeof fetch;
    mockFetch.preconnect = withPreconnect.preconnect;
    global.fetch = mockFetch;
  };

  afterEach(() => {
    mock.restore();
    global.fetch = originalFetch;
  });

  test("listOrgUnits", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => load("google-org-units.json"),
      })
    );
    setFetchMock(fetchMock);
    const items = await listOrgUnits();
    expect(items).toEqual([
      {
        id: "id:123",
        label: "/Automation",
        href: "https://admin.google.com/ac/orgunits",
        deletable: true,
        deleteEndpoint:
          "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation",
      },
    ]);
  });

  test("listSamlProfiles", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => load("google-saml-profiles.json"),
      })
    );
    setFetchMock(fetchMock);
    const items = await listSamlProfiles();
    expect(items).toEqual([
      {
        id: "samlProfiles/abc123",
        label: "Workspace SAML",
        href: "https://admin.google.com/ac/security/sso/sso-profiles/samlProfiles%2Fabc123",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/samlProfiles/abc123",
      },
    ]);
  });

  test("listSsoAssignments", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => load("google-sso-assignments.json"),
      })
    );
    setFetchMock(fetchMock);
    const items = await listSsoAssignments();
    expect(items).toEqual([
      {
        id: "root",
        label: "orgUnits/03ph8a2z23yjui6",
        subLabel: "SAML_SSO",
        href: "https://admin.google.com/ac/security/sso",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/root",
      },
      {
        id: "automation",
        label: "orgUnits/03ph8a2z1s3ovsg",
        subLabel: "SSO_OFF",
        href: "https://admin.google.com/ac/security/sso",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/automation",
      },
    ]);
  });

  test("listSsoAssignments handles prefixed names", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => load("google-sso-assignments-prefixed.json"),
      })
    );
    setFetchMock(fetchMock);
    const items = await listSsoAssignments();
    expect(items).toEqual([
      {
        id: "abc123",
        label: "orgUnits/03ph8a2z23yjui6",
        subLabel: "SSO_OFF",
        href: "https://admin.google.com/ac/security/sso",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/abc123",
      },
    ]);
  });

  test("listProvisioningJobs", async () => {
    const fetchMock = mock()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: "sp1", appId: "abcd1234" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => load("ms-sync-jobs.json"),
      });
    setFetchMock(fetchMock);
    const items = await listProvisioningJobs();
    expect(items).toEqual([
      {
        id: "Initial",
        label: "gsuite",
        subLabel: "Active",
        href: "https://portal.azure.com/#view/Microsoft_AAD_Connect_Provisioning/ProvisioningMenuBlade/~/Overview/objectId/sp1/appId/abcd1234",
        deletable: true,
        deleteEndpoint:
          "https://graph.microsoft.com/v1.0/servicePrincipals/sp1/synchronization/jobs/Initial",
      },
    ]);
  });

  test("listClaimsPolicies", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => load("ms-claims-policies.json"),
      })
    );
    setFetchMock(fetchMock);
    const items = await listClaimsPolicies();
    expect(items).toEqual([
      {
        id: "policy123",
        label: "Google Workspace Claims",
        href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview",
        deletable: true,
        deleteEndpoint:
          "https://graph.microsoft.com/beta/policies/claimsMappingPolicies/policy123",
      },
    ]);
  });

  test("listEnterpriseApps", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => load("ms-applications.json"),
      })
    );
    setFetchMock(fetchMock);
    const items = await listEnterpriseApps();
    expect(items).toEqual([
      {
        id: "app1",
        label: "Google Workspace Provisioning",
        href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/SignOn/objectId/app1/appId/abcd1234/preferredSingleSignOnMode~/null/servicePrincipalType/Application/fromNav/",
        deletable: true,
        deleteEndpoint: "https://graph.microsoft.com/beta/applications/app1",
      },
    ]);
  });
});
