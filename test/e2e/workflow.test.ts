import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  setDefaultTimeout,
} from "bun:test";
import { setTimeout as delay } from "node:timers/promises";

import { env } from "@/env";
import { getBearerTokens, normalizeEnvValue } from "@/lib/testing/tokens";
import { runStep, undoStep } from "@/lib/workflow/engine";
import { StepId } from "@/lib/workflow/step-ids";
import { Var } from "@/lib/workflow/variables";

import {
  cleanupGoogleEnvironment,
  cleanupMicrosoftEnvironment,
} from "../../scripts/e2e-setup";
import { assertFixture } from "./fixtures";

type WorkflowVars = Record<string, string | undefined>;
type StepResult = Awaited<ReturnType<typeof runStep>>;
type StepLogEntry = NonNullable<StepResult["state"]["logs"]>[number];

const shouldSkipLiveE2E = process.env.SKIP_LIVE_E2E === "1";
const isUnitTest = process.env.UNIT_TEST === "1";
const googleRefreshToken = normalizeEnvValue(env.TEST_GOOGLE_REFRESH_TOKEN);
const googleClientId = normalizeEnvValue(env.GOOGLE_OAUTH_CLIENT_ID);
const googleClientSecret = normalizeEnvValue(env.GOOGLE_OAUTH_CLIENT_SECRET);
const googleImpersonatedEmail = normalizeEnvValue(
  env.GOOGLE_IMPERSONATED_ADMIN_EMAIL
);
const googleServiceAccountJson = normalizeEnvValue(
  env.GOOGLE_SERVICE_ACCOUNT_JSON
);
const googleServiceAccountFile = normalizeEnvValue(
  env.GOOGLE_SERVICE_ACCOUNT_FILE
);
const hasGoogleRefreshFlow = Boolean(
  googleRefreshToken && googleClientId && googleClientSecret
);
const hasGoogleServiceAccount = Boolean(
  googleImpersonatedEmail &&
  (googleServiceAccountJson || googleServiceAccountFile)
);
const hasGoogleCredentials = hasGoogleRefreshFlow || hasGoogleServiceAccount;

const microsoftRefreshToken = normalizeEnvValue(env.TEST_MS_REFRESH_TOKEN);
const microsoftClientId = normalizeEnvValue(env.MICROSOFT_OAUTH_CLIENT_ID);
const microsoftClientSecret = normalizeEnvValue(
  env.MICROSOFT_OAUTH_CLIENT_SECRET
);
const hasMicrosoftCredentials = Boolean(
  microsoftRefreshToken && microsoftClientId && microsoftClientSecret
);

const shouldSkipSuite =
  shouldSkipLiveE2E ||
  isUnitTest ||
  !hasGoogleCredentials ||
  !hasMicrosoftCredentials;

const isErrorLog = (log: StepLogEntry) =>
  log.level === "error" || "method" in log;

const formatLogMessage = (log: StepLogEntry) => {
  if ("method" in log && log.method && log.url && log.status) {
    return `  ${log.method} ${log.url} -> ${log.status}`;
  }
  return `  [${log.level}] ${log.message}`;
};

const logErrorLogData = (log: StepLogEntry) => {
  if (!log.data) {
    return;
  }
  console.error("  Data:", JSON.stringify(log.data, null, 2));
};

const logErrorLogs = (logs: StepLogEntry[] | undefined) => {
  if (!logs?.length) {
    return;
  }
  console.error("\nError logs:");
  for (const log of logs) {
    console.error(formatLogMessage(log));
    logErrorLogData(log);
  }
};

const logExecutionFailure = (step: string, result: StepResult) => {
  if (result.state.status === "complete") {
    return;
  }
  console.error(`\n❌ ${step} FAILED`);
  console.error("Error:", result.state.error);
  console.error("Summary:", result.state.summary);
  logErrorLogs(result.state.logs?.filter(isErrorLog));
};

const runWorkflowLiveE2E = () => {
  const varsRef: { current: Partial<WorkflowVars> } = { current: {} };

  beforeAll(async () => {
    setDefaultTimeout(120_000);
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
        await delay(2000);
      }
    }

    const { googleToken, microsoftToken } = await getBearerTokens(true);

    if (!(googleToken && microsoftToken)) {
      throw new Error(
        "Missing E2E bearer tokens; ensure refresh tokens or service account credentials are set in .env.local."
      );
    }

    const now = new Date();
    const [date] = now.toISOString().split("T");
    const timestamp = Math.floor(now.getTime() / 1000);
    const testRunId = `${date}-${timestamp}`;
    const suffix = `_test-${testRunId}`;
    varsRef.current = {
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
      [Var.GoogleAccessToken]: googleToken.accessToken,
      [Var.MsGraphToken]: microsoftToken.accessToken,
    };
  }, 120_000);

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

  it.each(steps)(
    "Execute: %s",
    async (step) => {
      console.log(`\n📋 Executing ${step}...`);
      const result = await runStep(step, varsRef.current);
      console.log(`   Status: ${result.state.status}`);
      logExecutionFailure(step, result);
      expect(["complete", "blocked", "pending"]).toContain(result.state.status);
      assertFixture(step, {
        error: result.state.error,
        status: result.state.status,
      });
      varsRef.current = { ...varsRef.current, ...result.newVars };
    },
    { timeout: 120_000 }
  );

  const undoSteps = [...steps].toReversed();
  it.each(undoSteps)(
    "Undo: %s",
    async (step) => {
      console.log(`\n🔄 Undoing ${step}...`);
      const result = await undoStep(step, varsRef.current);
      console.log(`   Status: ${result.state.status}`);
      expect(["complete", "blocked"]).toContain(result.state.status);
      assertFixture(`${step}-undo`, {
        error: result.state.error,
        status: result.state.status,
      });
    },
    { timeout: 120_000 }
  );

  afterAll(async () => {
    console.log("\n🧹 Final cleanup...");
    try {
      await cleanupGoogleEnvironment();
      await cleanupMicrosoftEnvironment();
      console.log("✅ Final cleanup complete");
    } catch (error) {
      console.error("❌ Final cleanup failed:", error);
    }
  }, 120_000);
};

// eslint-disable-next-line jest/require-hook
if (shouldSkipSuite) {
  describe.skip("Workflow Live E2E", runWorkflowLiveE2E);
} else {
  describe("Workflow Live E2E", runWorkflowLiveE2E);
}
