import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  setDefaultTimeout,
} from "bun:test";
import { env } from "@/env";
import { getBearerTokens } from "@/lib/testing/tokens";
import { runStep, undoStep } from "@/lib/workflow/engine";
import { StepId } from "@/lib/workflow/step-ids";
import type { WorkflowVars } from "@/lib/workflow/variables";
import { Var } from "@/lib/workflow/variables";
import {
  cleanupGoogleEnvironment,
  cleanupMicrosoftEnvironment,
} from "../../scripts/e2e-setup";
import { assertFixture } from "./fixtures";

setDefaultTimeout(120_000);

describe("Workflow Live E2E", () => {
  beforeAll(async () => {
    console.log("🧹 Cleaning test environment before tests...");

    let retries = 3;
    while (retries > 0) {
      try {
        await cleanupGoogleEnvironment();
        await cleanupMicrosoftEnvironment();
        console.log("🧹 Environment cleaned");
        break;
      } catch (error) {
        retries -= 1;
        if (retries === 0) {
          console.error("🧹 Cleanup failed after 3 attempts:", error);
          throw error;
        }
        console.warn(
          `🧹 Cleanup attempt failed, retrying... (${retries} attempts left)`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const { googleToken, microsoftToken } = await getBearerTokens(true);

    if (!(googleToken && microsoftToken)) {
      throw new Error(
        "Missing E2E bearer tokens; ensure refresh tokens or service account credentials are set in .env.local."
      );
    }

    vars = {
      ...vars,
      [Var.GoogleAccessToken]: googleToken.accessToken,
      [Var.MsGraphToken]: microsoftToken.accessToken,
    };
  });

  const testRunId = Date.now().toString(36);
  const suffix = `_test-${testRunId}`;
  let vars: Partial<WorkflowVars> = {
    [Var.PrimaryDomain]: env.TEST_DOMAIN ?? "test.example.com",
    [Var.IsDomainVerified]: "true",
    [Var.AutomationOuName]: `automation${suffix}`,
    [Var.AutomationOuPath]: `/automation${suffix}`,
    [Var.ProvisioningUserPrefix]: `azuread-provisioning${suffix}`,
    [Var.AdminRoleName]: `Microsoft Entra Provisioning${suffix}`,
    [Var.SamlProfileDisplayName]: `Azure AD${suffix}`,
    [Var.ProvisioningAppDisplayName]: `Google Workspace Provisioning${suffix}`,
    [Var.SsoAppDisplayName]: `Google Workspace SSO${suffix}`,
    [Var.ClaimsPolicyDisplayName]: `Google Workspace Basic Claims${suffix}`,
  };

  const steps = [
    StepId.VerifyPrimaryDomain,
    StepId.CreateAutomationOU,
    StepId.CreateServiceUser,
    StepId.CreateAdminRoleAndAssignUser,
    StepId.ConfigureGoogleSamlProfile,
    StepId.CreateMicrosoftApps,
    StepId.SetupMicrosoftProvisioning,
    StepId.ConfigureMicrosoftSso,
    StepId.SetupMicrosoftClaimsPolicy,
    StepId.CompleteGoogleSsoSetup,
    StepId.AssignUsersToSso,
  ];

  for (const step of steps) {
    it(`Execute: ${step}`, async () => {
      console.log(`\n📋 Executing ${step}...`);
      const result = await runStep(step, vars);
      console.log(`   Status: ${result.state.status}`);

      if (result.state.status !== "complete") {
        console.error(`\n❌ ${step} FAILED`);
        console.error("Error:", result.state.error);
        console.error("Summary:", result.state.summary);

        const errorLogs = result.state.logs?.filter(
          (log) => log.level === "error" || "method" in log
        );
        if (errorLogs?.length) {
          console.error("\nError logs:");
          for (const log of errorLogs) {
            if ("method" in log && log.method && log.url && log.status) {
              console.error(`  ${log.method} ${log.url} -> ${log.status}`);
            } else {
              console.error(`  [${log.level}] ${log.message}`);
            }
            if (log.data) {
              console.error("  Data:", JSON.stringify(log.data, null, 2));
            }
          }
        }
      }

      expect(["complete", "blocked"]).toContain(result.state.status);
      assertFixture(step, {
        status: result.state.status,
        error: result.state.error,
      });
      vars = { ...vars, ...result.newVars };
    });
  }

  const undoSteps = [...steps].reverse();
  for (const step of undoSteps) {
    it(`Undo: ${step}`, async () => {
      console.log(`\n🔄 Undoing ${step}...`);
      const result = await undoStep(step, vars);
      console.log(`   Status: ${result.state.status}`);
      expect(["complete", "blocked"]).toContain(result.state.status);
      assertFixture(`${step}-undo`, {
        status: result.state.status,
        error: result.state.error,
      });
    });
  }

  afterAll(async () => {
    console.log("\n🧹 Final cleanup...");
    try {
      await cleanupGoogleEnvironment();
      await cleanupMicrosoftEnvironment();
      console.log("✅ Final cleanup complete");
    } catch (error) {
      console.error("❌ Final cleanup failed:", error);
    }
  });
});
