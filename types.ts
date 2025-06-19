import { z } from "zod";
import type { StepIdValue } from "./lib/workflow/step-ids";
import type { VarName, WorkflowVars } from "./lib/workflow/variables";

// Re-export workflow types from their new locations
export { StepId } from "./lib/workflow/step-ids";
export { Var } from "./lib/workflow/variables";
export type { StepIdValue, VarName, WorkflowVars };

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

export interface StepLogEntry {
  timestamp: number;
  message: string;
  level: LogLevel;
  data?: unknown;
}
