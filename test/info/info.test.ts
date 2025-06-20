import { refreshTokenIfNeeded } from "@/lib/auth";
import {
  listClaimsPolicies,
  listEnterpriseApps,
  listOrgUnits,
  listProvisioningJobs,
  listSamlProfiles,
  listSsoAssignments
} from "@/lib/info";
import fs from "fs";
import path from "path";

jest.mock("@/lib/auth", () => ({ refreshTokenIfNeeded: jest.fn() }));

const token = { accessToken: "tok", refreshToken: "", expiresAt: 0, scope: [] };

function load(name: string) {
  const p = path.join(__dirname, "fixtures", name);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

describe("info server actions", () => {
  beforeEach(() => {
    (refreshTokenIfNeeded as jest.Mock).mockResolvedValue(token);
  });

  test("listOrgUnits", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-org-units.json")
      });
    const items = await listOrgUnits();
    expect(items).toEqual([
      {
        id: "id:123",
        label: "/Automation",
        href: "https://admin.google.com/ac/orgunits?ouid=123"
      }
    ]);
  });

  test("listSamlProfiles", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-saml-profiles.json")
      });
    const items = await listSamlProfiles();
    expect(items).toEqual([
      { id: "samlProfiles/abc123", label: "Workspace SAML", href: undefined }
    ]);
  });

  test("listSsoAssignments", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => load("google-sso-assignments.json")
      });
    const items = await listSsoAssignments();
    expect(items).toEqual([
      { id: "assignments/allUsers", label: "groups/allUsers", href: undefined }
    ]);
  });

  test("listProvisioningJobs", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: "sp1" }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => load("ms-sync-jobs.json")
      });
    const items = await listProvisioningJobs();
    expect(items).toEqual([
      { id: "Initial", label: "Active", href: undefined }
    ]);
  });

  test("listClaimsPolicies", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => load("ms-claims-policies.json")
      });
    const items = await listClaimsPolicies();
    expect(items).toEqual([
      { id: "policy123", label: "Google Workspace Claims", href: undefined }
    ]);
  });

  test("listEnterpriseApps", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => load("ms-applications.json")
      });
    const items = await listEnterpriseApps();
    expect(items).toEqual([
      { id: "app1", label: "Google Workspace Provisioning", href: undefined }
    ]);
  });
});
