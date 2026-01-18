import type { z } from "zod";
import type { StepIdValue } from "./lib/workflow/step-ids";
import type { VarName, WorkflowVars } from "./lib/workflow/variables";

export interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: LogLevel;
  method?: string;
  status?: number;
  url?: string;
}

export type LogLevel = "info" | "error" | "debug";
export const LogLevel: Record<"Info" | "Error" | "Debug", LogLevel> = {
  Info: "info",
  Error: "error",
  Debug: "debug",
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export const HttpMethod: Record<
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  HttpMethod
> = { GET: "GET", POST: "POST", PUT: "PUT", PATCH: "PATCH", DELETE: "DELETE" };

export type HttpStatus = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 412;
export const HttpStatus: Record<
  | "OK"
  | "Created"
  | "NoContent"
  | "BadRequest"
  | "Unauthorized"
  | "Forbidden"
  | "NotFound"
  | "Conflict"
  | "PreconditionFailed",
  HttpStatus
> = {
  OK: 200,
  Created: 201,
  NoContent: 204,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  PreconditionFailed: 412,
};

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
