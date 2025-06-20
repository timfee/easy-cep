import { runStep, undoStep } from "@/lib/workflow/engine";
import { StepId, Var } from "@/types";
import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Some workflow steps take longer than Jest's default 5 second timeout
// so increase the limit globally for this suite
jest.setTimeout(20000);

const googleTokenPath = path.join(__dirname, "google.token");
if (!process.env.TEST_GOOGLE_BEARER_TOKEN && fs.existsSync(googleTokenPath)) {
  process.env.TEST_GOOGLE_BEARER_TOKEN = fs
    .readFileSync(googleTokenPath, "utf8")
    .trim();
}

const msTokenPath = "/.microsoft.token";
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
    const baseVars = {
      [Var.GoogleAccessToken]: process.env.TEST_GOOGLE_BEARER_TOKEN!,
      [Var.MsGraphToken]: process.env.TEST_MS_BEARER_TOKEN!,
      [Var.PrimaryDomain]: process.env.TEST_DOMAIN!,
      [Var.IsDomainVerified]: true
    } as const;

    const fixtureDir = path.join(__dirname, "fixtures");

    function loadFixture(step: string): any {
      const filePath = path.join(fixtureDir, `${step}.json`);
      return fs.existsSync(filePath) ?
          JSON.parse(fs.readFileSync(filePath, "utf8"))
        : undefined;
    }

    function saveFixture(step: string, data: any) {
      if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir);
      fs.writeFileSync(
        path.join(fixtureDir, `${step}.json`),
        JSON.stringify(data, null, 2)
      );
    }

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
      it(step, async () => {
        const result = await runStep(step, vars);
        const sanitized = { status: result.state.status };
        if (process.env.UPDATE_FIXTURES) {
          saveFixture(step, sanitized);
        }
        const expected = loadFixture(step);
        if (expected && process.env.CHECK_FIXTURES) {
          expect(sanitized).toEqual(expected);
        }
        vars = { ...vars, ...result.newVars };
      });
    }

    const undoSteps = [...steps].reverse();
    for (const step of undoSteps) {
      it(`${step} undo`, async () => {
        const result = await undoStep(step, vars);
        const sanitized = { status: result.state.status };
        if (process.env.UPDATE_FIXTURES) {
          saveFixture(`${step}-undo`, sanitized);
        }
        const expected = loadFixture(`${step}-undo`);
        if (expected && process.env.CHECK_FIXTURES) {
          expect(sanitized).toEqual(expected);
        }
      });
    }
  });
}
