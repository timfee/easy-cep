import { z } from "zod";
import type { StepIdValue } from "./lib/workflow/step-ids";
import type { VarName, WorkflowVars } from "./lib/workflow/variables";

// Re-export workflow types from their new locations
export { StepId } from "./lib/workflow/step-ids";
export { Var } from "./lib/workflow/variables";
export type { StepIdValue, VarName, WorkflowVars };

// Define StepLogEntry and StepUIState here as they are central to workflow state
export interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: LogLevel;
  apiCall?: {
    method: string;
    url: string;
    request?: { headers?: Record<string, string>; body?: unknown };
    response?: {
      status: number;
      headers?: Record<string, string>;
      body?: unknown;
    };
    duration?: number;
  };
}

// Keep only the general types here
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

export interface StepDefinition {
  id: StepIdValue;
  name?: string;
  description?: string;
  requires: readonly VarName[];
  provides: readonly VarName[];
  undo?: (ctx: StepUndoContext) => Promise<void>;
}

export interface StepRunResult {
  id: StepIdValue;
  outcome: StepOutcome;
  summary: string;
  vars: Partial<WorkflowVars>;
}

export interface StepCheckContext<T> {
  fetchGoogle<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;
  vars: Partial<WorkflowVars>;
  markComplete(data: T): void;
  markIncomplete(summary: string, data: T): void;
  markCheckFailed(error: string): void;
}

export interface StepExecuteContext<T> {
  fetchGoogle<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;
  vars: Partial<WorkflowVars>;
  checkData: T;
  markSucceeded(vars: Partial<WorkflowVars>): void;
  markFailed(error: string): void;
  markPending(notes: string): void;
}

export interface StepUndoContext {
  fetchGoogle<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean }
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;
  vars: Partial<WorkflowVars>;
  markReverted(): void;
  markFailed(error: string): void;
}

export interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: LogLevel;
}

export interface StepUIState {
  status:
    | "idle"
    | "checking"
    | "executing"
    | "complete"
    | "failed"
    | "pending"
    | "undoing"
    | "reverted";
  summary?: string;
  error?: string;
  notes?: string;
  logs?: StepLogEntry[];
}
