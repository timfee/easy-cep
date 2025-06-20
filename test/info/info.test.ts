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
  const p = path.join(__dirname, "fixtures", name);
  return JSON.parse(fs.readFileSync(p, "utf8"));
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
        href: "https://admin.google.com/ac/orgunits?ouid=123",
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
        href: undefined,
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSamlSsoProfiles/samlProfiles%2Fabc123"
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
        id: "assignments/allUsers",
        label: "groups/allUsers",
        href: undefined,
        deletable: true,
        deleteEndpoint:
          "https://cloudidentity.googleapis.com/v1/inboundSsoAssignments/assignments%2FallUsers"
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
        href: undefined,
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
        json: async () => ({ value: [{ id: "sp1" }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => load("ms-sync-jobs.json")
      }) as any;
    const items = await listProvisioningJobs();
    expect(items).toEqual([
      {
        id: "Initial",
        label: "Active",
        href: undefined,
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
        href: undefined,
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
        href: undefined,
        deletable: true,
        deleteEndpoint: "https://graph.microsoft.com/beta/applications/app1"
      }
    ]);
  });
});
