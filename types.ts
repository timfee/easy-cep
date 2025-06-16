export enum Var {
  GoogleAccessToken = "googleAccessToken",
  MsGraphToken = "msGraphToken",
  CustomerId = "customerId",
  PrimaryDomain = "primaryDomain",
  IsDomainVerified = "isDomainVerified",
  ProvisioningUserId = "provisioningUserId",
  ProvisioningUserEmail = "provisioningUserEmail",
  GeneratedPassword = "generatedPassword",
  AdminRoleId = "adminRoleId",
  DirectoryServiceId = "directoryServiceId",
  SsoServicePrincipalId = "ssoServicePrincipalId",
  ProvisioningServicePrincipalId = "provisioningServicePrincipalId",
  SsoAppId = "ssoAppId",
  SamlProfileId = "samlProfileId",
  EntityId = "entityId",
  AcsUrl = "acsUrl",
  ClaimsPolicyId = "claimsPolicyId",
}

export type WorkflowVars = {
  [K in Var]: string | boolean;
};

// Workflow steps should use this ID as a filename
// in ./app/workflow/steps/{filename-in-kebab-case}.ts
export enum StepId {
  DummyStep = "dummyStep",
  VerifyPrimaryDomain = "verifyPrimaryDomain",
  CreateAutomationOU = "createAutomationOU",
  CreateServiceUser = "createServiceUser",
  CreateCustomAdminRole = "createCustomAdminRole",
  AssignRoleToUser = "assignRoleToUser",
  ConfigureGoogleSamlProfile = "configureGoogleSamlProfile",
  CreateMicrosoftApps = "createMicrosoftApps",
  ConfigureMicrosoftSyncAndSso = "configureMicrosoftSyncAndSso",
  SetupMicrosoftClaimsPolicy = "setupMicrosoftClaimsPolicy",
  CompleteGoogleSsoSetup = "completeGoogleSsoSetup",
  AssignUsersToSso = "assignUsersToSso",
  TestSsoConfiguration = "testSsoConfiguration",
}

export enum StepOutcome {
  Succeeded = "Succeeded",
  Failed = "Failed",
  Skipped = "Skipped",
}

export enum LogLevel {
  Info = "info",
  Warn = "warn",
  Error = "error",
  Debug = "debug",
}

export interface StepDefinition<
  R extends readonly Var[],
  P extends readonly Var[]
> {
  /** Unique ID for the step */
  id: string;

  /** Variables that must be present before this step can run */
  requires: R;

  /** Variables this step will populate if successful */
  provides: P;

  /**
   * Checks current state to determine whether the step is complete.
   * Also allows returning intermediate data used in `execute`.
   */
  check(
    vars: Pick<WorkflowVars, R[number]>,
    ctx: StepContext
  ): Promise<StepCheckResult>;

  /**
   * Executes the step, using current vars and prior `check` result.
   * Returns new output values and step status.
   */
  execute(
    vars: Pick<WorkflowVars, R[number]>,
    ctx: StepContext,
    checkResult: StepCheckResult
  ): Promise<StepExecuteResult<P[number]>>;
}

export interface StepContext {
  fetch: typeof fetch;
  log: (level: LogLevel, message: string) => void;
  refreshAuth?: () => Promise<void>;
}

export interface StepCheckResult {
  isComplete: boolean;
  summary: string;
  data?: Record<string, unknown>;
}

export interface StepRunResult {
  id: StepId;
  outcome: StepOutcome;
  summary: string;
  vars: Partial<WorkflowVars>;
}

export interface StepExecuteResult<K extends Var> {
  status: StepOutcome;
  output?: Partial<Pick<WorkflowVars, K>>;
  notes?: string;
  error?: string;
}
