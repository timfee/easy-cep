"use server";
import "server-only";

/**
 * @file engine.ts
 * @description Server-side execution engine for individual workflow steps.
 *
 * The engine abstracts the *lifecycle* of a step:
 *  1. **Check** – interrogate external systems to see if the step is already
 *     complete.
 *  2. **Execute** – if needed, perform the mutation.
 *  3. Stream log / status updates back to the UI.
 *
 * The public API is the `runStep` server action.  It is intentionally
 * side-effect free *until* it calls the chosen step’s own implementation.
 */

import { PROVIDERS } from "@/constants";
import { refreshTokenIfNeeded } from "@/lib/auth";
import {
  LogLevel,
  StepCheckContext,
  StepIdValue,
  StepLogEntry,
  StepUIState,
  Var,
  WorkflowVars
} from "@/types";
import { inspect } from "node:util";
import { createAuthenticatedFetch } from "./fetch-utils";
import type { LROMetadata } from "./lro-detector";
import { getStep } from "./step-registry";
import { StepStatus } from "./step-status";

function sanitizeVars(vars: Partial<WorkflowVars>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes("token")
        || lower.includes("password")
        || lower.includes("certificate")
      ) {
        return [key, "[REDACTED]"];
      }
      return [key, value];
    })
  );
}

function appendLog(
  entry: StepLogEntry,
  vars: Partial<WorkflowVars>,
  logs: StepLogEntry[]
): StepLogEntry[] {
  let data = entry.data;
  if (entry.level === LogLevel.Error) {
    data = {
      error: data instanceof Error ? inspect(data, { depth: null }) : data,
      vars: sanitizeVars(vars)
    };
  } else if (data instanceof Error) {
    data = inspect(data, { depth: null });
  }

  return [...logs, { ...entry, data }];
}

async function processStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>,
  execute: boolean
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = { status: StepStatus.Ready, logs };
  let finalVars: Partial<WorkflowVars> = {};

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
  };

  const recordLro = (lro: LROMetadata) => {
    if (!currentState.lro) {
      currentState = {
        ...currentState,
        lro: {
          detected: true,
          startTime: Date.now(),
          estimatedDuration: lro.estimatedSeconds,
          operationType: lro.type
        }
      };
    }
  };

  const addLog = (entry: StepLogEntry) => {
    logs = appendLog(entry, vars, logs);
    pushState({});
  };

  // Refresh tokens if needed
  const googleTokenObj = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const microsoftTokenObj = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);

  const baseContext = {
    fetchGoogle: createAuthenticatedFetch(
      googleTokenObj?.accessToken
        ?? (vars[Var.GoogleAccessToken] as string | undefined),
      { addLog, onLroDetected: recordLro }
    ),
    fetchMicrosoft: createAuthenticatedFetch(
      microsoftTokenObj?.accessToken
        ?? (vars[Var.MsGraphToken] as string | undefined),
      { addLog, onLroDetected: recordLro }
    ),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    }
  };

  // CHECK PHASE
  pushState({ isChecking: true });

  // Data carried from check() into execute() or propagated as newVars
  type CheckType =
    Parameters<typeof step.check>[0] extends StepCheckContext<infer D> ? D
    : never;
  let checkData!: CheckType;
  let checkFailed = false;
  let isComplete = false;

  try {
    await step.check({
      ...baseContext,
      vars,
      markComplete: (data: CheckType) => {
        checkData = data;
        isComplete = true;
        pushState({
          status: StepStatus.Complete,
          summary: "Step already complete"
        });
      },
      markIncomplete: (summary: string, data: CheckType) => {
        checkData = data;
        isComplete = false;
        pushState({ status: StepStatus.Ready, summary });
      },
      markStale: (message: string) => {
        checkData = {} as CheckType;
        isComplete = false;
        pushState({ status: StepStatus.Stale, summary: message });
      },
      markCheckFailed: (error: string) => {
        checkFailed = true;
        pushState({
          status: StepStatus.Blocked,
          error: `Check failed: ${error}`
        });
      }
    });
  } catch (error) {
    pushState({
      status: StepStatus.Blocked,
      error:
        "Check error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
    pushState({ isChecking: false, isExecuting: false });
    return { state: currentState, newVars: finalVars };
  }

  if (checkFailed) {
    pushState({ isChecking: false });
    return { state: currentState, newVars: finalVars };
  }

  if (isComplete) {
    // Propagate any variables gathered during check for completed steps
    pushState({ isChecking: false });
    return { state: currentState, newVars: checkData };
  }

  if (execute) {
    // EXECUTE PHASE
    pushState({ isExecuting: true });

    try {
      await step.execute({
        ...baseContext,
        vars,
        checkData,
        markSucceeded: (newVars: Partial<WorkflowVars>) => {
          finalVars = newVars;
          pushState({ status: StepStatus.Complete, summary: "Succeeded" });
        },
        markFailed: (error: string) => {
          pushState({ status: StepStatus.Blocked, error });
        },
        markPending: (notes: string) => {
          pushState({ status: StepStatus.Ready, notes });
        }
      });
    } catch (error) {
      pushState({
        status: StepStatus.Blocked,
        error:
          "Execute error: "
          + (error instanceof Error ? error.message : "Unknown error")
      });
    }
  }
  pushState({ isChecking: false, isExecuting: false });
  return { state: currentState, newVars: finalVars };
}

export async function runStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  return processStep(stepId, vars, true);
}

export async function checkStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  return processStep(stepId, vars, false);
}

async function processUndoStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState }> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = {
    status: StepStatus.Ready,
    isUndoing: true,
    logs
  };

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
  };

  const recordLro = (lro: LROMetadata) => {
    if (!currentState.lro) {
      currentState = {
        ...currentState,
        lro: {
          detected: true,
          startTime: Date.now(),
          estimatedDuration: lro.estimatedSeconds,
          operationType: lro.type
        }
      };
    }
  };

  const addLog = (entry: StepLogEntry) => {
    logs = appendLog(entry, vars, logs);
    pushState({});
  };

  // Refresh tokens if needed
  const googleTokenObj = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const microsoftTokenObj = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);

  const baseContext = {
    fetchGoogle: createAuthenticatedFetch(
      googleTokenObj?.accessToken
        ?? (vars[Var.GoogleAccessToken] as string | undefined),
      { addLog, onLroDetected: recordLro }
    ),
    fetchMicrosoft: createAuthenticatedFetch(
      microsoftTokenObj?.accessToken
        ?? (vars[Var.MsGraphToken] as string | undefined),
      { addLog, onLroDetected: recordLro }
    ),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    }
  };

  if (!step.undo) {
    pushState({ status: StepStatus.Blocked, error: "Undo not implemented" });
    pushState({ isUndoing: false });
    return { state: currentState };
  }

  try {
    await step.undo({
      ...baseContext,
      vars,
      markReverted: () => {
        pushState({ status: StepStatus.Complete, summary: "Reverted" });
      },
      markFailed: (error: string) => {
        pushState({ status: StepStatus.Blocked, error });
      }
    });
  } catch (error) {
    pushState({
      status: StepStatus.Blocked,
      error:
        "Undo error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
  }
  pushState({ isUndoing: false });
  return { state: currentState };
}

export async function undoStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState }> {
  return processUndoStep(stepId, vars);
}
