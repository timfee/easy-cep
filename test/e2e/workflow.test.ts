import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  setDefaultTimeout,
  test,
} from "bun:test";
import { env } from "@/env";
import { generateSecurePassword } from "@/lib/utils";
import { runStep, undoStep } from "@/lib/workflow/engine";
import { StepId } from "@/lib/workflow/step-ids";
import type { WorkflowVars } from "@/lib/workflow/variables";
import { Var } from "@/lib/workflow/variables";

setDefaultTimeout(120_000);

import { getBearerTokens } from "@/lib/testing/tokens";
import {
  cleanupGoogleEnvironment,
  cleanupMicrosoftEnvironment,
} from "../../scripts/e2e-setup";

if (env.SKIP_E2E === "1" || env.RUN_E2E !== "1") {
  test("e2e", () => {
    console.warn("E2E tests skipped (RUN_E2E=1 required).");
  });
} else {
  describe("Workflow Live E2E", () => {
    beforeAll(async () => {
      console.log("9f9f Cleaning test environment before tests...");

      let retries = 3;
      while (retries > 0) {
        try {
          await cleanupGoogleEnvironment();
          await cleanupMicrosoftEnvironment();
          console.log("9f9f Environment cleaned");
          break;
        } catch (error) {
          retries -= 1;
          if (retries === 0) {
            console.error("9f9f Cleanup failed after 3 attempts:", error);
            throw error;
          }
          console.warn(
            `9f9f Cleanup attempt failed, retrying... (${retries} attempts left)`
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
    let vars: Partial<WorkflowVars> = {
      [Var.PrimaryDomain]: env.TEST_DOMAIN ?? "test.example.com",
      [Var.IsDomainVerified]: "true",
      [Var.AutomationOuName]: `test-automation-${testRunId}`,
      [Var.AutomationOuPath]: `/test-automation-${testRunId}`,
      [Var.ProvisioningUserPrefix]: `test-azuread-provisioning-${testRunId}`,
      [Var.AdminRoleName]: `Test Microsoft Entra Provisioning ${testRunId}`,
      [Var.SamlProfileDisplayName]: `Test Azure AD ${testRunId}`,
      [Var.ProvisioningAppDisplayName]: `Test Google Workspace Provisioning ${testRunId}`,
      [Var.SsoAppDisplayName]: `Test Google Workspace SSO ${testRunId}`,
      [Var.ClaimsPolicyDisplayName]: `Test Google Workspace Basic Claims ${testRunId}`,
      [Var.GeneratedPassword]: generateSecurePassword(),
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
}
