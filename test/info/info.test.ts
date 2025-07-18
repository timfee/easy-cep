import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token = { accessToken: "tok", refreshToken: "", expiresAt: 0, scope: [] };

// Mock authentication helpers
(jest as any).unstable_mockModule("@/lib/auth", () => ({
  refreshTokenIfNeeded: jest.fn(() => Promise.resolve(token))
}));

let listOrgUnits: any;
let listSamlProfiles: any;
let listSsoAssignments: any;
let listProvisioningJobs: any;
let listClaimsPolicies: any;
let listEnterpriseApps: any;

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("listOrgUnits", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-org-units.json")
      }) as any;
    const items = await listOrgUnits();
    expect(items).toEqual([
      {
        id: "id:123",
        label: "/Automation",
        href: "https://admin.google.com/ac/orgunits",
        deletable: true,
        deleteEndpoint:
          "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits/Automation"
      }
    ]);
  });

  test("listSamlProfiles", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-saml-profiles.json")
      }) as any;
    const items = await listSamlProfiles();
    expect(items).toEqual([
      {
        id: "samlProfiles/abc123",
        label: "Workspace SAML",
        href: "https://admin.google.com/ac/security/sso/sso-profiles/samlProfiles%2Fabc123",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/samlProfiles/abc123"
      }
    ]);
  });

  test("listSsoAssignments", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-sso-assignments.json")
      }) as any;
    const items = await listSsoAssignments();
    expect(items).toEqual([
      {
        id: "root",
        label: "orgUnits/03ph8a2z23yjui6",
        subLabel: "SAML_SSO",
        href: "https://admin.google.com/ac/security/sso",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/root"
      },
      {
        id: "automation",
        label: "orgUnits/03ph8a2z1s3ovsg",
        subLabel: "SSO_OFF",
        href: "https://admin.google.com/ac/security/sso",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/automation"
      }
    ]);
  });

  test("listSsoAssignments handles prefixed names", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-sso-assignments-prefixed.json")
      }) as any;
    const items = await listSsoAssignments();
    expect(items).toEqual([
      {
        id: "abc123",
        label: "orgUnits/03ph8a2z23yjui6",
        subLabel: "SSO_OFF",
        href: "https://admin.google.com/ac/security/sso",
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/abc123"
      }
    ]);
  });

  test("listProvisioningJobs", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: "sp1", appId: "abcd1234" }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => load("ms-sync-jobs.json")
      }) as any;
    const items = await listProvisioningJobs();
    expect(items).toEqual([
      {
        id: "Initial",
        label: "gsuite",
        subLabel: "Active",
        href: "https://portal.azure.com/#view/Microsoft_AAD_Connect_Provisioning/ProvisioningMenuBlade/~/Overview/objectId/sp1/appId/abcd1234",
        deletable: true,
        deleteEndpoint:
          "https://graph.microsoft.com/v1.0/servicePrincipals/sp1/synchronization/jobs/Initial"
      }
    ]);
  });

  test("listClaimsPolicies", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        ok: true,
        json: async () => load("ms-claims-policies.json")
      }) as any;
    const items = await listClaimsPolicies();
    expect(items).toEqual([
      {
        id: "policy123",
        label: "Google Workspace Claims",
        href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview",
        deletable: true,
        deleteEndpoint:
          "https://graph.microsoft.com/beta/policies/claimsMappingPolicies/policy123"
      }
    ]);
  });

  test("listEnterpriseApps", async () => {
    global.fetch = jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        ok: true,
        json: async () => load("ms-applications.json")
      }) as any;
    const items = await listEnterpriseApps();
    expect(items).toEqual([
      {
        id: "app1",
        label: "Google Workspace Provisioning",
        href: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/SignOn/objectId/app1/appId/abcd1234/preferredSingleSignOnMode~/null/servicePrincipalType/Application/fromNav/",
        deletable: true,
        deleteEndpoint: "https://graph.microsoft.com/beta/applications/app1"
      }
    ]);
  });
});
