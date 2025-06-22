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
import { getStep } from "./step-registry";

async function processStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>,
  execute: boolean
): Promise<{ state: StepUIState; newVars: Partial<WorkflowVars> }> {
  const step = getStep(stepId);

  let logs: StepLogEntry[] = [];
  let currentState: StepUIState = { status: "idle", logs };
  let finalVars: Partial<WorkflowVars> = {};

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
  };

  const addLog = (entry: StepLogEntry) => {
    let data = entry.data;
    if (entry.level === LogLevel.Error) {
      data = {
        error: data instanceof Error ? inspect(data, { depth: null }) : data,
        vars: { ...vars }
      };
    } else if (data instanceof Error) {
      data = inspect(data, { depth: null });
    }

    const logEntry = { ...entry, data };
    logs = [...logs, logEntry];
    if (process.env.NODE_ENV === "development") {
      const prefix = `[${entry.level?.toUpperCase()}] ${new Date(entry.timestamp).toISOString()}`;
      console.log(`${prefix}: ${entry.message}`, logEntry.data ?? "");
    }
    pushState({});
  };

  // Refresh tokens if needed
  const googleTokenObj = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const microsoftTokenObj = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);

  const baseContext = {
    fetchGoogle: createAuthenticatedFetch(
      googleTokenObj?.accessToken
        ?? (vars[Var.GoogleAccessToken] as string | undefined),
      { addLog }
    ),
    fetchMicrosoft: createAuthenticatedFetch(
      microsoftTokenObj?.accessToken
        ?? (vars[Var.MsGraphToken] as string | undefined),
      { addLog }
    ),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    }
  };

  // CHECK PHASE
  pushState({ status: "checking" });

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
        pushState({ status: "complete", summary: "Step already complete" });
      },
      markIncomplete: (summary: string, data: CheckType) => {
        checkData = data;
        isComplete = false;
        pushState({ status: "idle", summary });
      },
      markCheckFailed: (error: string) => {
        checkFailed = true;
        pushState({ status: "failed", error: `Check failed: ${error}` });
      }
    });
  } catch (error) {
    pushState({
      status: "failed",
      error:
        "Check error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
    return { state: currentState, newVars: finalVars };
  }

  if (checkFailed) {
    return { state: currentState, newVars: finalVars };
  }

  if (isComplete) {
    // Propagate any variables gathered during check for completed steps
    return { state: currentState, newVars: checkData };
  }

  if (execute) {
    // EXECUTE PHASE
    pushState({ status: "executing" });

    try {
      await step.execute({
        ...baseContext,
        vars,
        checkData,
        markSucceeded: (newVars: Partial<WorkflowVars>) => {
          finalVars = newVars;
          pushState({ status: "complete", summary: "Succeeded" });
        },
        markFailed: (error: string) => {
          pushState({ status: "failed", error });
        },
        markPending: (notes: string) => {
          pushState({ status: "pending", notes });
        }
      });
    } catch (error) {
      pushState({
        status: "failed",
        error:
          "Execute error: "
          + (error instanceof Error ? error.message : "Unknown error")
      });
    }
  }

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
  let currentState: StepUIState = { status: "undoing", logs };

  const pushState = (data: Partial<StepUIState>) => {
    currentState = { ...currentState, ...data, logs };
  };

  const addLog = (entry: StepLogEntry) => {
    logs = [...logs, entry];
    if (process.env.NODE_ENV === "development") {
      const prefix = `[${entry.level?.toUpperCase()}] ${new Date(
        entry.timestamp
      ).toISOString()}`;

      console.log(`${prefix}: ${entry.message}`, entry.data ?? "");
    }
    pushState({});
  };

  // Refresh tokens if needed
  const googleTokenObj = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const microsoftTokenObj = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);

  const baseContext = {
    fetchGoogle: createAuthenticatedFetch(
      googleTokenObj?.accessToken
        ?? (vars[Var.GoogleAccessToken] as string | undefined),
      { addLog }
    ),
    fetchMicrosoft: createAuthenticatedFetch(
      microsoftTokenObj?.accessToken
        ?? (vars[Var.MsGraphToken] as string | undefined),
      { addLog }
    ),
    log: (level: LogLevel, message: string, data?: unknown) => {
      addLog({ timestamp: Date.now(), message, data, level });
    }
  };

  if (!step.undo) {
    pushState({ status: "failed", error: "Undo not implemented" });
    return { state: currentState };
  }

  try {
    await step.undo({
      ...baseContext,
      vars,
      markReverted: () => {
        pushState({ status: "reverted", summary: "Reverted" });
      },
      markFailed: (error: string) => {
        pushState({ status: "failed", error });
      }
    });
  } catch (error) {
    pushState({
      status: "failed",
      error:
        "Undo error: "
        + (error instanceof Error ? error.message : "Unknown error")
    });
  }

  return { state: currentState };
}

export async function undoStep<T extends StepIdValue>(
  stepId: T,
  vars: Partial<WorkflowVars>
): Promise<{ state: StepUIState }> {
  return processUndoStep(stepId, vars);
}
