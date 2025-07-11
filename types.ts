import { z } from "zod";
import type { StepIdValue } from "./lib/workflow/step-ids";
import type { VarName, WorkflowVars } from "./lib/workflow/variables";

// Re-export workflow types from their new locations
export { StepId } from "./lib/workflow/step-ids";
export { Var } from "./lib/workflow/variables";
export type { StepIdValue, VarName, WorkflowVars };

export interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: LogLevel;
  method?: string;
  status?: number;
  url?: string;
}

export enum LogLevel {
  Info = "info",
  Error = "error",
  Debug = "debug"
}

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE"
}

export enum HttpStatus {
  OK = 200,
  Created = 201,
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  PreconditionFailed = 412
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
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;
  vars: Partial<WorkflowVars>;
  markComplete(data: T): void;
  markIncomplete(summary: string, data: T): void;
  markStale(message: string): void;
  markCheckFailed(error: string): void;
}

export interface StepExecuteContext<T> {
  fetchGoogle<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean | string }
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
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
  fetchMicrosoft<R>(
    url: string,
    schema: z.ZodSchema<R>,
    init?: RequestInit & { flatten?: boolean | string }
  ): Promise<R>;
  log(level: LogLevel, message: string, data?: unknown): void;
  vars: Partial<WorkflowVars>;
  markReverted(): void;
  markFailed(error: string): void;
}

import type { StepStatusValue } from "./lib/workflow/step-status";

export interface StepUIState {
  status: StepStatusValue;
  summary?: string;
  error?: string;
  notes?: string;
  logs?: StepLogEntry[];
  lro?: {
    detected: boolean;
    startTime: number;
    estimatedDuration?: number;
    operationType?: string;
  };
  isChecking?: boolean;
  isExecuting?: boolean;
  isUndoing?: boolean;
  blockReason?: string;
}
