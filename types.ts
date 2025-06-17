import { z } from "zod";

export enum Var {
  GoogleAccessToken = "googleAccessToken",
  MsGraphToken = "msGraphToken",
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
  ClaimsPolicyId = "claimsPolicyId"
}

export type WorkflowVars = { [K in Var]: string | boolean };

// Workflow steps should use this ID as a filename
// in ./app/workflow/steps/{filename-in-kebab-case}.ts
export enum StepId {
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
  TestSsoConfiguration = "testSsoConfiguration"
}

export enum StepOutcome {
  Succeeded = "Succeeded",
  Failed = "Failed",
  Skipped = "Skipped"
}

export enum LogLevel {
  Info = "info",
  Warn = "warn",
  Error = "error",
  Debug = "debug"
}

export interface StepDefinition<
  R extends readonly Var[],
  P extends readonly Var[]
> {
  /** Unique ID for the step */
  id: StepId;

  /** Variables that must be present before this step can run */
  requires: R;

  /** Variables this step will populate if successful */
  provides: P;
}

export interface StepRunResult {
  id: StepId;
  outcome: StepOutcome;
  summary: string;
  vars: Partial<WorkflowVars>;
}

export interface StepCheckContext<T> {
  fetchGoogle<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: Omit<RequestInit, "headers">
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: Omit<RequestInit, "headers">
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;

  /** Current workflow variables available to this step */
  vars: Partial<WorkflowVars>;

  markComplete(data: T): void;
  markIncomplete(summary: string, data: T): void;
  markCheckFailed(error: string): void;
}

export interface StepExecuteContext<T> {
  fetchGoogle<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: Omit<RequestInit, "headers">
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: Omit<RequestInit, "headers">
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;

  /** Current workflow variables available to this step */
  vars: Partial<WorkflowVars>;

  checkData: T;

  markSucceeded(vars: Partial<WorkflowVars>): void;
  markFailed(error: string): void;
  markPending(notes: string): void;
}

export interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: LogLevel;
}

export interface StepUIState {
  status: "idle" | "checking" | "executing" | "complete" | "failed" | "pending";
  summary?: string;
  error?: string;
  notes?: string;
  logs?: StepLogEntry[];
}
