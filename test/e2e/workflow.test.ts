import { runStep, undoStep } from "@/lib/workflow/engine";
import { StepId, Var } from "@/types";
import { jest } from "@jest/globals";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  cleanupGoogleEnvironment,
  cleanupMicrosoftEnvironment
} from "../../scripts/e2e-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

jest.setTimeout(30000); // Increase timeout for API calls

// Load tokens from files if not in env
const googleTokenPath = path.join(__dirname, "../../google_bearer.token");
if (!process.env.TEST_GOOGLE_BEARER_TOKEN && fs.existsSync(googleTokenPath)) {
  process.env.TEST_GOOGLE_BEARER_TOKEN = fs
    .readFileSync(googleTokenPath, "utf8")
    .trim();
}

const msTokenPath = path.join(__dirname, "../../microsoft_bearer.token");
if (!process.env.TEST_MS_BEARER_TOKEN && fs.existsSync(msTokenPath)) {
  process.env.TEST_MS_BEARER_TOKEN = fs
    .readFileSync(msTokenPath, "utf8")
    .trim();
}

if (
  process.env.SKIP_E2E === "1"
  || !process.env.TEST_GOOGLE_BEARER_TOKEN
  || !process.env.TEST_MS_BEARER_TOKEN
) {
  test.skip("e2e", () => {
    console.warn(
      "E2E tests require TEST_GOOGLE_BEARER_TOKEN and TEST_MS_BEARER_TOKEN; skipping."
    );
  });
} else {
  describe("Workflow Live E2E", () => {
    // Clean environment before ALL tests
    beforeAll(async () => {
      console.log("\uD83E\uDDF9 Cleaning test environment before tests...");
      try {
        await cleanupGoogleEnvironment();
        await cleanupMicrosoftEnvironment();
        console.log("✅ Environment cleaned");
      } catch (error) {
        console.error("❌ Cleanup failed:", error);
        throw error;
      }
    });

    // Use unique names for this test run to avoid conflicts
    const testRunId = Date.now().toString(36);

    const baseVars = {
      // Tokens
      [Var.GoogleAccessToken]: process.env.TEST_GOOGLE_BEARER_TOKEN!,
      [Var.MsGraphToken]: process.env.TEST_MS_BEARER_TOKEN!,
      // Domain config
      [Var.PrimaryDomain]: process.env.TEST_DOMAIN || "test.example.com",
      [Var.IsDomainVerified]: "true",
      // Use unique names with test run ID to avoid conflicts
      [Var.AutomationOuName]: `Automation-${testRunId}`,
      [Var.AutomationOuPath]: `/Automation-${testRunId}`,
      [Var.ProvisioningUserPrefix]: `azuread-provisioning-${testRunId}`,
      [Var.AdminRoleName]: `Microsoft Entra Provisioning ${testRunId}`,
      [Var.SamlProfileDisplayName]: `Azure AD ${testRunId}`,
      [Var.ProvisioningAppDisplayName]: `Google Workspace Provisioning ${testRunId}`,
      [Var.SsoAppDisplayName]: `Google Workspace SSO ${testRunId}`,
      [Var.ClaimsPolicyDisplayName]: `Google Workspace Basic Claims ${testRunId}`,
      [Var.GeneratedPassword]: crypto.randomBytes(16).toString("hex") + "!Aa1"
    } as const;

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
      StepId.AssignUsersToSso
    ] as const;

    let vars: Record<string, any> = { ...baseVars };

    for (const step of steps) {
      it(`Execute: ${step}`, async () => {
        console.log(`\n\uD83D\uDCCB Executing ${step}...`);
        const result = await runStep(step, vars);
        console.log(`   Status: ${result.state.status}`);

        if (result.state.status !== "complete") {
          console.error(`\n❌ ${step} FAILED`);
          console.error("Error:", result.state.error);
          console.error("Summary:", result.state.summary);

          const errorLogs = result.state.logs?.filter(
            (log) => log.level === "error" || (log as any).method
          );
          if (errorLogs?.length) {
            console.error("\nError logs:");
            for (const log of errorLogs) {
              if ((log as any).method) {
                console.error(
                  `  ${(log as any).method} ${(log as any).url} -> ${(log as any).status}`
                );
              } else {
                console.error(`  [${log.level}] ${log.message}`);
              }
              if (log.data) {
                console.error("  Data:", JSON.stringify(log.data, null, 2));
              }
            }
          }
        }

        expect(result.state.status).toBe("complete");
        vars = { ...vars, ...result.newVars };
      });
    }

    const undoSteps = [...steps].reverse();
    for (const step of undoSteps) {
      it(`Undo: ${step}`, async () => {
        console.log(`\n\uD83D\uDD04 Undoing ${step}...`);
        const result = await undoStep(step, vars);
        console.log(`   Status: ${result.state.status}`);
        expect(["reverted", "failed"]).toContain(result.state.status);
      });
    }

    afterAll(async () => {
      console.log("\n\uD83E\uDDF9 Final cleanup...");
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
