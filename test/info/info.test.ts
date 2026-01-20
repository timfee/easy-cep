import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Token } from "@/lib/auth";
import type { DeleteResult } from "@/lib/workflow/info-actions";
import type * as Info from "@/lib/info";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token: Token = {
  accessToken: "tok",
  expiresAt: 0,
  refreshToken: "",
  scope: [],
};

let listOrgUnits: typeof Info.listOrgUnits;
let listSamlProfiles: typeof Info.listSamlProfiles;
let listSsoAssignments: typeof Info.listSsoAssignments;
let listProvisioningJobs: typeof Info.listProvisioningJobs;
let listClaimsPolicies: typeof Info.listClaimsPolicies;
let listEnterpriseApps: typeof Info.listEnterpriseApps;
let deleteGoogleRoles: (ids: string[]) => Promise<DeleteResult>;

beforeAll(async () => {
  mock.module("@/lib/auth", () => ({
    refreshTokenIfNeeded: mock(() => token),
  }));
  mock.module("@/env", () => ({
    env: {
      ALLOW_INFO_PURGE: true,
    },
  }));
  const mod = await import("@/lib/info");
  ({ listOrgUnits } = mod);
  ({ listSamlProfiles } = mod);
  ({ listSsoAssignments } = mod);
  ({ listProvisioningJobs } = mod);
  ({ listClaimsPolicies } = mod);
  ({ listEnterpriseApps } = mod);
  const { deleteGoogleRoles: deleteRoles } = await import(
    "@/lib/workflow/info-actions"
  );
  deleteGoogleRoles = deleteRoles;
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
    const fetchMock = mock(() => ({
      json: () => load("google-org-units.json"),
      ok: true,
    }));
    setFetchMock(fetchMock);
    const items = await listOrgUnits();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint:
          "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation",
        href: "https://admin.google.com/ac/orgunits",
        id: "id:123",
        label: "/Automation",
      },
    ]);
  });

  test("listSamlProfiles", async () => {
    const fetchMock = mock(() => ({
      json: () => load("google-saml-profiles.json"),
      ok: true,
    }));
    setFetchMock(fetchMock);
    const items = await listSamlProfiles();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/samlProfiles/abc123",
        href: "https://admin.google.com/ac/security/sso/sso-profiles/samlProfiles%2Fabc123",
        id: "samlProfiles/abc123",
        label: "Workspace SAML",
      },
    ]);
  });

  test("listSsoAssignments", async () => {
    const fetchMock = mock(() => ({
      json: () => load("google-sso-assignments.json"),
      ok: true,
    }));
    setFetchMock(fetchMock);
    const items = await listSsoAssignments();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/root",
        href: "https://admin.google.com/ac/security/sso",
        id: "root",
        label: "orgUnits/03ph8a2z23yjui6",
        subLabel: "SAML_SSO",
      },
      {
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/automation",
        href: "https://admin.google.com/ac/security/sso",
        id: "automation",
        label: "orgUnits/03ph8a2z1s3ovsg",
        subLabel: "SSO_OFF",
      },
    ]);
  });

  test("listSsoAssignments handles prefixed names", async () => {
    const fetchMock = mock(() => ({
      json: () => load("google-sso-assignments-prefixed.json"),
      ok: true,
    }));
    setFetchMock(fetchMock);
    const items = await listSsoAssignments();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/abc123",
        href: "https://admin.google.com/ac/security/sso",
        id: "abc123",
        label: "orgUnits/03ph8a2z23yjui6",
        subLabel: "SSO_OFF",
      },
    ]);
  });

  test("listProvisioningJobs", async () => {
    const fetchMock = mock()
      .mockResolvedValueOnce({
        json: () => ({ value: [{ appId: "abcd1234", id: "sp1" }] }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: () => load("ms-sync-jobs.json"),
        ok: true,
      });
    setFetchMock(fetchMock);
    const items = await listProvisioningJobs();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint:
          "https://graph.microsoft.com/v1.0/servicePrincipals/sp1/synchronization/jobs/Initial",
        href: "https://portal.azure.com/#view/Microsoft_AAD_Connect_Provisioning/ProvisioningMenuBlade/~/Overview/objectId/sp1/appId/abcd1234",
        id: "Initial",
        label: "gsuite",
        subLabel: "Active",
      },
    ]);
  });

  test("listClaimsPolicies", async () => {
    const fetchMock = mock(() => ({
      json: () => load("ms-claims-policies.json"),
      ok: true,
    }));
    setFetchMock(fetchMock);
    const items = await listClaimsPolicies();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint:
          "https://graph.microsoft.com/beta/policies/claimsMappingPolicies/policy123",
        href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview",
        id: "policy123",
        label: "Google Workspace Claims",
      },
    ]);
  });

  test("listEnterpriseApps", async () => {
    const fetchMock = mock(() => ({
      json: () => load("ms-applications.json"),
      ok: true,
    }));
    setFetchMock(fetchMock);
    const items = await listEnterpriseApps();
    expect(items).toEqual([
      {
        deletable: true,
        deleteEndpoint: "https://graph.microsoft.com/beta/applications/app1",
        href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/SignOn/objectId/app1/appId/abcd1234/preferredSingleSignOnMode~/null/servicePrincipalType/Application/fromNav/",
        id: "app1",
        label: "Google Workspace Provisioning",
      },
    ]);
  });

  test("deleteGoogleRoles unassigns users before removal", async () => {
    const fetchMock = mock()
      .mockResolvedValueOnce({
        json: () => ({
          items: [
            {
              assignedTo: "user-1",
              roleAssignmentId: "assignment-1",
              roleId: "role-1",
            },
          ],
        }),
        ok: true,
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    setFetchMock(fetchMock);

    const result = await deleteGoogleRoles(["role-1"]);
    expect(result).toEqual({ deleted: ["role-1"], failed: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain("roleassignments?roleId=role-1");
    expect(fetchMock.mock.calls[1][0]).toContain("roleassignments/assignment-1");
    expect(fetchMock.mock.calls[2][0]).toContain("/roles/role-1");
  });
});
