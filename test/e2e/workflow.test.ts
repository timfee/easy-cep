import { runStep } from '@/app/workflow/engine';
import { StepId, Var } from '@/types';
import fs from 'fs';
import path from 'path';

describe('Workflow Live E2E', () => {
  const baseVars = {
    [Var.GoogleAccessToken]: process.env.GOOGLE_BEARER_TOKEN!,
    [Var.MsGraphToken]: process.env.MS_BEARER_TOKEN!,
    [Var.PrimaryDomain]: process.env.TEST_DOMAIN!,
    [Var.IsDomainVerified]: true
  } as const;

  const fixtureDir = path.join(__dirname, 'fixtures');

  function loadFixture(step: string): any {
    const p = path.join(fixtureDir, `${step}.json`);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : undefined;
  }

  function saveFixture(step: string, data: any) {
    if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir);
    fs.writeFileSync(path.join(fixtureDir, `${step}.json`), JSON.stringify(data, null, 2));
  }

  const steps = [
    StepId.VerifyPrimaryDomain,
    StepId.CreateAutomationOU,
    StepId.CreateServiceUser,
    StepId.CreateAdminRoleAndAssignUser,
    StepId.ConfigureGoogleSamlProfile,
    StepId.CreateMicrosoftApps,
    StepId.ConfigureMicrosoftSyncAndSso,
    StepId.SetupMicrosoftClaimsPolicy,
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
      if (expected) {
        expect(sanitized).toEqual(expected);
      }
      vars = { ...vars, ...result.newVars };
    });
  }
});
